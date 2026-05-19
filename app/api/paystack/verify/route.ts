import { NextRequest, NextResponse } from 'next/server'
import { verifyPaystackTransaction } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reference } = body

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
    }

    const result = await verifyPaystackTransaction(reference)
    return NextResponse.json({ success: true, data: result })
  } catch (err: any) {
    console.error('Paystack verify error', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
