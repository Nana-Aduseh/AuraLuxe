import { NextRequest, NextResponse } from 'next/server'
import { initializePaystackTransaction } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, amountGhs, callback_url, reference, metadata, firstname, lastname, phone } = body

    if (!email || typeof amountGhs !== 'number' || !reference) {
      return NextResponse.json({ error: 'Missing required fields: email, amountGhs, reference' }, { status: 400 })
    }

    console.log('[Paystack/Initialize] Request:', { email, amountGhs, reference, callbackUrl: callback_url });

    const init = await initializePaystackTransaction({
      email,
      amountGhs,
      reference,
      callback_url: callback_url || `${new URL(request.url).origin}/order-confirmation/${reference}`,
      metadata,
      firstname,
      lastname,
      phone,
      currency: 'GHS',
      channels: ['card', 'mobile_money'],
    })

    console.log('[Paystack/Initialize] Response received:', {
      status: init.status,
      message: init.message,
      hasData: !!init.data,
      dataKeys: init.data ? Object.keys(init.data) : [],
    });

    return NextResponse.json({ success: true, data: init })
  } catch (err: any) {
    console.error('Paystack initialize error:', {
      message: err.message,
      stack: err.stack,
    })
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
