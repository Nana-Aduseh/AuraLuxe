import { NextRequest, NextResponse } from 'next/server'
import { getServerUserAdminStatus } from '@/lib/admin-server'
import { isConfiguredAdminEmail } from '@/lib/admin-config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{
    userId: string
  }>
}

function isMissingColumnError(message: string) {
  return message.toLowerCase().includes('column')
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const sessionClient = await createClient()
  const adminClient = createAdminClient()
  const dataClient = adminClient ?? sessionClient
  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = await getServerUserAdminStatus(dataClient, user)

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await context.params
  const body = await request.json()
  const nextAdminState = body?.isAdmin

  if (typeof nextAdminState !== 'boolean') {
    return NextResponse.json(
      { error: 'Invalid payload' },
      { status: 400 }
    )
  }

  if (userId === user.id && !nextAdminState) {
    return NextResponse.json(
      { error: 'You cannot remove your own admin access.' },
      { status: 400 }
    )
  }

  let { data: targetProfile, error: targetProfileError } = await dataClient
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (targetProfileError && isMissingColumnError(targetProfileError.message)) {
    targetProfile = null
    targetProfileError = null
  }

  if (targetProfileError) {
    return NextResponse.json(
      { error: 'Unable to validate the target account.' },
      { status: 500 }
    )
  }

  if (
    targetProfile?.email &&
    isConfiguredAdminEmail(targetProfile.email) &&
    !nextAdminState
  ) {
    return NextResponse.json(
      { error: 'This account is configured as a protected bootstrap admin.' },
      { status: 400 }
    )
  }

  const { error } = await dataClient
    .from('profiles')
    .update({ is_admin: nextAdminState })
    .eq('id', userId)

  if (error) {
    return NextResponse.json(
      {
        error: adminClient
          ? 'Unable to update admin access'
          : 'Unable to update admin access. Rerun supabase-product-admin-setup.sql to add the profiles policies, or add SUPABASE_SERVICE_ROLE_KEY to .env.local for server-side admin management.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
