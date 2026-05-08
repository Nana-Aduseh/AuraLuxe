import type { SupabaseClient, User } from '@supabase/supabase-js'

export function hasAdminMetadata(user: User | null | undefined) {
  if (!user) {
    return false
  }

  return Boolean(user.user_metadata?.is_admin || user.app_metadata?.is_admin)
}

export async function getUserAdminStatus(
  supabase: SupabaseClient,
  user: User | null | undefined
) {
  if (!user) {
    return false
  }

  if (hasAdminMetadata(user)) {
    return true
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to load admin status from profiles:', error)
    return false
  }

  return data?.is_admin === true
}
