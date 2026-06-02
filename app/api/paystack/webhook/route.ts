import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackWebhookSignature } from '@/lib/paystack'
import { createAdminClient } from '@/lib/supabase/admin'

type CheckoutMetadata = {
  checkout_reference?: string
  guest_token?: string | null
  user_id?: string | null
  delivery_type?: 'delivery' | 'pickup'
  guest_info?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    address?: string
    town?: string
    region?: string
  } | null
  cart_items?: Array<{
    product_id?: string
    color_id?: string | null
    quantity_id?: string | null
    quantity_ordered?: number
    price_at_purchase?: number
  }>
  total_amount?: number
}

async function insertOrderItems(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  cartItems: NonNullable<CheckoutMetadata['cart_items']>,
) {
  for (const item of cartItems) {
    const quantityOrdered = Number(item.quantity_ordered || 1)
    const priceAtPurchase = Number(item.price_at_purchase || 0)

    let { error: itemError } = await supabase.from('order_items').insert({
      order_id: orderId,
      product_id: item.product_id,
      color_id: item.color_id || null,
      quantity_id: item.quantity_id || null,
      quantity_ordered: quantityOrdered,
      price_at_purchase: priceAtPurchase,
    })

    if (itemError) {
      const legacyInsert = await supabase.from('order_items').insert({
        order_id: orderId,
        product_id: item.product_id,
        color_id: item.color_id || null,
        quantity_id: item.quantity_id || null,
        quantity: quantityOrdered,
        price: priceAtPurchase,
      })
      itemError = legacyInsert.error
    }

    if (itemError) {
      throw itemError
    }

  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // Verify webhook signature
    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    const { event: eventType, data } = event

    // Only handle successful transactions
    if (eventType !== 'charge.success') {
      return NextResponse.json({ success: true, message: 'Event ignored' })
    }

    const { reference, amount, status, metadata } = data
    if (!reference || status !== 'success') {
      return NextResponse.json({ success: true, message: 'Transaction not successful' })
    }

    console.log('Paystack success received; webhook acknowledgement only for reference:', reference)
    return NextResponse.json({ success: true, message: 'Webhook acknowledged' })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
