import { NextRequest, NextResponse } from 'next/server'
import { initializePaystackTransaction } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, amountGhs, callback_url, orderId } = body

    if (!email || typeof amountGhs !== 'number' || !orderId) {
      return NextResponse.json({ error: 'Missing required fields: email, amountGhs, orderId' }, { status: 400 })
    }

    // Use orderId as Paystack reference for idempotent handling
    const reference = orderId

    const init = await initializePaystackTransaction({
      email,
      amountGhs,
      reference,
      callback_url: callback_url || `${new URL(request.url).origin}/order-confirmation/${orderId}`,
    })

    return NextResponse.json({ success: true, data: init })
  } catch (err: any) {
    console.error('Paystack initialize error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
