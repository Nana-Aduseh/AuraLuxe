import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackWebhookSignature } from '@/lib/paystack'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const { reference, customer, amount, status } = data
    if (!reference || status !== 'success') {
      return NextResponse.json({ success: true, message: 'Transaction not successful' })
    }

    const supabase = createAdminClient()

    // Fetch order by payment reference (orderId is stored as reference in Paystack)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', reference)
      .maybeSingle()

    if (orderError || !order) {
      console.error('Order not found:', reference)
      return NextResponse.json({ success: true, message: 'Order not found' })
    }

    // Idempotent: if payment_reference already set, skip update
    if (order.payment_reference) {
      return NextResponse.json({ success: true, message: 'Payment already recorded' })
    }

    // Update order with payment info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_reference: reference,
        status: 'processing',
        confirmation_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reference)

    if (updateError) {
      console.error('Order update failed:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Auto-claim guest orders by email on successful payment
    if (order.guest_email && !order.user_id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', order.guest_email)
          .maybeSingle()

        if (profile) {
          // User exists with this email; claim the order
          await supabase
            .from('orders')
            .update({ user_id: profile.id })
            .eq('id', reference)
        }
      } catch (claimErr) {
        console.error('Guest order auto-claim failed:', claimErr)
        // Continue; order is still updated with payment info
      }
    }

    console.log('Order processed successfully:', reference)
    return NextResponse.json({ success: true, message: 'Order updated' })
  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
