import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerUserAdminStatus } from '@/lib/admin-server'
import { syncUserProfile } from '@/lib/profile'

function statusLabelFromOrder(order: { confirmation_status?: string; delivery_status?: string | null }) {
  if (order.confirmation_status === 'confirmed' && order.delivery_status === 'sent') {
    return 'sent'
  }

  if (order.confirmation_status === 'confirmed' && order.delivery_status === 'received') {
    return 'received'
  }

  if (order.confirmation_status === 'confirmed') {
    return 'confirmed'
  }

  return 'not confirmed'
}

async function loadOrderDetails(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orderId: string,
) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Order not found')
  }

  const [{ data: profile }, { data: items }] = await Promise.all([
    order.user_id
      ? supabase
          .from('profiles')
          .select('id, name, email')
          .eq('id', order.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('order_items').select('*').eq('order_id', orderId),
  ])

  const orderItems = await Promise.all(
    (items ?? []).map(async (item: any) => {
      const [{ data: product }, { data: color }] = await Promise.all([
        supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .maybeSingle(),
        item.color_id
          ? supabase
              .from('product_colors')
              .select('color_name')
              .eq('id', item.color_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      return {
        product_name: product?.name || `Product ID: ${item.product_id}`,
        color_name: color?.color_name || '',
        quantity_ordered: item.quantity_ordered ?? 1,
        price_at_purchase: item.price_at_purchase ?? 0,
      }
    }),
  )

  return {
    order,
    profile,
    orderItems,
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionClient = await createClient()
  const adminClient = createAdminClient()
  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dataClient = adminClient ?? sessionClient
  await syncUserProfile(dataClient, user)

  const isAdmin = await getServerUserAdminStatus(dataClient, user)

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orderId } = await params
  const body = await request.json().catch(() => null)
  const confirmation_status = body?.confirmation_status
  const delivery_status = body?.delivery_status

  if (!confirmation_status && delivery_status === undefined) {
    return NextResponse.json({ error: 'No update provided' }, { status: 400 })
  }

  const updatePayload: Record<string, string | null> = {}
  if (confirmation_status) {
    updatePayload.confirmation_status = confirmation_status
  }
  if (delivery_status !== undefined) {
    updatePayload.delivery_status = delivery_status || null
  }

  // Fetch existing order to check current status before updating
  const { data: existingOrder } = await dataClient
    .from('orders')
    .select('delivery_status')
    .eq('id', orderId)
    .single()

  const { data: updatedOrder, error: updateError } = await dataClient
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)
    .select('*')
    .single()

  if (updateError || !updatedOrder) {
    return NextResponse.json({ error: updateError?.message || 'Failed to update order' }, { status: 500 })
  }

  // Deduct stock if the status is changing to 'sent' for the first time
  if (existingOrder?.delivery_status !== 'sent' && updatePayload.delivery_status === 'sent') {
    const { data: orderItems, error: itemsError } = await dataClient
      .from('order_items')
      .select('product_id, color_id, quantity_ordered')
      .eq('order_id', orderId)

    if (!itemsError && orderItems) {
      for (const item of orderItems) {
        if (item.color_id) {
          const { data: colorData } = await dataClient
            .from('product_colors')
            .select('stock_quantity')
            .eq('id', item.color_id)
            .maybeSingle()

          if (colorData && typeof colorData.stock_quantity === 'number') {
            await dataClient
              .from('product_colors')
              .update({ stock_quantity: Math.max(0, colorData.stock_quantity - (item.quantity_ordered || 1)) })
              .eq('id', item.color_id)
            
            console.log(`[Admin] Decremented stock for color ${item.color_id} by ${item.quantity_ordered}`)
          }
        }
      }
    }
  }

  const { order, profile, orderItems } = await loadOrderDetails(dataClient as any, orderId)
  const recipientEmail = order.guest_email || profile?.email

  // Email notifications disabled — no action taken here.

  return NextResponse.json({ order: updatedOrder })
}
