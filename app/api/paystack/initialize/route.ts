import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, amountGhs, callback_url, reference, metadata, firstname, lastname, phone } = body

    if (!email || typeof amountGhs !== 'number' || !reference) {
      return NextResponse.json({ error: 'Missing required fields: email, amountGhs, reference' }, { status: 400 })
    }

    const actualCallbackUrl = callback_url || `${new URL(request.url).origin}/order-confirmation/${reference}`;
    console.log('[Paystack/Initialize] Request:', { email, amountGhs, reference, callbackUrl: actualCallbackUrl });

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountGhs * 100),
        reference,
        callback_url: actualCallbackUrl,
        metadata,
        firstname,
        lastname,
        phone,
        currency: 'GHS',
        channels: ['card', 'mobile_money'],
      }),
    });

    const init = await paystackRes.json();

    if (!paystackRes.ok) {
      throw new Error(init.message || 'Paystack initialization failed');
    }

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
