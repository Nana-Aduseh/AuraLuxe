import crypto from 'crypto'

export interface PaystackInitPayload {
  email: string
  amountGhs: number
  reference?: string
  callback_url?: string
  orderId?: string
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 1, timeoutMs = 20000) {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error

      if (attempt < retries) {
        continue
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Request to Paystack failed')
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

  const res = await fetchWithRetry('https://api.paystack.co/transaction/initialize', {
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

  const res = await fetchWithRetry(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    },
  )

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
