import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { syncUserProfile } from '@/lib/profile'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dataClient = createAdminClient() ?? supabase
  const synced = await syncUserProfile(dataClient, user)

  if (!synced) {
    return NextResponse.json(
      { error: 'Unable to sync profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
