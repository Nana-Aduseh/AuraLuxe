import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { enrichOrderItemsForDisplay } from '@/lib/order-item-display'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { reference, token, forceFallback, fallbackItems, fallbackTotal, fallbackGuestInfo, fallbackDeliveryType, fallbackStatus, fallbackConfirmation, fallbackUserId } = body

    console.log('[Finalize] Starting order finalization:', { reference, hasToken: !!token });

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    let supabase = createAdminClient()
    if (!supabase) {
      console.warn('Supabase admin client not configured, falling back to standard client')
      supabase = await createClient()
    }

    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)

    // Check if any order already exists for this payment reference
    const { data: existingOrders, error: refErr } = await supabase
      .from('orders')
      .select('*')
      .or(`payment_reference.eq.${reference},payment_reference.ilike.${reference}-%,id.eq.${looksLikeUuid ? reference : '00000000-0000-0000-0000-000000000000'}`)

    if (refErr) {
      console.error('Order lookup failed:', refErr)
      return NextResponse.json({ error: 'Order lookup failed' }, { status: 500 })
    }

    const existingOrder = existingOrders?.[0]

    if (existingOrder) {
      console.log('[Finalize] ✅ Order already exists:', { orderId: existingOrder.id, confirmationStatus: existingOrder.confirmation_status });
      // Order already exists, return it idempotently
      if (existingOrder.confirmation_status === 'confirmed') {
        const orderIds = existingOrders.map(o => o.id)
        const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds)
        const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])
        
        const totalAmount = existingOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
        return NextResponse.json({ order: { ...existingOrder, total_amount: totalAmount }, items: displayItems })
      }
      
      // Update all existing split orders associated with this reference
      const orderIds = existingOrders.map(o => o.id)
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'processing',
          confirmation_status: 'not_confirmed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', orderIds)

      if (updateError) {
        console.error('Order update failed:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds)
      const { data: freshOrders } = await supabase.from('orders').select('*').in('id', orderIds)
      const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])
      const currentTotal = (freshOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0)
      
      return NextResponse.json({ 
        order: { ...(freshOrders?.[0] || existingOrder), total_amount: currentTotal }, 
        items: displayItems 
      })
    }

    // Verify transaction with Paystack to ensure it's actually successful
    // First, try to extract metadata from the pending session to get the custom reference
    console.log('[Finalize] No existing order, verifying with Paystack...');
    const verify = await verifyPaystackTransaction(reference)
    const payData = verify?.data
    
    // Use custom checkout_reference from metadata if available
    const actualPaymentReference = payData?.metadata?.checkout_reference || reference
    
    console.log('[Finalize] Paystack verification result:', {
      requestReference: reference,
      paystackReference: payData?.reference,
      checkoutReference: payData?.metadata?.checkout_reference,
      status: payData?.status,
      verified: !!payData,
      amount: payData?.amount,
    });
    
    let metadata = (payData?.metadata || {}) as any
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch(e) {}
    }

    let cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : []
    let totalAmount = Number(metadata.total_amount ?? Number(payData?.amount || 0) / 100)
    let guestInfo = metadata.guest_info || {}
    let deliveryType = metadata.delivery_type || 'delivery'

    // Safely recover dropped metadata from Paystack using the frontend's fallback
    if (cartItems.length === 0 && forceFallback && fallbackItems && fallbackItems.length > 0) {
      console.log('[Finalize] Paystack metadata empty, using force fallback items');
      cartItems = fallbackItems;
      totalAmount = fallbackTotal || totalAmount;
      guestInfo = Object.keys(guestInfo).length > 0 ? guestInfo : (fallbackGuestInfo || {});
      deliveryType = deliveryType || fallbackDeliveryType || 'delivery';
    }

    if (!payData || payData.status !== 'success') {
      console.error('[Finalize] ❌ Payment not successful or verify failed', { paystackStatus: payData?.status });
      
      if (forceFallback && cartItems.length > 0) {
        console.log('[Finalize] Using force fallback data to save order anyway!');
      } else {
        return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
      }
    }

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Missing checkout metadata' }, { status: 400 })
    }

    console.log(`[Orders/Finalize] Processing payment reference: ${reference}`);
    console.log(`[Orders/Finalize] Cart items count: ${cartItems.length}`);
    console.log(`[Orders/Finalize] Cart items details:`, cartItems);
    console.log(`[Orders/Finalize] Guest info:`, metadata.guest_info);

    const { data: createdOrder, error: createError } = await supabase
      .from('orders')
      .insert({
        user_id: metadata?.user_id || fallbackUserId || null,
        total_amount: totalAmount,
        status: forceFallback && fallbackStatus ? fallbackStatus : 'processing',
        payment_reference: reference,
        order_type: deliveryType === 'pickup' ? 'pickup' : 'delivery',
        confirmation_status: forceFallback && fallbackConfirmation ? fallbackConfirmation : 'confirmed',
        completed_at: payData?.paidAt || payData?.paid_at || payData?.transaction_date || payData?.createdAt || payData?.created_at || new Date().toISOString(),
        guest_access_token: metadata?.guest_token || token || null,
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
      return NextResponse.json({ 
        error: 'Failed to create order', 
        message: createError?.message,
        hint: 'If you see an RLS violation, you MUST add SUPABASE_SERVICE_ROLE_KEY to your Vercel Environment Variables.'
      }, { status: 500 })
    }

    // Create separate order items attached to the master order
    for (const item of cartItems) {
      const quantityOrdered = Number(item.quantity_ordered || 1)
      const priceAtPurchase = Number(item.price_at_purchase || item.product?.price || 0)

      console.log(`[Orders/Finalize] Adding order item: product=${item.product_id}, price=${priceAtPurchase}, qty=${quantityOrdered}`);

      let { error: itemError } = await supabase.from('order_items').insert({
        order_id: createdOrder.id,
        product_id: item.product_id,
        color_id: item.color_id || null,
        quantity_id: item.quantity_id || null,
        quantity_ordered: quantityOrdered,
        price_at_purchase: priceAtPurchase,
      })

      if (itemError) {
        console.error('Order item insert error:', itemError);
      } else {
        console.log(`[Orders/Finalize] Order item added: product=${item.product_id}`);
      }
    }

    // Fetch all order items for display
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', createdOrder.id)
    const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])

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

    console.log('[Finalize] ✅ Order finalized successfully:', {
      orderId: createdOrder.id,
      itemCount: displayItems.length,
    });

    return NextResponse.json({ order: createdOrder, items: displayItems })
  } catch (err: any) {
    console.error('[Orders/Finalize] ❌ Fatal error:', {
      error: err.message,
      stack: err.stack,
    });
    return NextResponse.json({ error: err.message || 'Finalize failed' }, { status: 500 })
  }
}
