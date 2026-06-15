import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { enrichOrderItemsForDisplay } from '@/lib/order-item-display'

interface RouteParams {
  params: Promise<{ reference: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = createAdminClient()
  const serverSupabase = await createClient()
  
  const { reference } = await params
  const token = request.nextUrl.searchParams.get('token')
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)

  if (!supabase) {
    console.error('Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing)')
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
  }

  // Check if it's in our DB first
  const { data: orders, error: dbError } = await supabase
    .from('orders')
    .select('*')
    .or(`payment_reference.eq.${reference},payment_reference.ilike.${reference}-%,id.eq.${looksLikeUuid ? reference : '00000000-0000-0000-0000-000000000000'}`)

  if (dbError) {
    return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    // If no confirmed order found, attempt to verify the payment with Paystack
    try {
      const verify = await verifyPaystackTransaction(reference)
      const payData = verify?.data

      if (payData && payData.status === 'success') {
        const metadata = (payData.metadata || {}) as any
        const cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : []
        const displayItems = await enrichOrderItemsForDisplay(supabase, cartItems)

        // If Paystack says the transaction succeeded, return the verification payload
        // to the client but do not create or update DB entries here. The client
        // will call the finalize endpoint to persist the order when appropriate.
        return NextResponse.json({ verified: true, payData, items: displayItems })
      }
    } catch (err) {
      console.error('Verification check failed:', err)
    }

    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // If we have multiple split orders, use the first one as primary metadata
  const primaryOrder = orders[0]

  // Ownership check: Allow access if token matches OR if the logged-in user owns the order
  if (primaryOrder.guest_access_token && primaryOrder.guest_access_token !== token) {
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user || user.id !== primaryOrder.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  }

  // Fetch ALL items from ALL orders sharing this payment reference
  const orderIds = orders.map(o => o.id)
  const { data: allItems } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds)

  const displayItems = await enrichOrderItemsForDisplay(supabase, allItems || [])

  // Calculate the total across all split orders for the UI receipt header
  const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const unifiedOrder = { ...primaryOrder, total_amount: totalAmount }

  return NextResponse.json({ order: unifiedOrder, items: displayItems, splitOrders: orders })
}