import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaystackTransaction } from '@/lib/paystack'
import { enrichOrderItemsForDisplay } from '@/lib/order-item-display'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { reference, token } = body
    const looksLikeUuid = typeof reference === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
      console.error('Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing)')
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    // First, check if an order already exists for this payment reference or id
    const { data: existingByRef, error: refErr } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle()

    const { data: existingById, error: idErr } = existingByRef || !looksLikeUuid
      ? { data: null, error: null }
      : await supabase
          .from('orders')
          .select('*')
          .eq('id', reference)
          .maybeSingle()

    if (refErr || idErr) {
      console.error('Order lookup failed:', refErr || idErr)
      return NextResponse.json({ error: 'Order lookup failed' }, { status: 500 })
    }

    const existingOrder = existingByRef || existingById

    if (existingOrder && existingOrder.confirmation_status === 'confirmed') {
      // Already confirmed, return it idempotently
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', existingOrder.id)
      const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])
      return NextResponse.json({ order: existingOrder, items: displayItems })
    }

    // Verify transaction with Paystack to ensure it's actually successful
    const verify = await verifyPaystackTransaction(reference)
    const payData = verify?.data
    if (!payData || payData.status !== 'success') {
      return NextResponse.json({ error: 'Transaction not successful' }, { status: 400 })
    }

    const metadata = (payData.metadata || {}) as any
    const cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : []
    const totalAmount = Number(metadata.total_amount ?? Number(payData.amount) / 100)

    if (existingOrder) {
      // Update existing order to confirmed
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_reference: reference,
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
      const { data: freshOrder } = await supabase.from('orders').select('*').eq('id', existingOrder.id).maybeSingle()
      const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])
      return NextResponse.json({ order: freshOrder || existingOrder, items: displayItems })
    }

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Missing checkout metadata' }, { status: 400 })
    }

    const guestInfo = metadata.guest_info || {}
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
      return NextResponse.json({ error: createError?.message || 'Order creation failed' }, { status: 500 })
    }

    // Insert order items and reduce stock only after the payment is verified
    for (const item of cartItems) {
      const quantityOrdered = Number(item.quantity_ordered || 1)
      const priceAtPurchase = Number(item.price_at_purchase || 0)

      let { error: itemError } = await supabase.from('order_items').insert({
        order_id: createdOrder.id,
        product_id: item.product_id,
        color_id: item.color_id || null,
        quantity_id: item.quantity_id || null,
        quantity_ordered: quantityOrdered,
        price_at_purchase: priceAtPurchase,
      })

      if (itemError) {
        const legacyInsert = await supabase.from('order_items').insert({
          order_id: createdOrder.id,
          product_id: item.product_id,
          color_id: item.color_id || null,
          quantity_id: item.quantity_id || null,
          quantity: quantityOrdered,
          price: priceAtPurchase,
        })
        itemError = legacyInsert.error
      }

      if (itemError) console.error('Order item insert error:', itemError)

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
        }
      }
    }

    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', createdOrder.id)
    const displayItems = await enrichOrderItemsForDisplay(supabase, items || [])

    // Attempt to auto-claim guest order to a profile if email exists
    if (createdOrder.guest_email && !createdOrder.user_id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', createdOrder.guest_email)
          .maybeSingle()

        if (profile) {
          await supabase.from('orders').update({ user_id: profile.id }).eq('id', createdOrder.id)
        }
      } catch (claimErr) {
        console.error('Guest order auto-claim failed:', claimErr)
      }
    }

    return NextResponse.json({ order: createdOrder, items: displayItems })
  } catch (err: any) {
    console.error('Finalize endpoint error:', err)
    return NextResponse.json({ error: err.message || 'Finalize failed' }, { status: 500 })
  }
}
