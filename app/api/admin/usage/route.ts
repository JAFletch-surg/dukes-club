import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminRequest } from '@/lib/supabase/admin-request'
import type {
  DailyActivity, TopMember, TopVideo, TopWebinar, UsageSummary,
} from '@/lib/admin/usage-types'
import { USAGE_RANGES } from '@/lib/admin/usage-types'

const PAGE = 1000
const MAX_PAGES = 200
const USERS_PER_PAGE = 1000
const MAX_USER_PAGES = 50
const TOP_N = 10
const TOP_MEMBERS_N = 25

type Row = Record<string, unknown>

/**
 * Read every row of a table, paging in chunks of 1000. Supabase caps a single
 * select at 1000 rows by default, so a one-shot select would silently truncate
 * the figures as the tables grow.
 */
async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  warnings: string[],
  gte?: [column: string, value: string]
): Promise<Row[]> {
  const rows: Row[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase.from(table).select(columns).range(page * PAGE, page * PAGE + PAGE - 1)
    if (gte) query = query.gte(gte[0], gte[1])
    const { data, error } = await query
    if (error) {
      console.error(`[usage] ${table}:`, error.message)
      warnings.push(`${table}: ${error.message}`)
      return rows
    }
    const batch = (data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

/** Count rows created on or after `since`; null when the table can't be read. */
async function countSince(
  supabase: SupabaseClient,
  table: string,
  since: string,
  warnings: string[],
  column = 'created_at'
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .gte(column, since)
  if (error) {
    console.error(`[usage] count ${table}:`, error.message)
    warnings.push(`${table}: ${error.message}`)
    return null
  }
  return count ?? 0
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const dayKey = (iso: string) => iso.slice(0, 10)
const minutes = (seconds: number) => Math.round(seconds / 60)

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request, ['super_admin'])
  if (!auth.ok) return auth.response
  const { supabase } = auth

  const requested = Number(request.nextUrl.searchParams.get('range'))
  const rangeDays = (USAGE_RANGES as readonly number[]).includes(requested) ? requested : 30
  const now = new Date()
  const sinceDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000)
  const since = sinceDate.toISOString()
  const inRange = (iso: string | null) => !!iso && iso >= since

  const warnings: string[] = []

  try {
    // ── Members ───────────────────────────────────────────────────────────
    const authUsers = new Map<string, { createdAt: string | null; lastSignIn: string | null; confirmed: boolean }>()
    for (let page = 1; page <= MAX_USER_PAGES; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
      if (error) {
        warnings.push(`auth users: ${error.message}`)
        break
      }
      const users = data?.users ?? []
      for (const u of users) {
        authUsers.set(u.id, {
          createdAt: u.created_at ?? null,
          lastSignIn: u.last_sign_in_at ?? null,
          confirmed: !!u.email_confirmed_at,
        })
      }
      if (users.length < USERS_PER_PAGE) break
    }

    const [
      profiles, watchRows, videos, questionSessions, attendance, sessions, bookings,
    ] = await Promise.all([
      fetchAll(supabase, 'profiles', 'id, full_name, email, region, country, approval_status, created_at', warnings),
      fetchAll(supabase, 'video_watch_progress', 'user_id, video_id, watched_seconds, duration_seconds, completed, last_watched_at, created_at', warnings),
      fetchAll(supabase, 'videos', 'id, title', warnings),
      fetchAll(supabase, 'question_sessions', 'user_id, total_questions, correct_answers, percentage, created_at', warnings),
      fetchAll(supabase, 'webinar_attendance', 'user_id, session_id, joined_at, seconds_watched', warnings),
      fetchAll(supabase, 'webinar_sessions', 'id, event_id, events(title)', warnings),
      fetchAll(supabase, 'event_bookings', 'user_id, status, created_at', warnings, ['created_at', since]),
    ])

    const [chatMessages, webinarQuestions, certificates, messages, feedback] = await Promise.all([
      countSince(supabase, 'webinar_chat_messages', since, warnings),
      countSince(supabase, 'webinar_questions', since, warnings),
      countSince(supabase, 'event_certificates', since, warnings),
      countSince(supabase, 'messages', since, warnings),
      countSince(supabase, 'site_feedback_responses', since, warnings),
    ])

    const profileById = new Map(profiles.map((p) => [String(p.id), p]))
    const videoTitle = new Map(videos.map((v) => [String(v.id), str(v.title) ?? 'Untitled video']))
    const sessionTitle = new Map(
      sessions.map((s) => {
        const ev = s.events as { title?: string } | { title?: string }[] | null
        const title = Array.isArray(ev) ? ev[0]?.title : ev?.title
        return [String(s.id), title ?? 'Webinar']
      })
    )

    // Per-member accumulators, keyed by user id.
    const memberActivity = new Map<string, Omit<TopMember, 'id' | 'name' | 'email' | 'region' | 'lastSignIn'>>()
    const touch = (userId: string) => {
      let m = memberActivity.get(userId)
      if (!m) {
        m = { videosWatched: 0, videoMinutes: 0, questionSessions: 0, questionsAnswered: 0, webinarMinutes: 0 }
        memberActivity.set(userId, m)
      }
      return m
    }

    // Daily buckets covering the whole range, oldest first.
    const daily = new Map<string, DailyActivity>()
    for (let d = new Date(sinceDate); d <= now; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = dayKey(d.toISOString())
      daily.set(key, { date: key, videos: 0, questions: 0, webinars: 0, bookings: 0 })
    }
    const bump = (iso: string | null, field: keyof Omit<DailyActivity, 'date'>) => {
      if (!iso) return
      const bucket = daily.get(dayKey(iso))
      if (bucket) bucket[field] += 1
    }

    // ── Videos ────────────────────────────────────────────────────────────
    // watched_seconds is the playhead position the member reached, not an
    // accumulated stopwatch, so "minutes" is the position reached per video.
    let minutesAllTime = 0, minutesInRange = 0, watchedInRange = 0, startedInRange = 0
    let completedInRange = 0, completedAllTime = 0
    const viewersInRange = new Set<string>()
    const perVideo = new Map<string, TopVideo>()

    for (const r of watchRows) {
      const userId = str(r.user_id) ?? ''
      const videoId = str(r.video_id) ?? ''
      const seconds = num(r.watched_seconds)
      const lastWatched = str(r.last_watched_at)
      const created = str(r.created_at)
      const completed = r.completed === true

      minutesAllTime += seconds
      if (completed) completedAllTime += 1

      if (inRange(lastWatched)) {
        watchedInRange += 1
        minutesInRange += seconds
        viewersInRange.add(userId)
        if (completed) completedInRange += 1
        bump(lastWatched, 'videos')

        const tv = perVideo.get(videoId) ?? {
          id: videoId, title: videoTitle.get(videoId) ?? 'Untitled video', viewers: 0, minutes: 0, completions: 0,
        }
        tv.viewers += 1
        tv.minutes += seconds
        if (completed) tv.completions += 1
        perVideo.set(videoId, tv)

        const m = touch(userId)
        m.videosWatched += 1
        m.videoMinutes += seconds
      }
      if (inRange(created)) startedInRange += 1
    }

    const topVideos = [...perVideo.values()]
      .map((v) => ({ ...v, minutes: minutes(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes || b.viewers - a.viewers)
      .slice(0, TOP_N)

    // ── Question bank ─────────────────────────────────────────────────────
    let sessionsInRange = 0, answeredInRange = 0, percentageSum = 0, percentageCount = 0
    let sessionsAllTime = 0, answeredAllTime = 0
    const questionUsers = new Set<string>()
    for (const s of questionSessions) {
      const created = str(s.created_at)
      const total = num(s.total_questions)
      sessionsAllTime += 1
      answeredAllTime += total
      if (!inRange(created)) continue
      const userId = str(s.user_id) ?? ''
      sessionsInRange += 1
      answeredInRange += total
      questionUsers.add(userId)
      if (typeof s.percentage === 'number') {
        percentageSum += s.percentage
        percentageCount += 1
      }
      bump(created, 'questions')
      const m = touch(userId)
      m.questionSessions += 1
      m.questionsAnswered += total
    }

    // ── Webinars ──────────────────────────────────────────────────────────
    let attendancesInRange = 0, webinarSeconds = 0
    const attendees = new Set<string>()
    const perSession = new Map<string, TopWebinar>()
    for (const a of attendance) {
      const joined = str(a.joined_at)
      if (!inRange(joined)) continue
      const userId = str(a.user_id) ?? ''
      const sessionId = str(a.session_id) ?? ''
      const seconds = num(a.seconds_watched)
      attendancesInRange += 1
      webinarSeconds += seconds
      attendees.add(userId)
      bump(joined, 'webinars')

      const tw = perSession.get(sessionId) ?? {
        sessionId, title: sessionTitle.get(sessionId) ?? 'Webinar', attendees: 0, minutes: 0,
      }
      tw.attendees += 1
      tw.minutes += seconds
      perSession.set(sessionId, tw)

      touch(userId).webinarMinutes += seconds
    }
    const topWebinars = [...perSession.values()]
      .map((w) => ({ ...w, minutes: minutes(w.minutes) }))
      .sort((a, b) => b.attendees - a.attendees || b.minutes - a.minutes)
      .slice(0, TOP_N)

    // ── Events ────────────────────────────────────────────────────────────
    const byStatus: Record<string, number> = {}
    for (const b of bookings) {
      const status = str(b.status) ?? 'unknown'
      byStatus[status] = (byStatus[status] ?? 0) + 1
      bump(str(b.created_at), 'bookings')
      const userId = str(b.user_id)
      if (userId) touch(userId)
    }

    // ── Members summary ───────────────────────────────────────────────────
    let approved = 0, newInRange = 0
    for (const p of profiles) {
      if (p.approval_status === 'approved') approved += 1
      if (inRange(str(p.created_at))) newInRange += 1
    }
    let signedInInRange = 0, neverSignedIn = 0, unverifiedEmail = 0
    const activeIds = new Set<string>(memberActivity.keys())
    for (const [id, u] of authUsers) {
      if (!u.confirmed) unverifiedEmail += 1
      if (!u.lastSignIn) neverSignedIn += 1
      if (inRange(u.lastSignIn)) {
        signedInInRange += 1
        activeIds.add(id)
      }
    }

    const topMembers: TopMember[] = [...memberActivity.entries()]
      .map(([id, m]) => {
        const p = profileById.get(id)
        return {
          id,
          name: str(p?.full_name) ?? 'Unknown member',
          email: str(p?.email),
          region: str(p?.region) ?? str(p?.country),
          videosWatched: m.videosWatched,
          videoMinutes: minutes(m.videoMinutes),
          questionSessions: m.questionSessions,
          questionsAnswered: m.questionsAnswered,
          webinarMinutes: minutes(m.webinarMinutes),
          lastSignIn: authUsers.get(id)?.lastSignIn ?? null,
        }
      })
      .sort((a, b) =>
        (b.videoMinutes + b.webinarMinutes + b.questionsAnswered) -
        (a.videoMinutes + a.webinarMinutes + a.questionsAnswered))
      .slice(0, TOP_MEMBERS_N)

    const summary: UsageSummary = {
      generatedAt: now.toISOString(),
      rangeDays,
      members: {
        total: profiles.length,
        approved,
        newInRange,
        signedInInRange,
        activeInRange: activeIds.size,
        neverSignedIn,
        unverifiedEmail,
      },
      videos: {
        minutesAllTime: minutes(minutesAllTime),
        minutesInRange: minutes(minutesInRange),
        watchedInRange,
        startedInRange,
        completedInRange,
        completedAllTime,
        uniqueViewersInRange: viewersInRange.size,
        top: topVideos,
      },
      questions: {
        sessionsInRange,
        questionsAnsweredInRange: answeredInRange,
        uniqueUsersInRange: questionUsers.size,
        avgPercentageInRange: percentageCount > 0 ? Math.round(percentageSum / percentageCount) : null,
        sessionsAllTime,
        questionsAnsweredAllTime: answeredAllTime,
      },
      webinars: {
        attendancesInRange,
        uniqueAttendeesInRange: attendees.size,
        minutesInRange: minutes(webinarSeconds),
        chatMessagesInRange: chatMessages,
        questionsAskedInRange: webinarQuestions,
        top: topWebinars,
      },
      events: {
        bookingsInRange: bookings.length,
        byStatus,
        certificatesInRange: certificates,
      },
      messaging: {
        messagesInRange: messages,
        feedbackResponsesInRange: feedback,
      },
      daily: [...daily.values()],
      topMembers,
      warnings,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[usage] failed:', error)
    return NextResponse.json({ error: 'Failed to build usage summary' }, { status: 500 })
  }
}
