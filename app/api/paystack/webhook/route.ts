import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackWebhookSignature, verifyPaystackTransaction } from '@/lib/paystack'
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
    const { event: eventType, data: eventData } = event

    console.log('[Webhook] Event type:', eventType);
    console.log('[Webhook] Event Reference:', eventData?.reference);

    // Only handle successful transactions
    if (eventType !== 'charge.success') {
      console.log('[Webhook] ⏭️  Ignoring event type (not charge.success):', eventType);
      return NextResponse.json({ success: true, message: 'Event ignored' })
    }

    const paystackReferenceFromEvent = eventData?.reference;
    if (!paystackReferenceFromEvent) {
        console.error('[Webhook] ❌ FAILED: Event data is missing a reference.');
        return NextResponse.json({ error: 'Event missing reference' }, { status: 400 });
    }

    console.log('[Webhook] Verifying transaction with Paystack API to ensure complete metadata:', paystackReferenceFromEvent);
    const verification = await verifyPaystackTransaction(paystackReferenceFromEvent);
    if (!verification || !verification.status || !verification.data) {
        console.error('[Webhook] ❌ FAILED: Paystack transaction verification failed for reference:', paystackReferenceFromEvent);
        return NextResponse.json({ success: true, message: 'Transaction verification failed' });
    }

    const { data } = verification;
    const { reference, amount, status, metadata: rawMetadata } = data;

    // Parse metadata safely in case Paystack stringifies it
    let metadata = rawMetadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch(e) {}
    }
    
    // Use custom checkout_reference from metadata if available (sent from client)
    // Otherwise fallback to Paystack's reference
    const paymentReference = metadata?.checkout_reference || reference
    
    if (!paymentReference || status !== 'success') {
      console.log('[Webhook] Transaction not successful:', { reference, status });
      return NextResponse.json({ success: true, message: 'Transaction not successful' })
    }

    console.log('[Webhook] Processing verified transaction:', {
      paystackReference: reference,
      checkoutReference: paymentReference,
    });

    const supabase = createAdminClient()
    if (!supabase) return NextResponse.json({ error: 'Supabase missing' }, { status: 500 })

    // ---------------------------------------------------------------------------------
    // IDEMPOTENCY CHECK: Check if order already exists for this reference.
    // If the /api/orders/finalize redirect already created it, we gracefully exit.
    // ---------------------------------------------------------------------------------
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_reference', paymentReference)
      .limit(1)

    if (existingOrders && existingOrders.length > 0) {
      console.log('[Webhook] ⏭️ Order already exists (likely created by /finalize route). Acknowledging webhook.');
      console.log('[Webhook] ==============================================');
      return NextResponse.json({ success: true, message: 'Order already exists' })
    }

    console.log('[Webhook] Order not found. Creating order as fallback...');

    // Extract data from Paystack payload
    const cartItems = Array.isArray(metadata?.cart_items) ? metadata.cart_items : []
    const guestInfo = metadata?.guest_info || {}
    const totalAmount = Number(metadata?.total_amount ?? Number(amount) / 100)

    console.log('[Webhook] Creating single order for payment:', {
      paymentReference,
      itemCount: cartItems.length,
      totalAmount,
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
        confirmation_status: 'confirmed',
        completed_at: data?.paidAt || data?.paid_at || data?.transaction_date || data?.createdAt || data?.created_at || new Date().toISOString(),
        guest_access_token: metadata?.guest_token || null,
        guest_first_name: guestInfo.firstName || data?.customer?.first_name || null,
        guest_last_name: guestInfo.lastName || data?.customer?.last_name || null,
        guest_email: guestInfo.email || data?.customer?.email || null,
        guest_phone: guestInfo.phone || data?.customer?.phone || null,
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
    }

    // Auto-claim logic for guest orders
    if (createdOrder.guest_email && !createdOrder.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', createdOrder.guest_email)
        .maybeSingle()

      if (profile) {
        await supabase.from('orders').update({ user_id: profile.id }).eq('id', createdOrder.id)
      }
    }

    console.log('[Webhook] ✅ Successfully processed fallback order:', paymentReference)
    console.log('[Webhook] ==============================================');
    return NextResponse.json({ success: true, message: 'Order processed successfully via webhook fallback' })
  } catch (err: any) {
    console.error('[Webhook] ❌ Fatal error:', {
      error: err.message,
      stack: err.stack,
    });
    console.error('[Webhook] ==============================================');
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
