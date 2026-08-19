'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  ChatMessage,
  WebinarQuestion,
  WebinarPoll,
  WebinarResource,
  WebinarSession,
} from '@/lib/webinars'

export interface PollResults {
  /** option id → vote count */
  counts: Record<string, number>
  voters: number
  /** the option ids this user picked, if any */
  myVote: string[] | null
}

interface Options {
  sessionId: string | null
  userId: string | null
  enabled?: boolean
}

/**
 * One hook owning every Supabase channel a live webinar needs.
 *
 * Video goes over LiveKit; everything else goes over Postgres + Realtime. That
 * split is deliberate: attendee tokens have canPublishData:false, so LiveKit
 * data channels could not carry attendee chat anyway, and keeping it in
 * Postgres means it survives reconnects, can be moderated, and is still there
 * next to the recording afterwards.
 *
 * All the subscriptions live on a single channel to keep one websocket open
 * rather than five.
 */
export function useWebinarRealtime({ sessionId, userId, enabled = true }: Options) {
  const supabase = createClient()

  const [session, setSession] = useState<WebinarSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [questions, setQuestions] = useState<WebinarQuestion[]>([])
  const [polls, setPolls] = useState<WebinarPoll[]>([])
  const [resources, setResources] = useState<WebinarResource[]>([])
  const [results, setResults] = useState<Record<string, PollResults>>({})
  const [loading, setLoading] = useState(true)

  // Kept in a ref so the realtime callbacks can refresh results without being
  // re-created (and thus re-subscribing) whenever poll state changes.
  const pollIdsRef = useRef<string[]>([])

  /** Set the first time a postgres_changes event actually arrives. Proof that
   *  replication is enabled, which lets the polling floor back off. */
  const realtimeAliveRef = useRef(false)

  // ── Poll tallies come from a SECURITY DEFINER function, so attendees see
  //    the counts without being able to read anyone else's vote row. ──────
  const refreshResults = useCallback(
    async (pollId: string) => {
      const [{ data: counts }, { data: voters }, { data: mine }] = await Promise.all([
        supabase.rpc('webinar_poll_results', { p_poll_id: pollId }),
        supabase.rpc('webinar_poll_voter_count', { p_poll_id: pollId }),
        userId
          ? supabase
              .from('webinar_poll_votes')
              .select('option_ids')
              .eq('poll_id', pollId)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const map: Record<string, number> = {}
      for (const row of (counts as { option_id: string; votes: number }[] | null) ?? []) {
        map[row.option_id] = Number(row.votes)
      }

      setResults(prev => ({
        ...prev,
        [pollId]: {
          counts: map,
          voters: Number(voters ?? 0),
          myVote: (mine as any)?.option_ids ?? null,
        },
      }))
    },
    [supabase, userId]
  )

  // ── Load / refresh ────────────────────────────────────────────────
  // Also used as the polling floor below, so the panels work whether or not
  // Realtime replication was ever switched on for these tables.
  const refresh = useCallback(
    async (opts: { initial?: boolean } = {}) => {
      if (!sessionId || !enabled) return

      const [sessionRes, chatRes, qRes, pollRes, resRes] = await Promise.all([
        supabase.from('webinar_sessions').select('*').eq('id', sessionId).maybeSingle(),
        supabase
          .from('webinar_chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('is_hidden', false)
          .order('created_at', { ascending: true })
          .limit(500),
        supabase
          .from('webinar_questions')
          .select('*')
          .eq('session_id', sessionId)
          .neq('status', 'hidden')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('webinar_polls')
          .select('*')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('webinar_resources')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false }),
      ])

      setSession(sessionRes.data as WebinarSession | null)
      setMessages((chatRes.data ?? []) as ChatMessage[])
      setQuestions((qRes.data ?? []) as WebinarQuestion[])
      setPolls((pollRes.data ?? []) as WebinarPoll[])
      setResources((resRes.data ?? []) as WebinarResource[])
      if (opts.initial) setLoading(false)

      const ids = ((pollRes.data ?? []) as WebinarPoll[]).map(p => p.id)
      pollIdsRef.current = ids
      ids.forEach(refreshResults)
    },
    [sessionId, enabled, supabase, refreshResults]
  )

  useEffect(() => {
    if (!sessionId || !enabled) { setLoading(false); return }
    refresh({ initial: true })
  }, [sessionId, enabled, refresh])

  // ── Polling floor ─────────────────────────────────────────────────
  // Enabling Realtime replication on the webinar_* tables is a manual Supabase
  // dashboard step, and when it is skipped postgres_changes silently delivers
  // nothing — which previously meant polls and questions never appeared at all.
  // Poll every 10s so the feature works regardless, then back off to 30s once a
  // realtime event has actually arrived, since that proves replication is on and
  // polling is only a safety net from then on. (A flat 5s poll across five
  // tables would be a lot of needless traffic with a hundred people watching.)
  useEffect(() => {
    if (!sessionId || !enabled) return

    let interval: ReturnType<typeof setInterval>
    let currentMs = 0

    const arm = () => {
      const ms = realtimeAliveRef.current ? 30000 : 10000
      if (ms === currentMs) return
      currentMs = ms
      if (interval) clearInterval(interval)
      interval = setInterval(() => {
        refresh()
        arm()
      }, ms)
    }
    arm()

    // Browsers throttle timers in background tabs, so catch up on return.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId, enabled, refresh])

  // ── Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !enabled) return

    const filter = `session_id=eq.${sessionId}`

    const channel = supabase
      .channel(`webinar-${sessionId}`)
      // Session state: go-live, end, feature toggles, recording published.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'webinar_sessions', filter: `id=eq.${sessionId}` },
        payload => {
          realtimeAliveRef.current = true
          setSession(payload.new as WebinarSession)
        }
      )
      // Chat
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webinar_chat_messages', filter },
        payload => {
          realtimeAliveRef.current = true
          const msg = payload.new as ChatMessage
          if (msg.is_hidden) return
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'webinar_chat_messages', filter },
        payload => {
          const msg = payload.new as ChatMessage
          // A hidden message disappears for everyone, not just the moderator.
          setMessages(prev =>
            msg.is_hidden
              ? prev.filter(m => m.id !== msg.id)
              : prev.map(m => (m.id === msg.id ? msg : m))
          )
        }
      )
      // Q&A
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webinar_questions', filter },
        payload => {
          const q = payload.new as WebinarQuestion
          setQuestions(prev => (prev.some(x => x.id === q.id) ? prev : [q, ...prev]))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'webinar_questions', filter },
        payload => {
          const q = payload.new as WebinarQuestion
          setQuestions(prev =>
            q.status === 'hidden'
              ? prev.filter(x => x.id !== q.id)
              : prev.map(x => (x.id === q.id ? q : x))
          )
        }
      )
      // Polls
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'webinar_polls', filter },
        payload => {
          if (payload.eventType === 'DELETE') {
            setPolls(prev => prev.filter(p => p.id !== (payload.old as any).id))
            return
          }
          const poll = payload.new as WebinarPoll
          setPolls(prev => {
            const next = prev.some(p => p.id === poll.id)
              ? prev.map(p => (p.id === poll.id ? poll : p))
              : [...prev, poll]
            return next.sort((a, b) => a.sort_order - b.sort_order)
          })
          if (!pollIdsRef.current.includes(poll.id)) pollIdsRef.current.push(poll.id)
          refreshResults(poll.id)
        }
      )
      // Someone voted — refresh that poll's tally for everyone watching.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'webinar_poll_votes', filter },
        payload => {
          const pollId = (payload.new as any)?.poll_id ?? (payload.old as any)?.poll_id
          if (pollId) refreshResults(pollId)
        }
      )
      // Resources the host pushes mid-session
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webinar_resources', filter },
        payload => {
          const r = payload.new as WebinarResource
          setResources(prev => (prev.some(x => x.id === r.id) ? prev : [r, ...prev]))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, enabled, supabase, refreshResults])

  // ── Actions ───────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (body: string, displayName: string, isStaff = false) => {
      if (!sessionId || !userId) return { error: 'Not signed in' }
      const text = body.trim()
      if (!text) return { error: 'Message is empty' }

      // .select() matters: without it the row only reached the UI when the
      // realtime subscription echoed it back, so with replication off the
      // sender watched their own message vanish. Merging the returned row makes
      // the write self-sufficient; the echo is then a de-duplicated no-op.
      const { data, error } = await supabase
        .from('webinar_chat_messages')
        .insert({
          session_id: sessionId,
          user_id: userId,
          display_name: displayName,
          is_staff: isStaff,
          body: text.slice(0, 2000),
        })
        .select()
        .single()

      if (data) {
        const msg = data as ChatMessage
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
      }
      return { error: error?.message ?? null }
    },
    [sessionId, userId, supabase]
  )

  const askQuestion = useCallback(
    async (body: string, displayName: string) => {
      if (!sessionId || !userId) return { error: 'Not signed in' }
      const text = body.trim()
      if (!text) return { error: 'Question is empty' }

      const { data, error } = await supabase
        .from('webinar_questions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          display_name: displayName,
          body: text.slice(0, 1000),
        })
        .select()
        .single()

      if (data) {
        const q = data as WebinarQuestion
        setQuestions(prev => (prev.some(x => x.id === q.id) ? prev : [q, ...prev]))
      }
      return { error: error?.message ?? null }
    },
    [sessionId, userId, supabase]
  )

  const vote = useCallback(
    async (pollId: string, optionIds: string[]) => {
      if (!sessionId || !userId) return { error: 'Not signed in' }

      const { error } = await supabase.from('webinar_poll_votes').upsert(
        { poll_id: pollId, session_id: sessionId, user_id: userId, option_ids: optionIds },
        { onConflict: 'poll_id,user_id' }
      )
      if (!error) await refreshResults(pollId)
      return { error: error?.message ?? null }
    },
    [sessionId, userId, supabase, refreshResults]
  )

  return {
    session,
    messages,
    questions,
    polls,
    resources,
    results,
    loading,
    sendMessage,
    askQuestion,
    vote,
    refreshResults,
    /** Re-read everything. Call after a write this hook does not own (poll
     *  create/launch, resource share) so the actor sees it straight away
     *  rather than waiting on a realtime echo that may never come. */
    refresh,
  }
}
