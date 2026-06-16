import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaystackTransaction } from '@/lib/paystack'

// Prevent Next.js from caching this route so it always fetches fresh data
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client missing' }, { status: 500 })
    }

    // 1. Fetch ALL successful transactions from the last 30 days directly from Paystack
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    let allTransactions: any[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await fetch(`https://api.paystack.co/transaction?status=success&perPage=100&page=${page}&from=${fromDate}`, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      })

      const paystackData = await response.json()
      if (!paystackData.status) {
        throw new Error('Failed to fetch transactions from Paystack')
      }

      const transactions = paystackData.data || []
      allTransactions = allTransactions.concat(transactions)

      if (transactions.length < 100) {
        hasMore = false // We reached the last page!
      } else {
        page++ // There are more than 100, fetch the next page!
      }
    }

    // 2. Parse metadata and extract the correct payment reference for each transaction
    const transactionsToCheck = allTransactions.map((tx: any) => {
      let metadata = tx.metadata || {}
      if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata) } catch (e) {}
      }
      
      // Use custom checkout_reference from metadata if available (matches your webhook logic)
      const paymentReference = metadata.checkout_reference || tx.reference
      
      return { ...tx, parsedMetadata: metadata, paymentReference }
    })

    const referencesToCheck = transactionsToCheck.map((tx: any) => tx.paymentReference)

    // 3. Query Supabase to see which of these references already exist
    const { data: existingOrders, error: dbError } = await supabase
      .from('orders')
      .select('id, payment_reference, completed_at')
      .in('payment_reference', referencesToCheck)

    if (dbError) throw dbError

    const existingOrdersMap = new Map(existingOrders?.map(o => [o.payment_reference, o]) || [])
    
    const missingTransactions = []
    const timeUpdates = []

    // Filter down to missing transactions AND catch existing transactions with wrong times
    for (const tx of transactionsToCheck) {
      const existingOrder = existingOrdersMap.get(tx.paymentReference)
      const paystackTime = tx.paidAt || tx.paid_at || tx.transaction_date || tx.createdAt || tx.created_at

      if (!existingOrder) {
        missingTransactions.push(tx)
      } else if (paystackTime) {
        // Compare timestamps. If the difference is more than 1 minute, it's the wrong time!
        const dbTimeMs = new Date(existingOrder.completed_at || existingOrder.created_at || 0).getTime()
        const payTimeMs = new Date(paystackTime).getTime()

        if (Number.isNaN(dbTimeMs) || Math.abs(dbTimeMs - payTimeMs) > 60000) {
          timeUpdates.push({ id: existingOrder.id, correctTime: paystackTime })
        }
      }
    }

    let updatedTimeCount = 0
    for (const update of timeUpdates) {
      await supabase.from('orders').update({ completed_at: update.correctTime }).eq('id', update.id)
      updatedTimeCount++
    }

    if (missingTransactions.length === 0 && updatedTimeCount === 0) {
      console.log('[Paystack Sync] All 50 recent orders are synced. Nothing to do.')
      return NextResponse.json({ message: 'All synced. No missing orders or incorrect timestamps found.', synced: 0, updated: 0 })
    }

    console.log(`[Paystack Sync] Found ${missingTransactions.length} missing orders. Beginning recovery...`)
    let recoveredCount = 0

    // 4. Recover the missing orders!
    for (const tx of missingTransactions) {
      // Call our verify method to ensure we get the fully un-truncated metadata
      const verify = await verifyPaystackTransaction(tx.reference)
      if (!verify?.data) continue

      const payData = verify.data
      let metadata = payData.metadata || {}
      if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata) } catch (e) {}
      }

      const cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : []
      // We removed the 'continue' here! If Paystack drops the metadata, 
      // we STILL want to create the order so you can see it and contact the customer.

      const totalAmount = Number(metadata.total_amount ?? payData.amount / 100)
      const guestInfo = metadata.guest_info || {}

      // Create the Order
      const { data: createdOrder, error: createError } = await supabase
        .from('orders')
        .insert({
          user_id: metadata?.user_id || null,
          total_amount: totalAmount,
          status: 'processing',
          payment_reference: tx.paymentReference,
          order_type: metadata?.delivery_type === 'pickup' ? 'pickup' : 'delivery',
          confirmation_status: 'confirmed',
          completed_at: payData.paidAt || payData.paid_at || payData.transaction_date || payData.createdAt || payData.created_at || tx.paidAt || tx.paid_at || tx.createdAt || tx.created_at || new Date().toISOString(),
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

      if (createError || !createdOrder) continue

      // Add all cart items
      for (const item of cartItems) {
        await supabase.from('order_items').insert({
          order_id: createdOrder.id,
          product_id: item.product_id,
          color_id: item.color_id || null,
          quantity_id: item.quantity_id || null,
          quantity_ordered: Number(item.quantity_ordered || 1),
          price_at_purchase: Number(item.price_at_purchase || 0),
        })
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

      recoveredCount++
    }

    return NextResponse.json({ 
      message: 'Sync complete', 
      foundMissing: missingTransactions.length, 
      recovered: recoveredCount,
      updatedTimestamps: updatedTimeCount 
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
