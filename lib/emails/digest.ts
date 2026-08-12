// Content selection for the member round-up digest.
//
// The sender fetches one shared pool of events + posts per run, then narrows
// that pool per member according to their preferences. Keeping the selection
// pure (everything below `fetchDigestPool` takes data, not a client) means the
// admin preview and the real send agree on what a member would receive.

import type { SupabaseClient } from '@supabase/supabase-js'

export type DigestFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'never'

// Days between digests. 28 rather than 30 for "monthly" so every cadence lands
// on a whole number of weekly cron runs — see docs/admin/digest.md.
export const FREQUENCY_DAYS: Record<Exclude<DigestFrequency, 'never'>, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 28,
}

export const FREQUENCY_LABELS: Record<DigestFrequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Every two weeks',
  monthly: 'Every four weeks',
  never: 'Never',
}

// A run that fires late shouldn't push a member's digest out to the next run,
// so a member counts as due slightly before the exact interval elapses. This
// also absorbs Vercel's Hobby-plan behaviour of invoking a cron at any point
// within its scheduled hour. Deliberately well under half a day: with a larger
// window a *daily* cron would send a "weekly" digest a day earlier each time
// until it drifted into a different cadence entirely.
const DUE_GRACE_HOURS = 12

// A member who has never been sent a digest (or who has been dormant) should
// not receive six months of back-catalogue in one email.
const MAX_LOOKBACK_DAYS = 60

// How far ahead the events section looks, by cadence.
const EVENT_HORIZON_DAYS: Record<Exclude<DigestFrequency, 'never'>, number> = {
  weekly: 60,
  fortnightly: 75,
  monthly: 105,
}

const MAX_EVENTS = 4
const MAX_POSTS = 5
const MAX_VIDEOS = 3

const DAY_MS = 24 * 60 * 60 * 1000

export interface DigestPreferences {
  user_id: string
  frequency: DigestFrequency
  include_events: boolean
  include_news: boolean
  include_videos: boolean
  news_categories: string[]
  unsubscribe_token: string
  last_sent_at: string | null
}

export interface DigestEvent {
  id: string
  title: string
  slug: string | null
  startsAt: string
  endsAt: string | null
  location: string | null
  eventType: string | null
  imageUrl: string | null
  summary: string | null
  /** Announced since this member's last digest — worth a "just announced" flag. */
  isNew: boolean
}

export interface DigestPost {
  id: string
  title: string
  slug: string | null
  category: string | null
  publishedAt: string
  excerpt: string | null
  imageUrl: string | null
  authorName: string | null
}

export interface DigestVideo {
  id: string
  title: string
  slug: string | null
  category: string | null
  publishedAt: string
  thumbnailUrl: string | null
  durationSeconds: number | null
  speaker: string | null
}

/** Pool entries carry the admin's running order; the selection drops back to
 *  the plain types, since the extra property is harmless to the template. */
type Ranked<T> = T & { digestRank: number | null }

export interface DigestPool {
  events: Array<Ranked<Omit<DigestEvent, 'isNew'>> & { createdAt: string | null }>
  posts: Array<Ranked<DigestPost>>
  videos: Array<Ranked<DigestVideo>>
}

export interface DigestSelection {
  events: DigestEvent[]
  posts: DigestPost[]
  videos: DigestVideo[]
  /** Start of the "what's new" window this digest covers. */
  windowStart: Date
  isEmpty: boolean
}

/**
 * Order a section for the email: items an admin has pinned lead it, in the
 * order they set, and everything else keeps the order it arrived in (by date).
 *
 * Relies on Array.prototype.sort being stable, which it is in every engine we
 * run on — that is what preserves the date ordering among unpinned items
 * without having to re-sort by date here.
 */
function byRankThenDate<T extends { digestRank: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.digestRank ?? Infinity) - (b.digestRank ?? Infinity))
}

function toPlainSummary(value: string | null | undefined, maxLength = 180): string | null {
  if (!value) return null
  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  if (collapsed.length <= maxLength) return collapsed
  // Trim at a word boundary so the ellipsis doesn't land mid-word.
  const cut = collapsed.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength - 30 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * True when enough time has passed since this member's last digest.
 * `never` is always false; a member who has never been sent one is always due.
 */
export function isDue(prefs: Pick<DigestPreferences, 'frequency' | 'last_sent_at'>, now = new Date()): boolean {
  if (prefs.frequency === 'never') return false
  if (!prefs.last_sent_at) return true

  const last = new Date(prefs.last_sent_at).getTime()
  if (Number.isNaN(last)) return true

  const intervalMs = FREQUENCY_DAYS[prefs.frequency] * DAY_MS - DUE_GRACE_HOURS * 60 * 60 * 1000
  return now.getTime() - last >= intervalMs
}

/** A member with no content types enabled has effectively opted out. */
export function isSubscribed(
  prefs: Pick<DigestPreferences, 'frequency' | 'include_events' | 'include_news' | 'include_videos'>
): boolean {
  return prefs.frequency !== 'never' && (prefs.include_events || prefs.include_news || prefs.include_videos)
}

/**
 * Fetch the shared pool of candidate content for a digest run: every upcoming
 * published event, and every post and video published inside the longest window
 * any member could be owed. Narrowed per member by `selectForMember`.
 *
 * Each section is put into its final running order here — once per run rather
 * than once per member — so the admin's pinned items lead and everything else
 * stays in date order beneath them.
 */
export async function fetchDigestPool(supabase: SupabaseClient, now = new Date()): Promise<DigestPool> {
  const horizon = new Date(now.getTime() + Math.max(...Object.values(EVENT_HORIZON_DAYS)) * DAY_MS)
  const lookback = new Date(now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS)

  const [eventsResult, postsResult, videosResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, starts_at, ends_at, location, event_type, featured_image_url, description_plain, created_at, digest_rank')
      .eq('status', 'published')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', horizon.toISOString())
      .order('starts_at', { ascending: true })
      .limit(30),
    supabase
      .from('posts')
      .select('id, title, slug, category, published_at, excerpt, content_plain, featured_image_url, author_name, digest_rank')
      .eq('status', 'published')
      .gte('published_at', lookback.toISOString())
      .lte('published_at', now.toISOString())
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('videos')
      .select('id, title, slug, category, published_at, thumbnail_url, duration_seconds, speaker, digest_rank')
      .eq('status', 'published')
      .gte('published_at', lookback.toISOString())
      .lte('published_at', now.toISOString())
      .order('published_at', { ascending: false })
      .limit(30),
  ])

  if (eventsResult.error) throw new Error(`Failed to load events: ${eventsResult.error.message}`)
  if (postsResult.error) throw new Error(`Failed to load posts: ${postsResult.error.message}`)
  if (videosResult.error) throw new Error(`Failed to load videos: ${videosResult.error.message}`)

  return {
    events: byRankThenDate((eventsResult.data || []).map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      location: e.location,
      eventType: e.event_type,
      imageUrl: e.featured_image_url,
      summary: toPlainSummary(e.description_plain, 140),
      createdAt: e.created_at,
      digestRank: e.digest_rank,
    }))),
    posts: byRankThenDate((postsResult.data || []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      publishedAt: p.published_at,
      excerpt: toPlainSummary(p.excerpt || p.content_plain),
      imageUrl: p.featured_image_url,
      authorName: p.author_name,
      digestRank: p.digest_rank,
    }))),
    videos: byRankThenDate((videosResult.data || []).map((v) => ({
      id: v.id,
      title: v.title,
      slug: v.slug,
      category: v.category,
      publishedAt: v.published_at,
      thumbnailUrl: v.thumbnail_url,
      durationSeconds: v.duration_seconds,
      speaker: v.speaker,
      digestRank: v.digest_rank,
    }))),
  }
}

/**
 * Narrow the pool to what this member should actually receive.
 *
 * News is windowed — only what was published since their last digest (capped
 * at 60 days, so a new or dormant member gets a sensible sample rather than
 * the archive). Events are forward-looking instead: the next few coming up
 * inside a horizon scaled to their cadence, so a monthly subscriber still sees
 * things far enough ahead to book.
 */
export function selectForMember(pool: DigestPool, prefs: DigestPreferences, now = new Date()): DigestSelection {
  const frequency = prefs.frequency === 'never' ? 'weekly' : prefs.frequency
  const earliest = new Date(now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS)

  const lastSent = prefs.last_sent_at ? new Date(prefs.last_sent_at) : null
  const defaultStart = new Date(now.getTime() - FREQUENCY_DAYS[frequency] * DAY_MS)
  const candidateStart = lastSent && !Number.isNaN(lastSent.getTime()) ? lastSent : defaultStart
  const windowStart = candidateStart < earliest ? earliest : candidateStart

  const categories = prefs.news_categories || []

  const posts = prefs.include_news
    ? pool.posts
        .filter((p) => {
          if (!p.publishedAt || new Date(p.publishedAt) <= windowStart) return false
          // An empty category list means "everything".
          return categories.length === 0 || (p.category != null && categories.includes(p.category))
        })
        .slice(0, MAX_POSTS)
    : []

  // Videos are windowed like news rather than shown as a standing "recent"
  // list, so nobody is sent the same video twice.
  const videos = prefs.include_videos
    ? pool.videos
        .filter((v) => !!v.publishedAt && new Date(v.publishedAt) > windowStart)
        .slice(0, MAX_VIDEOS)
    : []

  const eventHorizon = new Date(now.getTime() + EVENT_HORIZON_DAYS[frequency] * DAY_MS)

  const events = prefs.include_events
    ? pool.events
        .filter((e) => new Date(e.startsAt) <= eventHorizon)
        .slice(0, MAX_EVENTS)
        .map(({ createdAt, ...event }) => ({
          ...event,
          isNew: !!createdAt && new Date(createdAt) > windowStart,
        }))
    : []

  return {
    events,
    posts,
    videos,
    windowStart,
    isEmpty: events.length === 0 && posts.length === 0 && videos.length === 0,
  }
}
