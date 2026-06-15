import crypto from 'crypto'

export interface PaystackInitPayload {
  email: string
  amountGhs: number
  reference?: string
  callback_url?: string
  orderId?: string
  metadata?: Record<string, unknown>
  firstname?: string
  lastname?: string
  phone?: string
  currency?: string
  channels?: string[]
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 1, timeoutMs = 30000) {
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
    metadata: payload.metadata,
    firstname: payload.firstname,
    lastname: payload.lastname,
    phone: payload.phone,
    currency: payload.currency || 'GHS',
    channels: payload.channels || ['card', 'mobile_money'],
  }

  console.log('[Paystack/Lib] Sending initialize request:', { 
    amount: body.amount, 
    reference: body.reference,
    email: body.email,
    hasSecret: !!secret,
  });

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
    console.error('[Paystack/Lib] Initialize failed:', {
      status: res.status,
      statusText: res.statusText,
      response: text.substring(0, 500),
    });
    throw new Error(text || 'Failed to initialize Paystack transaction')
  }

  const data = await res.json();
  console.log('[Paystack/Lib] Initialize succeeded:', {
    status: data.status,
    message: data.message,
    hasData: !!data.data,
    dataKeys: data.data ? Object.keys(data.data) : [],
    authUrlExists: !!data.data?.authorization_url,
  });

  return data
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

export async function submitPaystackOTP(reference: string, otp: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured')

  const res = await fetchWithRetry(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}/submit_otp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'Failed to submit OTP')
  }

  return res.json()
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not configured')

  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  return hash === signature
}
