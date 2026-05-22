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

    if (item.quantity_id) {
      const { data: qty } = await supabase
        .from('product_quantities')
        .select('stock_quantity')
        .eq('id', item.quantity_id)
        .single()

      if (qty) {
        await supabase
          .from('product_quantities')
          .update({
            stock_quantity: Math.max(0, qty.stock_quantity - quantityOrdered),
          })
          .eq('id', item.quantity_id)
      }
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

    const supabase = createAdminClient()
    const checkoutMetadata = (metadata || {}) as CheckoutMetadata
    const cartItems = Array.isArray(checkoutMetadata.cart_items) ? checkoutMetadata.cart_items : []
    const totalAmount = Number(checkoutMetadata.total_amount ?? Number(amount || 0) / 100)

    const { data: paymentReferenceOrder, error: paymentReferenceError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle()

    const { data: legacyReferenceOrder, error: legacyReferenceError } = paymentReferenceOrder
      ? { data: null, error: null }
      : await supabase
          .from('orders')
          .select('*')
          .eq('id', reference)
          .maybeSingle()

    if (paymentReferenceError || legacyReferenceError) {
      console.error('Order lookup failed:', paymentReferenceError || legacyReferenceError)
      return NextResponse.json({ success: false, error: 'Order lookup failed' }, { status: 500 })
    }

    const existingOrder = paymentReferenceOrder || legacyReferenceOrder

    if (existingOrder?.payment_reference) {
      return NextResponse.json({ success: true, message: 'Payment already recorded' })
    }

    if (existingOrder) {
      const { count: existingItemCount } = await supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', existingOrder.id)

      if ((existingItemCount || 0) === 0 && cartItems.length > 0) {
        await insertOrderItems(supabase, existingOrder.id, cartItems)
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_reference: reference,
          status: 'processing',
          confirmation_status: 'confirmed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id)

      if (updateError) {
        console.error('Order update failed:', updateError)
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Order updated' })
    }

    if (cartItems.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing checkout metadata' }, { status: 500 })
    }

    const guestInfo = checkoutMetadata.guest_info || {}
    const { data: createdOrder, error: createError } = await supabase
      .from('orders')
      .insert({
        user_id: checkoutMetadata.user_id || null,
        total_amount: totalAmount,
        status: 'processing',
        payment_reference: reference,
        order_type: checkoutMetadata.delivery_type === 'pickup' ? 'pickup' : 'delivery',
        confirmation_status: 'confirmed',
        completed_at: new Date().toISOString(),
        guest_access_token: checkoutMetadata.guest_token || null,
        guest_first_name: guestInfo.firstName || null,
        guest_last_name: guestInfo.lastName || null,
        guest_email: guestInfo.email || null,
        guest_phone: guestInfo.phone || null,
        guest_address: guestInfo.address || null,
        guest_town: guestInfo.town || null,
        guest_region: guestInfo.region || null,
      })
      .select('*')
      .single()

    if (createError || !createdOrder) {
      console.error('Order creation failed:', createError)
      return NextResponse.json({ success: false, error: createError?.message || 'Order creation failed' }, { status: 500 })
    }

    try {
      await insertOrderItems(supabase, createdOrder.id, cartItems)
    } catch (itemErr: any) {
      console.error('Order item creation failed:', itemErr)
      return NextResponse.json({ success: false, error: itemErr?.message || 'Failed to create order items' }, { status: 500 })
    }

    if (createdOrder.guest_email && !createdOrder.user_id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', createdOrder.guest_email)
          .maybeSingle()

        if (profile) {
          await supabase
            .from('orders')
            .update({ user_id: profile.id })
            .eq('id', createdOrder.id)
        }
      } catch (claimErr) {
        console.error('Guest order auto-claim failed:', claimErr)
      }
    }

    console.log('Order processed successfully:', reference)
    return NextResponse.json({ success: true, message: 'Order created' })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
