import { NextResponse } from 'next/server'
import { getServerUserAdminStatus } from '@/lib/admin-server'
import { listAdminManagedProfiles, syncUserProfile } from '@/lib/profile'
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

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const users = await listAdminManagedProfiles(dataClient)

    return NextResponse.json({
      currentUserId: user.id,
      users,
    })
  } catch {
    return NextResponse.json(
      {
        error: adminClient
          ? 'Unable to load admin users'
          : 'Unable to load admin users. Rerun supabase-product-admin-setup.sql to add the profiles policies, or add SUPABASE_SERVICE_ROLE_KEY to .env.local for server-side admin management.',
      },
      { status: 500 }
    )
  }
}
