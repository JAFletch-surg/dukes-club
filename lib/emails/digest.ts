// Content selection for the member round-up digest.
//
// The sender fetches one shared pool of events, posts and videos per run, then
// narrows that pool per member according to their preferences. Keeping the selection
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

/**
 * Pool entries carry the admin's curation; the selection drops back to the
 * plain types, since the extra property is harmless to the template.
 *
 * A non-null `digestRank` means an admin chose this item for the next issue.
 * Chosen items lead their section in rank order and are sent to every
 * subscriber of that section, whether or not they have seen them before.
 */
type Ranked<T> = T & { digestRank: number | null }

/** Whether each section tops itself up automatically beneath the chosen items. */
export interface DigestSettings {
  eventsAutofill: boolean
  postsAutofill: boolean
  videosAutofill: boolean
}

export const DEFAULT_DIGEST_SETTINGS: DigestSettings = {
  eventsAutofill: true,
  postsAutofill: true,
  videosAutofill: true,
}

export interface DigestPool {
  events: Array<Ranked<Omit<DigestEvent, 'isNew'>> & { createdAt: string | null }>
  posts: Array<Ranked<DigestPost>>
  videos: Array<Ranked<DigestVideo>>
  settings: DigestSettings
}

export interface DigestSelection {
  events: DigestEvent[]
  posts: DigestPost[]
  videos: DigestVideo[]
  /** Start of the "what's new" window this digest covers. */
  windowStart: Date
  isEmpty: boolean
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
 * published event, every post and video published inside the longest window any
 * member could be owed, plus anything an admin has explicitly chosen and the
 * per-section auto-fill settings. Narrowed per member by `selectForMember`.
 */
export async function fetchDigestPool(supabase: SupabaseClient, now = new Date()): Promise<DigestPool> {
  const horizon = new Date(now.getTime() + Math.max(...Object.values(EVENT_HORIZON_DAYS)) * DAY_MS)
  const lookback = new Date(now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS)

  // Chosen rows are pulled in regardless of the date window — an admin
  // featuring a six-month-old video must not have it silently dropped for
  // falling outside the automatic lookback. `nullsFirst: false` then keeps
  // those rows at the front, so they survive the row limit too.
  const [eventsResult, postsResult, videosResult, settingsResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, starts_at, ends_at, location, event_type, featured_image_url, description_plain, created_at, digest_rank')
      .eq('status', 'published')
      .gte('starts_at', now.toISOString())
      .or(`starts_at.lte.${horizon.toISOString()},digest_rank.not.is.null`)
      .order('digest_rank', { ascending: true, nullsFirst: false })
      .order('starts_at', { ascending: true })
      .limit(30),
    supabase
      .from('posts')
      .select('id, title, slug, category, published_at, excerpt, content_plain, featured_image_url, author_name, digest_rank')
      .eq('status', 'published')
      .lte('published_at', now.toISOString())
      .or(`published_at.gte.${lookback.toISOString()},digest_rank.not.is.null`)
      .order('digest_rank', { ascending: true, nullsFirst: false })
      .order('published_at', { ascending: false })
      .limit(50),
    supabase
      .from('videos')
      .select('id, title, slug, category, published_at, thumbnail_url, duration_seconds, speaker, digest_rank')
      .eq('status', 'published')
      .lte('published_at', now.toISOString())
      .or(`published_at.gte.${lookback.toISOString()},digest_rank.not.is.null`)
      .order('digest_rank', { ascending: true, nullsFirst: false })
      .order('published_at', { ascending: false })
      .limit(30),
    supabase
      .from('digest_settings')
      .select('events_autofill, posts_autofill, videos_autofill')
      .maybeSingle(),
  ])

  if (eventsResult.error) throw new Error(`Failed to load events: ${eventsResult.error.message}`)
  if (postsResult.error) throw new Error(`Failed to load posts: ${postsResult.error.message}`)
  if (videosResult.error) throw new Error(`Failed to load videos: ${videosResult.error.message}`)

  // A missing settings row means "nothing configured yet" — fall back to
  // topping every section up automatically rather than sending nothing.
  const settings: DigestSettings = settingsResult.data
    ? {
        eventsAutofill: settingsResult.data.events_autofill,
        postsAutofill: settingsResult.data.posts_autofill,
        videosAutofill: settingsResult.data.videos_autofill,
      }
    : DEFAULT_DIGEST_SETTINGS

  return {
    events: (eventsResult.data || []).map((e) => ({
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
    })),
    posts: (postsResult.data || []).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      publishedAt: p.published_at,
      excerpt: toPlainSummary(p.excerpt || p.content_plain),
      imageUrl: p.featured_image_url,
      authorName: p.author_name,
      digestRank: p.digest_rank,
    })),
    videos: (videosResult.data || []).map((v) => ({
      id: v.id,
      title: v.title,
      slug: v.slug,
      category: v.category,
      publishedAt: v.published_at,
      thumbnailUrl: v.thumbnail_url,
      durationSeconds: v.duration_seconds,
      speaker: v.speaker,
      digestRank: v.digest_rank,
    })),
    settings,
  }
}

/** Split a section into what an admin chose and what may fill in beneath. */
function partition<T extends { digestRank: number | null }>(items: T[]): { chosen: T[]; automatic: T[] } {
  return {
    chosen: items.filter((i) => i.digestRank != null).sort((a, b) => (a.digestRank as number) - (b.digestRank as number)),
    automatic: items.filter((i) => i.digestRank == null),
  }
}

/**
 * Narrow the pool to what this member should actually receive.
 *
 * Each section is assembled the same way: items an admin chose lead it, then —
 * if that section's auto-fill is on — the remaining slots are topped up
 * automatically.
 *
 * The two halves follow different rules on purpose:
 *
 *  - **Chosen items always send.** They ignore the per-member "only what's new
 *    since your last digest" window entirely, which is what makes choosing an
 *    override rather than a hint. Curating three videos means everyone gets
 *    those three, not a per-member subset of them.
 *  - **Automatic items are windowed.** News and videos only appear if published
 *    since that member's last digest (capped at 60 days, so a new or dormant
 *    member gets a sample rather than the archive). Events are forward-looking
 *    instead: those coming up inside a horizon scaled to their cadence, so a
 *    monthly subscriber still sees things far enough ahead to book.
 *
 * A member's own preferences still win over an admin's choice: a section they
 * switched off stays empty, and a category filter still applies to chosen
 * posts. Overriding those would break a promise made to the member.
 */
export function selectForMember(pool: DigestPool, prefs: DigestPreferences, now = new Date()): DigestSelection {
  const frequency = prefs.frequency === 'never' ? 'weekly' : prefs.frequency
  const earliest = new Date(now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS)

  const lastSent = prefs.last_sent_at ? new Date(prefs.last_sent_at) : null
  const defaultStart = new Date(now.getTime() - FREQUENCY_DAYS[frequency] * DAY_MS)
  const candidateStart = lastSent && !Number.isNaN(lastSent.getTime()) ? lastSent : defaultStart
  const windowStart = candidateStart < earliest ? earliest : candidateStart

  const categories = prefs.news_categories || []
  const inChosenCategories = (category: string | null) =>
    categories.length === 0 || (category != null && categories.includes(category))

  // ── News
  const postParts = partition(pool.posts)
  const posts = prefs.include_news
    ? [
        ...postParts.chosen.filter((p) => inChosenCategories(p.category)),
        ...(pool.settings.postsAutofill
          ? postParts.automatic.filter(
              (p) => !!p.publishedAt && new Date(p.publishedAt) > windowStart && inChosenCategories(p.category)
            )
          : []),
      ].slice(0, MAX_POSTS)
    : []

  // ── Videos
  const videoParts = partition(pool.videos)
  const videos = prefs.include_videos
    ? [
        ...videoParts.chosen,
        ...(pool.settings.videosAutofill
          ? videoParts.automatic.filter((v) => !!v.publishedAt && new Date(v.publishedAt) > windowStart)
          : []),
      ].slice(0, MAX_VIDEOS)
    : []

  // ── Events
  const eventHorizon = new Date(now.getTime() + EVENT_HORIZON_DAYS[frequency] * DAY_MS)
  const eventParts = partition(pool.events)
  const events = prefs.include_events
    ? [
        ...eventParts.chosen,
        ...(pool.settings.eventsAutofill
          ? eventParts.automatic.filter((e) => new Date(e.startsAt) <= eventHorizon)
          : []),
      ]
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
