import type { Profile } from '@/lib/auth-provider'

const IN_PERSON_EVENT_TYPES = ['In Person Course', 'Practical Workshop', 'Conference', 'Hybrid']

/**
 * Check if a trainee's 3-month question bank trial has expired.
 * Returns false for full members (member, editor, admin, super_admin).
 */
export function isQuestionBankTrialExpired(profile: Profile | null): boolean {
  if (!profile) return true
  if (profile.role !== 'trainee') return false
  if (!profile.created_at) return false

  const createdAt = new Date(profile.created_at)
  const trialEnd = new Date(createdAt)
  trialEnd.setMonth(trialEnd.getMonth() + 3)

  return new Date() > trialEnd
}

/**
 * Get days remaining on the question bank trial.
 * Returns null for non-trainees.
 */
export function getTrialDaysRemaining(profile: Profile | null): number | null {
  if (!profile || profile.role !== 'trainee' || !profile.created_at) return null

  const createdAt = new Date(profile.created_at)
  const trialEnd = new Date(createdAt)
  trialEnd.setMonth(trialEnd.getMonth() + 3)

  const remaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return Math.max(0, remaining)
}

/**
 * Check if a trainee can book an event based on event type.
 * Trainees cannot book in-person events — only full members can.
 */
export function canBookEvent(profile: Profile | null, eventType: string | null): boolean {
  if (!profile) return false
  if (profile.role !== 'trainee') return true
  if (!eventType) return true

  return !IN_PERSON_EVENT_TYPES.includes(eventType)
}
