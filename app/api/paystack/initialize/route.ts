import { NextRequest, NextResponse } from 'next/server'
import { initializePaystackTransaction } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, amountGhs, callback_url } = body

    if (!email || typeof amountGhs !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const init = await initializePaystackTransaction({ email, amountGhs, callback_url })

    return NextResponse.json({ success: true, data: init })
  } catch (err: any) {
    console.error('Paystack initialize error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
