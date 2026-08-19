import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, resolveSpeakerToken } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The guest-speaker data plane.
 *
 * A guest has no auth.users row, so Supabase RLS cannot admit them and
 * Realtime is not available to them. (Signing them in anonymously would work
 * technically but would hand them the whole member directory, because
 * profiles_select_authenticated is USING (true).) So: a service-role route
 * keyed by the invite token, which the speaker page polls. One speaker
 * polling every few seconds is negligible load.
 *
 * GET  /api/webinars/speaker?t=<token>   → session state, Q&A, chat
 * POST /api/webinars/speaker             → post a chat message or answer a question
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const rawToken = request.nextUrl.searchParams.get('t')

  const speaker = await resolveSpeakerToken(supabase, rawToken)
  if (!speaker) {
    return NextResponse.json({ error: 'invalid_invite' }, { status: 401 })
  }

  const [sessionRes, questionsRes, chatRes, pollsRes, resourcesRes] = await Promise.all([
    supabase
      .from('webinar_sessions')
      .select('id, event_id, status, chat_enabled, qa_enabled, polls_enabled, started_at, recording_status')
      .eq('id', speaker.session_id)
      .single(),
    supabase
      .from('webinar_questions')
      .select('*')
      .eq('session_id', speaker.session_id)
      .neq('status', 'hidden')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('webinar_chat_messages')
      .select('*')
      .eq('session_id', speaker.session_id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })
      .limit(300),
    supabase
      .from('webinar_polls')
      .select('*')
      .eq('session_id', speaker.session_id)
      .neq('status', 'draft')
      .order('sort_order', { ascending: true }),
    supabase
      .from('webinar_resources')
      .select('*')
      .eq('session_id', speaker.session_id)
      .order('created_at', { ascending: false }),
  ])

  const polls = pollsRes.data ?? []

  return NextResponse.json({
    speaker: { id: speaker.id, name: speaker.name, role: speaker.role },
    session: sessionRes.data,
    questions: questionsRes.data ?? [],
    chat: chatRes.data ?? [],
    polls,
    results: await pollResults(supabase, polls.map((p: any) => p.id)),
    resources: resourcesRes.data ?? [],
  })
}

/**
 * Per-poll tallies for the speaker's sidebar.
 *
 * The speaker previously received no results at all, so every bar read 0% —
 * they could see that a poll was running but never its outcome.
 *
 * This route is service-role, so it could read anything; it deliberately
 * returns only counts, never who voted for what. That keeps the same guarantee
 * members get from the webinar_poll_results SECURITY DEFINER function, which
 * exists precisely so a tally never exposes an individual vote.
 */
async function pollResults(
  supabase: SupabaseClient,
  pollIds: string[]
): Promise<Record<string, { counts: Record<string, number>; voters: number; myVote: null }>> {
  if (pollIds.length === 0) return {}

  const { data: votes } = await supabase
    .from('webinar_poll_votes')
    .select('poll_id, option_ids')
    .in('poll_id', pollIds)

  const out: Record<string, { counts: Record<string, number>; voters: number; myVote: null }> = {}
  for (const id of pollIds) out[id] = { counts: {}, voters: 0, myVote: null }

  for (const vote of votes ?? []) {
    const bucket = out[vote.poll_id]
    if (!bucket) continue
    bucket.voters += 1
    for (const optionId of vote.option_ids ?? []) {
      bucket.counts[optionId] = (bucket.counts[optionId] ?? 0) + 1
    }
  }

  return out
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const speaker = await resolveSpeakerToken(supabase, body.inviteToken)
  if (!speaker) {
    return NextResponse.json({ error: 'invalid_invite' }, { status: 401 })
  }

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('id, status, chat_enabled, qa_enabled')
    .eq('id', speaker.session_id)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // ── Chat message ─────────────────────────────────────────────────
  if (body.action === 'chat') {
    if (!session.chat_enabled) {
      return NextResponse.json({ error: 'Chat is disabled' }, { status: 409 })
    }
    const text = (body.body || '').trim()
    if (!text) return NextResponse.json({ error: 'Message is empty' }, { status: 400 })

    const { error } = await supabase.from('webinar_chat_messages').insert({
      session_id: session.id,
      user_id: null,          // guests have no profile row
      display_name: speaker.name,
      is_staff: true,         // renders with the gold speaker badge
      body: text.slice(0, 2000),
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Answer a question ────────────────────────────────────────────
  if (body.action === 'answer') {
    if (!body.questionId) {
      return NextResponse.json({ error: 'questionId required' }, { status: 400 })
    }
    const text = (body.body || '').trim()
    if (!text && !body.attachmentUrl) {
      return NextResponse.json({ error: 'An answer or attachment is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('webinar_questions')
      .update({
        answer_body: text || null,
        answer_attachment_url: body.attachmentUrl || null,
        answer_attachment_name: body.attachmentName || null,
        answer_attachment_type: body.attachmentType || null,
        answered_by_name: speaker.name,
        answered_at: new Date().toISOString(),
        status: 'answered',
      })
      .eq('id', body.questionId)
      .eq('session_id', session.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
