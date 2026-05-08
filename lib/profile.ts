import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isConfiguredAdminEmail } from '@/lib/admin-config'

export interface AdminManagedProfile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  is_admin: boolean
}

const PROFILE_SELECT_WITH_CONTACT = 'id, name, email, phone, is_admin'
const PROFILE_SELECT_BASIC = 'id, name, is_admin'

function isMissingColumnError(message: string) {
  return message.toLowerCase().includes('column')
}

function getProfileName(user: User) {
  const metadataName = user.user_metadata?.name

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim()
  }

  if (user.email) {
    return user.email.split('@')[0]
  }

  return 'Customer'
}

function mapProfileRow(row: Record<string, unknown>): AdminManagedProfile {
  return {
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : null,
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    is_admin: row.is_admin === true,
  }
}

export function dedupeProfilesById(profiles: AdminManagedProfile[]) {
  const profilesById = new Map<string, AdminManagedProfile>()

  for (const profile of profiles) {
    const existing = profilesById.get(profile.id)

    if (!existing) {
      profilesById.set(profile.id, profile)
      continue
    }

    profilesById.set(profile.id, {
      id: profile.id,
      name: existing.name || profile.name,
      email: existing.email || profile.email,
      phone: existing.phone || profile.phone,
      is_admin: existing.is_admin || profile.is_admin,
    })
  }

  return Array.from(profilesById.values())
}

export async function syncUserProfile(
  supabase: SupabaseClient,
  user: User
) {
  const shouldBeAdmin = isConfiguredAdminEmail(user.email)
  const basePayload = {
    id: user.id,
    name: getProfileName(user),
    is_admin: shouldBeAdmin,
  }

  const fullPayload = {
    ...basePayload,
    email: user.email ?? null,
    phone:
      typeof user.user_metadata?.phone === 'string'
        ? user.user_metadata.phone
        : null,
  }

  let { error } = await supabase
    .from('profiles')
    .upsert(fullPayload, { onConflict: 'id' })

  if (error && isMissingColumnError(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .upsert(basePayload, { onConflict: 'id' })

    error = fallback.error
  }

  if (error) {
    console.error('Failed to sync profile:', error)
    return false
  }

  return true
}

export async function listAdminManagedProfiles(supabase: SupabaseClient) {
  let { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_WITH_CONTACT)

  if (error && isMissingColumnError(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_BASIC)

    data = fallback.data
    error = fallback.error
  }

  if (error) {
    console.error('Failed to load profiles:', error)
    throw error
  }

  return dedupeProfilesById(
    ((data ?? []) as Record<string, unknown>[])
    .map(mapProfileRow)
    .sort((a, b) => {
      if (a.is_admin !== b.is_admin) {
        return a.is_admin ? -1 : 1
      }

      return (a.name || a.email || a.id).localeCompare(
        b.name || b.email || b.id
      )
    })
  )
}
