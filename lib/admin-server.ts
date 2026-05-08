import type { SupabaseClient, User } from '@supabase/supabase-js'
import { hasAdminMetadata } from '@/lib/admin'
import { isConfiguredAdminEmail } from '@/lib/admin-config'

export async function getServerUserAdminStatus(
  supabase: SupabaseClient,
  user: User | null | undefined
) {
  if (!user) {
    return false
  }

  if (hasAdminMetadata(user) || isConfiguredAdminEmail(user.email)) {
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
