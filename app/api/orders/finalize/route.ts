import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { enrichOrderItemsForDisplay } from '@/lib/order-item-display'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { reference, token } = body

    console.log('[Finalize] Starting order finalization:', { reference, hasToken: !!token });

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      console.error('Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing)')
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    // Check if an order already exists for this payment reference
    const { data: existingOrders, error: refErr } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_reference', reference)

    if (refErr) {
      console.error('Order lookup failed:', refErr)
      return NextResponse.json({ error: 'Order lookup failed' }, { status: 500 })
    }

    const existingOrder = existingOrders?.[0]

    if (existingOrder) {
      console.log('[Finalize] ✅ Order already exists:', { orderId: existingOrder.id, confirmationStatus: existingOrder.confirmation_status });
      // Order already exists, return it idempotently
      if (existingOrder.confirmation_status === 'confirmed') {
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', existingOrder.id)
        const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])
        return NextResponse.json({ order: existingOrder, items: displayItems })
      }
      
      // Update existing order with fresh payment verification
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'processing',
          confirmation_status: 'not_confirmed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id)

      if (updateError) {
        console.error('Order update failed:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', existingOrder.id)
      const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])
      return NextResponse.json({ order: existingOrder, items: displayItems })
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
    
    if (!payData || payData.status !== 'success') {
      console.error('[Finalize] ❌ Payment not successful', { 
        reference, 
        paystackStatus: payData?.status,
        checkoutReference: payData?.metadata?.checkout_reference,
      });
      return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
    }

    const metadata = (payData.metadata || {}) as any
    const cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : []
    const totalAmount = Number(metadata.total_amount ?? Number(payData.amount) / 100)

    if (existingOrder) {
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

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Missing checkout metadata' }, { status: 400 })
    }

    console.log(`[Orders/Finalize] Processing payment reference: ${reference}`);
    console.log(`[Orders/Finalize] Cart items count: ${cartItems.length}`);
    console.log(`[Orders/Finalize] Cart items details:`, cartItems);
    console.log(`[Orders/Finalize] Guest info:`, metadata.guest_info);

    const guestInfo = metadata.guest_info || {}

    // Create ONE order for the entire payment (with multiple order_items inside)
    console.log(`[Orders/Finalize] Creating single order for all ${cartItems.length} items`, {
      totalAmount,
      deliveryType: metadata.delivery_type,
      guestPhone: guestInfo.phone,
      guestAddress: guestInfo.address,
    });

    const { data: createdOrder, error: createError } = await supabase
      .from('orders')
      .insert({
        user_id: metadata.user_id || null,
        total_amount: totalAmount,
        status: 'processing',
        payment_reference: reference,
        order_type: metadata.delivery_type === 'pickup' ? 'pickup' : 'delivery',
        confirmation_status: 'not_confirmed',
        completed_at: new Date().toISOString(),
        guest_access_token: metadata.guest_token || null,
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
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
    
    console.log(`[Orders/Finalize] Order created successfully:`, {
      orderId: createdOrder.id,
      totalAmount,
      itemCount: cartItems.length,
    });

    // Add all cart items as order_items for this single order
    for (const item of cartItems) {
      const quantityOrdered = Number(item.quantity_ordered || 1)
      const priceAtPurchase = Number(item.price_at_purchase || 0)

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
        console.log(`[Orders/Finalize] Order item added to order ${createdOrder.id}: product=${item.product_id}`);
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
            .update({ stock_quantity: Math.max(0, colorData.stock_quantity - quantityOrdered) })
            .eq('id', item.color_id)
          console.log(`[Orders/Finalize] Decremented stock for color ${item.color_id} by ${quantityOrdered}`);
        }
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
      totalAmount: createdOrder.total_amount,
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
