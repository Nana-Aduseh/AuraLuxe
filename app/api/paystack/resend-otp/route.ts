import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { reference, method } = await request.json()

    if (!reference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      )
    }

    if (!method || !['sms', 'whatsapp'].includes(method)) {
      return NextResponse.json(
        { error: 'Valid method (sms or whatsapp) is required' },
        { status: 400 }
      )
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY is not set')
      return NextResponse.json(
        { error: 'Payment service configuration error' },
        { status: 500 }
      )
    }

    // Call Paystack API to resend OTP
    const resendUrl = `https://api.paystack.co/transaction/verify/${reference}/resend_otp`

    const resendRes = await fetch(resendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        otp: method === 'whatsapp' ? 'whatsapp' : 'sms',
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Paystack resend OTP error:', resendData)
      return NextResponse.json(
        {
          error:
            resendData.message ||
            `Failed to resend verification code via ${method}`,
        },
        { status: resendRes.status }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: `Verification code sent via ${method === 'whatsapp' ? 'WhatsApp' : 'SMS'}`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Resend OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to resend verification code' },
      { status: 500 }
    )
  }
}
