function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getConfiguredAdminEmails() {
  const rawValue = process.env.ADMIN_EMAILS ?? ''

  return rawValue
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
}

export function isConfiguredAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false
  }

  return getConfiguredAdminEmails().includes(normalizeEmail(email))
}
