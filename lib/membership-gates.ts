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

/* ═══════════════════════════════════════════════════════════════════
   VIDEO ARCHIVE
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Months a trainee gets the members-only part of the video archive for free.
 * After this the locked videos still show in the grid — greyed out, with a
 * lock and a prompt to join — so the library stays discoverable.
 */
export const VIDEO_TRIAL_MONTHS = 1

/** Roles that carry full membership, so never sit inside a trial window. */
const FULL_MEMBER_ROLES = ['member', 'editor', 'admin', 'super_admin']

/** created_at + n months, or null when the profile has no created_at. */
function trialEnd(createdAt: string | null, months: number): Date | null {
  if (!createdAt) return null
  const end = new Date(createdAt)
  if (Number.isNaN(end.getTime())) return null
  end.setMonth(end.getMonth() + months)
  return end
}

/**
 * Can this profile play members-only videos?
 *
 * Full members always can. International members always can — they register
 * under member_category 'international' and have no ACPGBI number to upgrade
 * a UK trainee account with, so gating them on role would lock them out with
 * no way back in. UK trainees get VIDEO_TRIAL_MONTHS from sign-up.
 *
 * A profile with no created_at (pre-dating the column) is let through rather
 * than locked out — same fail-open choice the question bank trial makes.
 */
export function hasFullVideoAccess(profile: Profile | null): boolean {
  if (!profile) return false
  if (FULL_MEMBER_ROLES.includes(profile.role)) return true
  if (profile.member_category === 'international') return true
  if (profile.role !== 'trainee') return false

  const end = trialEnd(profile.created_at, VIDEO_TRIAL_MONTHS)
  if (!end) return true

  return new Date() <= end
}

/**
 * Days left on a trainee's video trial, or null when the trial does not
 * apply (full members, international members, missing created_at). 0 once it
 * has run out.
 */
export function getVideoTrialDaysRemaining(profile: Profile | null): number | null {
  if (!profile) return null
  if (FULL_MEMBER_ROLES.includes(profile.role)) return null
  if (profile.member_category === 'international') return null
  if (profile.role !== 'trainee') return null

  const end = trialEnd(profile.created_at, VIDEO_TRIAL_MONTHS)
  if (!end) return null

  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

/**
 * Whether a given video is playable by this profile. Videos flagged
 * is_members_only are the gated ones; everything else is open to any approved
 * account.
 */
export function canAccessVideo(
  profile: Profile | null,
  video: { is_members_only?: boolean | null } | null
): boolean {
  if (!video?.is_members_only) return true
  return hasFullVideoAccess(profile)
}
