// Shared, client-safe webinar helpers. No secrets, no server-only imports —
// this module is pulled into both the browser bundle and the API routes.

/** events.stream_type value that marks an event as a native Dukes' Live webinar. */
export const WEBINAR_STREAM_TYPE = 'livekit'

export type WebinarStatus = 'scheduled' | 'live' | 'ended' | 'processing' | 'published'
export type RecordingStatus = 'none' | 'recording' | 'uploaded' | 'transferring' | 'done' | 'failed'
export type WebinarRole = 'host' | 'speaker' | 'attendee'
export type SpeakerRole = 'host' | 'speaker' | 'moderator'

export interface WebinarSession {
  id: string
  event_id: string
  room_name: string
  status: WebinarStatus
  started_at: string | null
  ended_at: string | null
  chat_enabled: boolean
  qa_enabled: boolean
  polls_enabled: boolean
  recording_enabled: boolean
  egress_id: string | null
  recording_path: string | null
  recording_status: RecordingStatus
  recording_error: string | null
  vimeo_id: string | null
  recording_video_id: string | null
  peak_attendees: number
}

export interface WebinarSpeaker {
  id: string
  session_id: string
  name: string
  email: string | null
  role: SpeakerRole
  expires_at: string
  invite_sent_at: string | null
  last_joined_at: string | null
  revoked_at: string | null
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string | null
  display_name: string
  is_staff: boolean
  body: string
  is_pinned: boolean
  is_hidden: boolean
  created_at: string
}

export interface WebinarQuestion {
  id: string
  session_id: string
  user_id: string | null
  display_name: string
  body: string
  status: 'open' | 'answered' | 'hidden'
  is_pinned: boolean
  answer_body: string | null
  answer_attachment_url: string | null
  answer_attachment_name: string | null
  answer_attachment_type: 'image' | 'pdf' | 'link' | 'video' | null
  answered_by_name: string | null
  answered_at: string | null
  created_at: string
}

export interface WebinarResource {
  id: string
  session_id: string
  title: string
  description: string | null
  url: string
  kind: 'link' | 'pdf' | 'image' | 'video'
  created_at: string
}

export interface PollOption { id: string; label: string }

export interface WebinarPoll {
  id: string
  session_id: string
  question: string
  options: PollOption[]
  status: 'draft' | 'live' | 'closed'
  allow_multiple: boolean
  results_visible: boolean
  sort_order: number
  launched_at: string | null
  closed_at: string | null
  created_at: string
}

/** Participant metadata carried on the LiveKit token, so tiles can render a
 *  name badge and role chip without a second Supabase round-trip. */
export interface WebinarParticipantMetadata {
  role: WebinarRole
  name: string
  title?: string
  avatarUrl?: string | null
}

/**
 * LiveKit identity conventions. Deterministic per person, which means LiveKit
 * rejects a second tab for the same identity — one seat per person, and the
 * identity doubles as the attendance key.
 *   u:<profile id>  member, attendee or host
 *   g:<invite id>   guest speaker joining by magic link
 */
export const memberIdentity = (userId: string) => `u:${userId}`
export const guestIdentity = (inviteId: string) => `g:${inviteId}`

export function parseIdentity(identity: string): { kind: 'member' | 'guest' | 'other'; id: string | null } {
  if (identity.startsWith('u:')) return { kind: 'member', id: identity.slice(2) }
  if (identity.startsWith('g:')) return { kind: 'guest', id: identity.slice(2) }
  return { kind: 'other', id: null }
}

export function readMetadata(raw: string | undefined): WebinarParticipantMetadata | null {
  if (!raw) return null
  try { return JSON.parse(raw) as WebinarParticipantMetadata } catch { return null }
}

/** Room names must be stable and unique. Derived from the session id. */
export const roomNameForSession = (sessionId: string) => `dukes-webinar-${sessionId}`

/** Is this event configured to run natively on the site? */
export function isNativeWebinar(event: { stream_type?: string | null } | null | undefined): boolean {
  return event?.stream_type === WEBINAR_STREAM_TYPE
}

export const STATUS_LABELS: Record<WebinarStatus, string> = {
  scheduled: 'Scheduled',
  live: 'Live now',
  ended: 'Ended',
  processing: 'Processing recording',
  published: 'Recording available',
}

export const RECORDING_LABELS: Record<RecordingStatus, string> = {
  none: 'Not recorded',
  recording: 'Recording',
  uploaded: 'Saved — awaiting transfer',
  transferring: 'Uploading to Vimeo',
  done: 'Published',
  failed: 'Failed',
}

/** hh:mm:ss elapsed since a start timestamp. */
export function elapsedSince(startedAt: string | null): string {
  if (!startedAt) return '00:00'
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Countdown to a future date, e.g. "2d 4h" / "18m". */
export function countdownTo(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Starting now'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

/** Attachment kind from a filename or MIME type, for Q&A answers and resources. */
export function attachmentKind(file: { type?: string; name?: string }): 'image' | 'pdf' | 'video' | 'link' {
  const t = file.type || ''
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')) return 'pdf'
  return 'link'
}

export const MAX_WEBINAR_UPLOAD = 10 * 1024 * 1024 // 10MB, matching message attachments
