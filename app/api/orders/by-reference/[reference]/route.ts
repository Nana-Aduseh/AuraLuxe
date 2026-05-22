import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ reference: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = createAdminClient()
  const { reference } = await params
  const token = request.nextUrl.searchParams.get('token')

  const { data: orderByPaymentReference, error: paymentReferenceError } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_reference', reference)
    .eq('confirmation_status', 'confirmed')
    .maybeSingle()

  const { data: orderById, error: idError } = orderByPaymentReference
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
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.guest_access_token && order.guest_access_token !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', order.id)

  return NextResponse.json({ order, items: items || [] })
}