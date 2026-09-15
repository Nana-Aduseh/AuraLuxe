const TXTCONNECT_API_URL =
  process.env.TXTCONNECT_API_URL || 'https://api.txtconnect.net/dev/api/sms/send'

function normalizeGhanaPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('233')) {
    return digits
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `233${digits.slice(1)}`
  }

  return digits
}

export async function sendTxtConnectSms(to: string, message: string) {
  const apiKey = process.env.TXTCONNECT_API_KEY
  const senderId = process.env.TXTCONNECT_SENDER_ID

  if (!apiKey || !senderId) {
    console.warn('[TXTConnect] SMS not sent: credentials are not configured')
    return { sent: false, reason: 'not_configured' as const }
  }

  const normalizedPhone = normalizeGhanaPhone(to)
  if (!normalizedPhone || normalizedPhone.length < 10) {
    console.warn('[TXTConnect] SMS not sent: invalid phone number')
    return { sent: false, reason: 'invalid_phone' as const }
  }

  const response = await fetch(TXTCONNECT_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: normalizedPhone,
      from: senderId,
      unicode: false,
      sms: message,
    }),
  })

  const payload = await response.json().catch(() => null)
  const statusCode = payload?.data?.status_code
  const successful = response.ok && (!statusCode || statusCode === '000')

  if (!successful) {
    throw new Error(
      payload?.data?.reason || payload?.msg || 'TXTConnect rejected the SMS',
    )
  }

  return {
    sent: true,
    messageId: payload?.messageId || null,
  }
}