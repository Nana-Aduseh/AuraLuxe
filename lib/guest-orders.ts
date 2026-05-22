'use client'

import { createClient } from '@/lib/supabase/client'

const GUEST_ORDER_ID_KEY = 'aura-luxe-guest-order-id'
const GUEST_ORDER_TOKEN_KEY = 'aura-luxe-guest-order-token'
const GUEST_ORDER_EMAIL_KEY = 'aura-luxe-guest-order-email'

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null
  }

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

export function getStoredGuestOrderToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return (
    window.localStorage.getItem(GUEST_ORDER_TOKEN_KEY) ||
    window.sessionStorage.getItem(GUEST_ORDER_TOKEN_KEY) ||
    readCookie(GUEST_ORDER_TOKEN_KEY)
  )
}

export function persistGuestOrderContext(options: {
  orderId?: string | null
  token?: string | null
  email?: string | null
}) {
  if (typeof window === 'undefined') {
    return
  }

  const { orderId, token, email } = options

  if (orderId) {
    window.localStorage.setItem(GUEST_ORDER_ID_KEY, orderId)
    window.sessionStorage.setItem(GUEST_ORDER_ID_KEY, orderId)
  }

  if (token) {
    window.localStorage.setItem(GUEST_ORDER_TOKEN_KEY, token)
    window.sessionStorage.setItem(GUEST_ORDER_TOKEN_KEY, token)
    document.cookie = `${GUEST_ORDER_TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
  }

  if (email) {
    window.localStorage.setItem(GUEST_ORDER_EMAIL_KEY, email)
    window.sessionStorage.setItem(GUEST_ORDER_EMAIL_KEY, email)
  }
}

export async function claimGuestOrdersAfterAuth(token?: string | null) {
  const supabase = createClient()
  const guestToken = token ?? getStoredGuestOrderToken()

  const { data, error } = await supabase.rpc('claim_guest_orders', {
    p_guest_token: guestToken,
  })

  if (error) {
    throw error
  }

  return data as { claimed_count?: number; orders?: unknown[] }
}

export async function fetchAccessibleOrdersAfterAuth(token?: string | null) {
  const supabase = createClient()
  const guestToken = token ?? getStoredGuestOrderToken()

  const { data, error } = await supabase.rpc('get_customer_orders', {
    p_guest_token: guestToken,
  })

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data.filter((order) => order?.confirmation_status === 'confirmed')
    : []
}