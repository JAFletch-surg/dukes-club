// Executes a digest run: works out who is due, builds each member's email,
// sends the batch and records the outcome.
//
// Lives here rather than in the route so the scheduled entry point
// (/api/digest/cron) and the manual one (/api/digest/send) share exactly one
// implementation — a cron that drifts from the button in the admin panel is
// the kind of bug nobody notices until members complain.

import type { SupabaseClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { digestEmail } from './digest-template'
import {
  fetchDigestPool,
  isDue,
  isSubscribed,
  selectForMember,
  type DigestPreferences,
} from './digest'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'

// Resend accepts up to 100 emails per batch call.
const BATCH_SIZE = 100

// Belt and braces against a double send: even if last_sent_at failed to write,
// a member who already got a digest this recently is skipped.
const RECENT_SEND_HOURS = 20

export function manageUrl(token: string): string {
  return `${SITE_URL}/email-preferences?token=${encodeURIComponent(token)}`
}

export function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/email-preferences?token=${encodeURIComponent(token)}&unsubscribe=1`
}

interface Recipient {
  prefs: DigestPreferences
  email: string
  name: string
}

interface OutgoingEmail {
  from: string
  to: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export interface RunDigestOptions {
  /** Ignore each member's cadence and send to every subscriber. */
  force?: boolean
  /** Report who would receive what; send nothing, write nothing. */
  dryRun?: boolean
  /** Restrict the run to these members. */
  userIds?: string[]
}

export interface RunDigestResult {
  subscribers: number
  due: number
  sent: number
  failed: number
  skippedEmpty: number
  skippedRecent: number
  dryRun?: boolean
  /** Dry runs only: how many members would have been emailed. */
  wouldSend?: number
  recipients?: Array<{ email: string; frequency: string; eventCount: number; postCount: number }>
}

/** Load every subscriber's preferences alongside the profile fields we need. */
async function loadRecipients(supabase: SupabaseClient, userIds?: string[]): Promise<Recipient[]> {
  let query = supabase
    .from('digest_preferences')
    .select('user_id, frequency, include_events, include_news, news_categories, unsubscribe_token, last_sent_at')
    .neq('frequency', 'never')

  if (userIds?.length) query = query.in('user_id', userIds)

  const { data: prefs, error } = await query
  if (error) throw new Error(`Failed to load digest preferences: ${error.message}`)
  if (!prefs?.length) return []

  // digest_preferences references auth.users, not profiles, so PostgREST has no
  // relationship to embed — the profile rows are fetched and joined here.
  const profilesById = new Map<string, { email: string | null; full_name: string | null; approval_status: string | null }>()

  for (let i = 0; i < prefs.length; i += 200) {
    const chunk = prefs.slice(i, i + 200).map((p) => p.user_id)
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, approval_status')
      .in('id', chunk)

    if (profileError) throw new Error(`Failed to load profiles: ${profileError.message}`)
    for (const profile of data || []) profilesById.set(profile.id, profile)
  }

  const recipients: Recipient[] = []
  for (const preference of prefs as DigestPreferences[]) {
    const profile = profilesById.get(preference.user_id)
    // Only approved members with an address on file. A pending or rejected
    // account has no members' area to be pointed at.
    if (!profile?.email || profile.approval_status !== 'approved') continue
    recipients.push({ prefs: preference, email: profile.email, name: profile.full_name || 'there' })
  }

  return recipients
}

/** User IDs that already received a digest inside the guard window. */
async function recentlySent(supabase: SupabaseClient, userIds: string[], now: Date): Promise<Set<string>> {
  const seen = new Set<string>()
  if (!userIds.length) return seen

  const since = new Date(now.getTime() - RECENT_SEND_HOURS * 60 * 60 * 1000).toISOString()

  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await supabase
      .from('digest_sends')
      .select('user_id')
      .eq('status', 'sent')
      .gte('sent_at', since)
      .in('user_id', userIds.slice(i, i + 200))

    if (error) throw new Error(`Failed to check recent sends: ${error.message}`)
    for (const row of data || []) seen.add(row.user_id)
  }

  return seen
}

/**
 * Hand a chunk to Resend's batch endpoint, falling back to individual sends if
 * the batch call fails, so one rejected payload can't sink the whole run.
 * Returns a provider id (or an error) per email, positionally.
 */
async function sendChunk(chunk: OutgoingEmail[]): Promise<Array<{ id: string | null; error: string | null }>> {
  try {
    const { data, error } = await resend.batch.send(chunk)

    if (!error) {
      const sent = (data as { data?: Array<{ id?: string }> } | null)?.data
      return chunk.map((_, index) => ({ id: sent?.[index]?.id ?? null, error: null }))
    }
    console.error('[digest] batch send failed, falling back to individual sends:', error)
  } catch (err: any) {
    console.error('[digest] batch send threw, falling back to individual sends:', err?.message || err)
  }

  const results: Array<{ id: string | null; error: string | null }> = []
  for (const email of chunk) {
    try {
      const { data, error } = await resend.emails.send(email)
      results.push({ id: data?.id ?? null, error: error ? error.message : null })
    } catch (err: any) {
      results.push({ id: null, error: err?.message || 'Send failed' })
    }
  }
  return results
}

/**
 * Send a single sample digest — built from default preferences against the
 * live content pool — to one address. Writes nothing, so it never affects a
 * real member's cadence.
 */
export async function sendTestDigest(
  supabase: SupabaseClient,
  to: string,
  now = new Date()
): Promise<{ id: string | null; eventCount: number; postCount: number }> {
  const pool = await fetchDigestPool(supabase, now)
  const samplePrefs: DigestPreferences = {
    user_id: 'preview',
    frequency: 'weekly',
    include_events: true,
    include_news: true,
    news_categories: [],
    unsubscribe_token: 'preview-token',
    last_sent_at: null,
  }

  const selection = selectForMember(pool, samplePrefs, now)
  const email = digestEmail({
    name: 'there',
    frequency: 'weekly',
    events: selection.events,
    posts: selection.posts,
    siteUrl: SITE_URL,
    manageUrl: manageUrl(samplePrefs.unsubscribe_token),
    unsubscribeUrl: unsubscribeUrl(samplePrefs.unsubscribe_token),
    issueDate: now,
  })

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[Test] ${email.subject}`,
    html: email.html,
    text: email.text,
  })

  if (error) throw new Error(error.message)
  return { id: data?.id ?? null, eventCount: selection.events.length, postCount: selection.posts.length }
}

export async function runDigest(
  supabase: SupabaseClient,
  options: RunDigestOptions = {},
  now = new Date()
): Promise<RunDigestResult> {
  const { force = false, dryRun = false, userIds } = options

  const pool = await fetchDigestPool(supabase, now)
  const recipients = await loadRecipients(supabase, userIds)
  const due = recipients.filter((r) => isSubscribed(r.prefs) && (force || isDue(r.prefs, now)))

  const guard = dryRun ? new Set<string>() : await recentlySent(supabase, due.map((r) => r.prefs.user_id), now)

  const outgoing: OutgoingEmail[] = []
  const queued: Array<{ recipient: Recipient; eventCount: number; postCount: number }> = []
  const skippedEmpty: string[] = []
  let skippedRecent = 0

  for (const recipient of due) {
    if (guard.has(recipient.prefs.user_id)) {
      skippedRecent++
      continue
    }

    const selection = selectForMember(pool, recipient.prefs, now)

    // Nothing to say. Deliberately does not touch last_sent_at, so whatever is
    // published next still falls inside their window.
    if (selection.isEmpty) {
      skippedEmpty.push(recipient.prefs.user_id)
      continue
    }

    const email = digestEmail({
      name: recipient.name,
      frequency: recipient.prefs.frequency,
      events: selection.events,
      posts: selection.posts,
      siteUrl: SITE_URL,
      manageUrl: manageUrl(recipient.prefs.unsubscribe_token),
      unsubscribeUrl: unsubscribeUrl(recipient.prefs.unsubscribe_token),
      issueDate: now,
    })

    outgoing.push({
      from: FROM_EMAIL,
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: {
        // Gmail and Outlook surface these as a native unsubscribe control,
        // which keeps opt-outs away from the spam button. RFC 8058.
        'List-Unsubscribe': `<${SITE_URL}/api/digest/unsubscribe?token=${encodeURIComponent(recipient.prefs.unsubscribe_token)}>, <mailto:info@thedukesclub.org.uk?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List=One-Click',
      },
    })
    queued.push({ recipient, eventCount: selection.events.length, postCount: selection.posts.length })
  }

  if (dryRun) {
    return {
      dryRun: true,
      subscribers: recipients.length,
      due: due.length,
      sent: 0,
      failed: 0,
      skippedEmpty: skippedEmpty.length,
      skippedRecent,
      wouldSend: queued.length,
      recipients: queued.map((q) => ({
        email: q.recipient.email,
        frequency: q.recipient.prefs.frequency,
        eventCount: q.eventCount,
        postCount: q.postCount,
      })),
    }
  }

  let sent = 0
  let failed = 0
  const logRows: Array<Record<string, unknown>> = []
  const sentUserIds: string[] = []

  for (let i = 0; i < outgoing.length; i += BATCH_SIZE) {
    const chunk = outgoing.slice(i, i + BATCH_SIZE)
    const results = await sendChunk(chunk)

    results.forEach((result, index) => {
      const { recipient, eventCount, postCount } = queued[i + index]
      const ok = !result.error

      if (ok) {
        sent++
        sentUserIds.push(recipient.prefs.user_id)
      } else {
        failed++
        console.error(`[digest] send failed for ${recipient.email}:`, result.error)
      }

      logRows.push({
        user_id: recipient.prefs.user_id,
        frequency: recipient.prefs.frequency,
        event_count: eventCount,
        post_count: postCount,
        status: ok ? 'sent' : 'failed',
        provider_message_id: result.id,
        error: result.error,
      })
    })
  }

  for (const userId of skippedEmpty) {
    logRows.push({ user_id: userId, status: 'skipped_empty', event_count: 0, post_count: 0 })
  }

  if (logRows.length) {
    const { error: logError } = await supabase.from('digest_sends').insert(logRows)
    if (logError) console.error('[digest] failed to write send log:', logError.message)
  }

  // Only successful sends advance the window — a failure leaves the member due
  // again on the next run with the same content still unseen.
  for (let i = 0; i < sentUserIds.length; i += 200) {
    const { error: updateError } = await supabase
      .from('digest_preferences')
      .update({ last_sent_at: now.toISOString() })
      .in('user_id', sentUserIds.slice(i, i + 200))

    if (updateError) console.error('[digest] failed to update last_sent_at:', updateError.message)
  }

  return {
    subscribers: recipients.length,
    due: due.length,
    sent,
    failed,
    skippedEmpty: skippedEmpty.length,
    skippedRecent,
  }
}
