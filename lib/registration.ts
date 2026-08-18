// Rules shared by the registration form and the registration API route, so the
// hint a user sees while typing and the decision the server makes can't drift
// apart.

export const APPROVED_DOMAINS = ['nhs.net', 'nhs.uk', 'doctors.org.uk']
export const APPROVED_SUFFIX = '.ac.uk'

/** NHS/academic emails identify a UK trainee well enough to skip admin review. */
export function isApprovedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return APPROVED_DOMAINS.includes(domain) || domain.endsWith(APPROVED_SUFFIX)
}

export const MEMBER_CATEGORIES = ['uk', 'international'] as const
export type MemberCategory = (typeof MEMBER_CATEGORIES)[number]

export function isMemberCategory(value: unknown): value is MemberCategory {
  return typeof value === 'string' && (MEMBER_CATEGORIES as readonly string[]).includes(value)
}

/**
 * A UK trainee whose email isn't recognised has nothing tying the account to a
 * doctor, so registration asks for their GMC number instead. International
 * members aren't on the GMC register and are never asked.
 */
export function requiresGmcNumber(category: MemberCategory, email: string): boolean {
  return category === 'uk' && email.includes('@') && !isApprovedDomain(email)
}

/** GMC reference numbers are seven digits. Spaces are tolerated on the way in. */
export function normaliseGmcNumber(value: string): string {
  return value.replace(/\s+/g, '')
}

export function isValidGmcNumber(value: string): boolean {
  return /^\d{7}$/.test(normaliseGmcNumber(value))
}
