import crypto from 'crypto'

export interface PaystackInitPayload {
  email: string
  amountGhs: number
  reference?: string
  callback_url?: string
  orderId?: string
}

export async function initializePaystackTransaction(payload: PaystackInitPayload) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured')

  const body = {
    email: payload.email,
    amount: Math.round((payload.amountGhs || 0) * 100), // amount in Kobo
    reference: payload.reference,
    callback_url: payload.callback_url,
  }

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to initialize Paystack transaction')
  }

  return res.json()
}

export async function verifyPaystackTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured')

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to verify Paystack transaction')
  }

  return res.json()
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured')

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}
