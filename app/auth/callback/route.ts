import { createClient } from '@/lib/supabase/server'
import { syncUserProfile } from '@/lib/profile'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await syncUserProfile(supabase, user)
        const guestToken = request.cookies.get('aura-luxe-guest-order-token')?.value ?? null

        try {
          await supabase.rpc('claim_guest_orders', {
            p_guest_token: guestToken,
          })
        } catch (error) {
          console.error('Failed to claim guest orders:', error)
        }
      }

      const response = NextResponse.redirect(`${origin}${next}`)
      response.cookies.set('aura-luxe-guest-order-token', '', {
        path: '/',
        maxAge: 0,
      })

      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
