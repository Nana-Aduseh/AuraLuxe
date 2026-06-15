import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackWebhookSignature } from '@/lib/paystack'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    console.log('[Webhook] ============= WEBHOOK RECEIVED =============');
    console.log('[Webhook] Timestamp:', new Date().toISOString());
    console.log('[Webhook] Signature present:', !!signature);

    if (!signature) {
      console.error('[Webhook] ❌ FAILED: Missing signature header');
      console.error('[Webhook] Expected header: x-paystack-signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // Verify webhook signature
    const isValid = verifyPaystackWebhookSignature(rawBody, signature);
    console.log('[Webhook] Signature valid:', isValid);
    
    if (!isValid) {
      console.error('[Webhook] ❌ FAILED: Signature verification failed');
      console.error('[Webhook] This usually means PAYSTACK_SECRET_KEY is wrong or changed');
      console.error('[Webhook] Expected key format: sk_live_xxx or sk_test_xxx');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    const { event: eventType, data } = event

    console.log('[Webhook] Event type:', eventType);
    console.log('[Webhook] Reference:', data?.reference);
    console.log('[Webhook] Status:', data?.status);
    console.log('[Webhook] Amount:', data?.amount, 'kobo');

    // Only handle successful transactions
    if (eventType !== 'charge.success') {
      console.log('[Webhook] ⏭️  Ignoring event type (not charge.success):', eventType);
      return NextResponse.json({ success: true, message: 'Event ignored' })
    }

    const { reference, amount, status, metadata } = data
    
    // Use custom checkout_reference from metadata if available (sent from client)
    // Otherwise fallback to Paystack's reference
    const paymentReference = metadata?.checkout_reference || reference
    
    if (!paymentReference || status !== 'success') {
      console.log('[Webhook] Transaction not successful:', { reference, status });
      return NextResponse.json({ success: true, message: 'Transaction not successful' })
    }

    console.log('[Webhook] Processing successful transaction:', {
      paystackReference: reference,
      checkoutReference: paymentReference,
    });

    const supabase = createAdminClient()
    if (!supabase) return NextResponse.json({ error: 'Supabase missing' }, { status: 500 })

    // Check if order already exists for this reference (prevents duplicates)
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_reference', paymentReference)
      .limit(1)

    if (existingOrders && existingOrders.length > 0) {
      return NextResponse.json({ success: true, message: 'Order already exists' })
    }

    // Extract data from Paystack payload
    const cartItems = Array.isArray(metadata?.cart_items) ? metadata.cart_items : []
    const guestInfo = metadata?.guest_info || {}
    const totalAmount = Number(metadata?.total_amount ?? Number(amount) / 100)

    if (!cartItems.length) {
      return NextResponse.json({ success: true, message: 'No cart items' })
    }

    console.log('[Webhook] Creating single order for payment:', {
      paymentReference,
      itemCount: cartItems.length,
      totalAmount,
      guestPhone: guestInfo.phone,
      guestAddress: guestInfo.address,
    });

    // Create ONE order for the entire payment
    const { data: createdOrder, error: createError } = await supabase
      .from('orders')
      .insert({
        user_id: metadata?.user_id || null,
        total_amount: totalAmount,
        status: 'processing',
        payment_reference: paymentReference,
        order_type: metadata?.delivery_type === 'pickup' ? 'pickup' : 'delivery',
        confirmation_status: 'not_confirmed',
        completed_at: new Date().toISOString(),
        guest_access_token: metadata?.guest_token || null,
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
      console.error('[Webhook] ❌ Order creation failed:', createError)
      return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 })
    }

    console.log('[Webhook] ✅ Order created successfully:', { orderId: createdOrder.id, itemCount: cartItems.length });

    // Add all cart items as order_items for this single order
    for (const item of cartItems) {
      const qty = Number(item.quantity_ordered || 1)
      const price = Number(item.price_at_purchase || 0)

      console.log('[Webhook] Adding order item:', { productId: item.product_id, qty, price });

      const { error: itemError } = await supabase.from('order_items').insert({
        order_id: createdOrder.id,
        product_id: item.product_id,
        color_id: item.color_id || null,
        quantity_id: item.quantity_id || null,
        quantity_ordered: qty,
        price_at_purchase: price,
      })

      if (itemError) {
        console.error('Webhook: Order item insert error:', itemError)
        continue
      }

      // Decrement stock for this item
      if (item.color_id) {
        const { data: colorData } = await supabase
          .from('product_colors')
          .select('stock_quantity')
          .eq('id', item.color_id)
          .maybeSingle()

        if (colorData && typeof colorData.stock_quantity === 'number') {
          await supabase
            .from('product_colors')
            .update({ stock_quantity: Math.max(0, colorData.stock_quantity - qty) })
            .eq('id', item.color_id)
        }
      }
    }

    console.log('[Webhook] ✅ Successfully processed order:', paymentReference)
    console.log('[Webhook] ==============================================');
    return NextResponse.json({ success: true, message: 'Order processed successfully' })
  } catch (err: any) {
    console.error('[Webhook] ❌ Fatal error:', {
      error: err.message,
      stack: err.stack,
    });
    console.error('[Webhook] ==============================================');
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
