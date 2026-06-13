import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackTransaction, submitPaystackOTP } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reference, otp } = body

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    // If OTP is provided, submit it
    if (otp) {
      const result = await submitPaystackOTP(reference, otp)
      return NextResponse.json({ success: true, data: result })
    }

    // Otherwise, verify the transaction normally
    const result = await verifyPaystackTransaction(reference)
    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('Paystack verify error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
