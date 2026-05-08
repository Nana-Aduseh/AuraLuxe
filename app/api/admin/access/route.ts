import { NextResponse } from 'next/server'
import { getServerUserAdminStatus } from '@/lib/admin-server'
import { syncUserProfile } from '@/lib/profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const sessionClient = await createClient()
  const adminClient = createAdminClient()
  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dataClient = adminClient ?? sessionClient
  await syncUserProfile(dataClient, user)
  const isAdmin = await getServerUserAdminStatus(dataClient, user)

  return NextResponse.json({
    isAdmin,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  })
}
