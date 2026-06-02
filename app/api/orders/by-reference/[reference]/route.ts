import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { enrichOrderItemsForDisplay } from '@/lib/order-item-display'

interface RouteParams {
  params: Promise<{ reference: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = createAdminClient()
  const { reference } = await params
  const token = request.nextUrl.searchParams.get('token')
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)

  if (!supabase) {
    console.error('Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing)')
    return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
  }

  const { data: orderByPaymentReference, error: paymentReferenceError } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_reference', reference)
    .eq('confirmation_status', 'confirmed')
    .maybeSingle()

  const { data: orderById, error: idError } = orderByPaymentReference || !looksLikeUuid
    ? { data: null, error: null }
    : await supabase
        .from('orders')
        .select('*')
        .eq('id', reference)
        .eq('confirmation_status', 'confirmed')
        .maybeSingle()

  if (paymentReferenceError || idError) {
    return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 })
  }

  const order = orderByPaymentReference || orderById

  if (!order) {
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

  if (order.guest_access_token && order.guest_access_token !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id)

  const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])

  return NextResponse.json({ order, items: displayItems })
}