'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Radio, Plus, Loader, X, Copy, CheckCheck, Trash2, ExternalLink,
  RefreshCw, Users, Video, AlertTriangle, Mail, BarChart3, ChevronUp, ChevronDown, Save,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendEmail } from '@/lib/emails/send-email'
import { RECORDING_LABELS, STATUS_LABELS, WEBINAR_STREAM_TYPE } from '@/lib/webinars'

/* ── Style tokens (matching other admin pages) ──── */
const C = { navy: '#0F1F3D', navyFg: '#F5F8FC', gold: '#E5A718', primary: '#0078D4', bg: '#F1F1F3', fg: '#181820', card: '#FAFAFA', muted: '#D1D1D6', secondary: '#504F58', destructive: '#DB2424', border: '#D1D1D6' }
const S = {
  input: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#999', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
}

const STATUS_COLOURS: Record<string, [string, string]> = {
  scheduled: ['#E8EEF7', C.navy],
  live: ['#FDECEC', C.destructive],
  ended: ['#EFEFF1', C.secondary],
  processing: ['#FFF4DC', '#8A6100'],
  published: ['#E6F6EC', '#0F7B3F'],
}

interface SessionRow {
  id: string
  event_id: string
  room_name: string
  status: keyof typeof STATUS_LABELS
  recording_status: keyof typeof RECORDING_LABELS
  recording_error: string | null
  recording_video_id: string | null
  chat_enabled: boolean
  qa_enabled: boolean
  polls_enabled: boolean
  recording_enabled: boolean
  peak_attendees: number
  started_at: string | null
  event?: { title: string; slug: string; starts_at: string } | null
}

interface EventOption {
  id: string
  title: string
  slug: string
  starts_at: string
  stream_type: string | null
}

export default function WebinarsAdmin() {
  const supabase = createClient()

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [candidates, setCandidates] = useState<EventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newEventId, setNewEventId] = useState('')
  const [saving, setSaving] = useState(false)
  const [speakerPanel, setSpeakerPanel] = useState<SessionRow | null>(null)
  const [pollPanel, setPollPanel] = useState<SessionRow | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const showToast = (msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('webinar_sessions')
      .select('*, event:events!webinar_sessions_event_id_fkey(title, slug, starts_at)')
      .order('created_at', { ascending: false })

    setSessions((data ?? []) as any)

    // Streaming events that don't have a live room yet.
    const { data: events } = await supabase
      .from('events')
      .select('id, title, slug, starts_at, stream_type')
      .in('event_type', ['Webinar', 'Online Lecture', 'Hybrid'])
      .order('starts_at', { ascending: false })
      .limit(60)

    const claimed = new Set((data ?? []).map((s: any) => s.event_id))
    setCandidates((events ?? []).filter(e => !claimed.has(e.id)) as any)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // The recordings cron only runs daily (Vercel Hobby rejects anything more
  // frequent), so while this page is open and something is mid-pipeline, drive
  // it forward here. That means an admin who ends a webinar and leaves the tab
  // open sees the recording publish itself, without having to know the
  // "Check recordings" button exists.
  const pipelineActive = sessions.some(
    s =>
      s.recording_status === 'uploaded' ||
      s.recording_status === 'transferring' ||
      // Stopped but LiveKit was still writing the file when the request came
      // back — the poll route finalises these.
      (s.recording_status === 'recording' && s.status !== 'live')
  )

  useEffect(() => {
    if (!pipelineActive) return
    const id = setInterval(() => { advanceRecordings(true) }, 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineActive])

  async function createSession() {
    if (!newEventId) return
    setSaving(true)

    // The room name has to be unique and stable; deriving it from a fresh uuid
    // keeps it stable even if the event is later renamed.
    const id = crypto.randomUUID()
    const { error } = await supabase.from('webinar_sessions').insert({
      id,
      event_id: newEventId,
      room_name: `dukes-webinar-${id.slice(0, 8)}`,
    })

    if (!error) {
      // Mark the event as natively streamed so the members' webinars page
      // links to the live room rather than a Zoom URL.
      await supabase
        .from('events')
        .update({ stream_type: WEBINAR_STREAM_TYPE })
        .eq('id', newEventId)
    }

    setSaving(false)
    if (error) { showToast(error.message, 'err'); return }

    setCreating(false)
    setNewEventId('')
    showToast('Live room created.')
    load()
  }

  async function toggle(session: SessionRow, key: string, value: boolean) {
    await supabase.from('webinar_sessions').update({ [key]: value }).eq('id', session.id)
    load()
  }

  async function removeSession(session: SessionRow) {
    if (!confirm(`Delete the live room for “${session.event?.title}”? Chat, questions and polls for this session are deleted too. The recording, if published, is kept.`)) return
    await supabase.from('webinar_sessions').delete().eq('id', session.id)
    showToast('Live room deleted.')
    load()
  }

  /** Runs the recording pipeline one step. `silent` is used by the background
   *  timer so it doesn't fire a toast every minute. */
  async function advanceRecordings(silent = false) {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) return

    const res = await fetch('/api/webinars/recordings/poll', {
      headers: { Authorization: `Bearer ${authSession.access_token}` },
    })
    const data = await res.json()

    if (!silent) {
      showToast(
        data.steps?.length ? data.steps.join(' · ') : 'Nothing waiting to be processed.',
        res.ok ? 'ok' : 'err'
      )
    }
    load()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.fg, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={24} style={{ color: C.gold }} /> Live Webinars
          </h1>
          <p style={{ fontSize: 13.5, color: C.secondary, marginTop: 4, maxWidth: 620 }}>
            Webinars run natively on the site — the host and guest speakers present from the
            browser, attendees watch, ask questions and vote in polls, and the recording is
            published to the video library afterwards.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => advanceRecordings()}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#fff', border: `1.5px solid ${C.muted}`, color: C.fg, borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={15} /> Check recordings
          </button>
          <button
            onClick={() => setCreating(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: C.navy, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} /> New live room
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 60 }}>
          <Loader className="animate-spin" size={28} style={{ color: C.secondary }} />
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '56px 24px', textAlign: 'center', border: `1px solid ${C.border}` }}>
          <Radio size={30} style={{ color: C.muted, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: C.fg, marginBottom: 5 }}>No live rooms yet</p>
          <p style={{ fontSize: 13.5, color: C.secondary, maxWidth: 380, margin: '0 auto' }}>
            Create a live room against a Webinar, Online Lecture or Hybrid event to run it
            natively on the site.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {sessions.map(session => {
            const [bg, fg] = STATUS_COLOURS[session.status] ?? STATUS_COLOURS.scheduled
            return (
              <div key={session.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={S.badge(bg, fg)}>{STATUS_LABELS[session.status]}</span>
                      {session.recording_status !== 'none' && (
                        <span style={S.badge('#F2F2F4', C.secondary)}>
                          {RECORDING_LABELS[session.recording_status]}
                        </span>
                      )}
                    </div>

                    <h2 style={{ fontSize: 17, fontWeight: 700, color: C.fg, marginBottom: 3 }}>
                      {session.event?.title ?? 'Untitled event'}
                    </h2>
                    <p style={{ fontSize: 12.5, color: C.secondary }}>
                      {session.event?.starts_at
                        ? new Date(session.event.starts_at).toLocaleString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                      {session.peak_attendees > 0 && (
                        <> · <Users size={11} style={{ display: 'inline', verticalAlign: -1 }} /> peak {session.peak_attendees}</>
                      )}
                    </p>

                    {session.recording_error && (
                      <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: C.destructive, marginTop: 8, background: '#FDECEC', padding: '7px 10px', borderRadius: 8 }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                        {session.recording_error}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link
                      href={`/webinar/${session.event?.slug}/host`}
                      target="_blank"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', background: C.gold, color: '#3D2C00', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
                    >
                      <Radio size={14} /> Open studio <ExternalLink size={11} />
                    </Link>
                    <button
                      onClick={() => setSpeakerPanel(session)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', border: `1.5px solid ${C.muted}`, color: C.fg, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Mail size={14} /> Speakers
                    </button>
                    <button
                      onClick={() => setPollPanel(session)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', border: `1.5px solid ${C.muted}`, color: C.fg, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <BarChart3 size={14} /> Polls
                    </button>
                    {session.recording_video_id && (
                      <Link
                        href={`/members/videos?v=${session.recording_video_id}`}
                        target="_blank"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', border: `1.5px solid ${C.muted}`, color: C.fg, borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                      >
                        <Video size={14} /> Recording
                      </Link>
                    )}
                    <button
                      onClick={() => removeSession(session)}
                      aria-label="Delete live room"
                      style={{ padding: 9, background: '#fff', border: `1.5px solid ${C.muted}`, color: C.destructive, borderRadius: 9, cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Feature toggles */}
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #EEE' }}>
                  {([
                    ['chat_enabled', 'Live chat'],
                    ['qa_enabled', 'Q&A'],
                    ['polls_enabled', 'Polls'],
                    ['recording_enabled', 'Record automatically'],
                  ] as const).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: C.secondary, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(session as any)[key]}
                        onChange={e => toggle(session, key, e.target.checked)}
                        style={{ accentColor: C.navy, width: 15, height: 15 }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New room modal */}
      {creating && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 50, display: 'grid', placeItems: 'center', padding: 16 }}
          onClick={() => setCreating(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #EEE' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.fg }}>New live room</h2>
              <button onClick={() => setCreating(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.secondary }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 22px' }}>
              <label style={S.label}>Event</label>
              <select style={S.select} value={newEventId} onChange={e => setNewEventId(e.target.value)}>
                <option value="">Choose an event…</option>
                {candidates.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {new Date(e.starts_at).toLocaleDateString('en-GB')}
                  </option>
                ))}
              </select>
              <p style={S.hint}>
                Only Webinar, Online Lecture and Hybrid events without a live room are listed.
                Creating a room sets the event’s stream type to Dukes’ Live.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid #EEE', background: '#FAFAFA', borderRadius: '0 0 16px 16px' }}>
              <button onClick={() => setCreating(false)} style={{ padding: '9px 16px', background: 'none', border: 'none', fontSize: 13.5, fontWeight: 600, color: C.secondary, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={createSession}
                disabled={saving || !newEventId}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: C.navy, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: saving || !newEventId ? 0.5 : 1 }}
              >
                {saving && <Loader className="animate-spin" size={14} />} Create room
              </button>
            </div>
          </div>
        </div>
      )}

      {speakerPanel && (
        <SpeakerManager
          session={speakerPanel}
          onClose={() => setSpeakerPanel(null)}
          onToast={showToast}
        />
      )}

      {pollPanel && (
        <PollManager
          session={pollPanel}
          onClose={() => setPollPanel(null)}
          onToast={showToast}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, padding: '12px 18px', borderRadius: 10, color: '#fff', fontSize: 13.5, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxWidth: 420, background: toast.type === 'ok' ? '#16A34A' : C.destructive }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/**
 * Speaker invites. The magic link is shown exactly once, on creation — only a
 * hash of the token is stored, so it cannot be read back later. "New link"
 * mints a fresh token and kills the old one.
 */
function SpeakerManager({
  session,
  onClose,
  onToast,
}: {
  session: SessionRow
  onClose: () => void
  onToast: (msg: string, type?: string) => void
}) {
  const supabase = createClient()
  const [speakers, setSpeakers] = useState<any[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('speaker')
  const [saving, setSaving] = useState(false)
  const [freshLink, setFreshLink] = useState<{ id: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('webinar_speakers')
      .select('id, name, email, role, expires_at, invite_sent_at, last_joined_at, revoked_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    setSpeakers(data ?? [])
  }, [session.id, supabase])

  useEffect(() => { load() }, [load])

  async function post(body: any) {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) return null

    const res = await fetch(`/api/webinars/${session.id}/speakers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { onToast(data.error || 'Request failed', 'err'); return null }
    return data
  }

  async function invite() {
    if (!name.trim()) return
    setSaving(true)
    const data = await post({ name: name.trim(), email: email.trim() || null, role })
    setSaving(false)
    if (!data) return

    setFreshLink({ id: data.speaker.id, url: data.inviteUrl })
    setName('')
    setEmail('')
    load()

    if (email.trim()) {
      sendEmail({
        type: 'webinar_speaker_invite',
        to: email.trim(),
        data: {
          speakerName: data.speaker.name,
          eventTitle: data.eventTitle,
          startsAt: data.startsAt,
          joinUrl: data.inviteUrl,
        },
      }).catch(() => onToast('Invite created, but the email failed to send.', 'err'))
      onToast('Invite created and emailed.')
    } else {
      onToast('Invite created — copy the link below.')
    }
  }

  async function regenerate(speakerId: string) {
    const data = await post({ action: 'regenerate', speakerId })
    if (!data) return
    setFreshLink({ id: speakerId, url: data.inviteUrl })
    onToast('New link created. The previous one no longer works.')
    load()
  }

  async function revoke(speakerId: string) {
    if (!confirm('Revoke this speaker’s link? They will be unable to join.')) return
    await post({ action: 'revoke', speakerId })
    onToast('Link revoked.')
    load()
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 50, display: 'grid', placeItems: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #EEE', position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.fg }}>Guest speakers</h2>
            <p style={{ fontSize: 12.5, color: C.secondary }}>{session.event?.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.secondary }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          <p style={{ fontSize: 13, color: C.secondary, marginBottom: 16, lineHeight: 1.55 }}>
            Speakers join by a personal link — no Dukes’ Club account needed. The link opens a
            green room where they can check their camera, microphone and screen sharing before
            going live.
          </p>

          {/* Existing speakers */}
          {speakers.length > 0 && (
            <div style={{ display: 'grid', gap: 9, marginBottom: 20 }}>
              {speakers.map(sp => (
                <div key={sp.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, opacity: sp.revoked_at ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>
                        {sp.name}
                        {sp.revoked_at && <span style={{ fontWeight: 400, color: C.destructive }}> · revoked</span>}
                      </p>
                      <p style={{ fontSize: 12, color: C.secondary }}>
                        {sp.email || 'No email'} · {sp.role}
                        {sp.last_joined_at && ' · has joined'}
                      </p>
                    </div>
                    <button
                      onClick={() => regenerate(sp.id)}
                      style={{ padding: '6px 12px', background: '#fff', border: `1.5px solid ${C.muted}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.fg, cursor: 'pointer' }}
                    >
                      New link
                    </button>
                    {!sp.revoked_at && (
                      <button
                        onClick={() => revoke(sp.id)}
                        style={{ padding: '6px 12px', background: '#fff', border: `1.5px solid ${C.muted}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.destructive, cursor: 'pointer' }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>

                  {freshLink !== null && freshLink.id === sp.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px', background: '#FFF9E8', border: '1px solid #F0DFA8', borderRadius: 8 }}>
                      <code style={{ flex: 1, fontSize: 11, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {freshLink.url}
                      </code>
                      <button onClick={() => copy(freshLink!.url)} aria-label="Copy link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.navy }}>
                        {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {freshLink && !speakers.some(s => s.id === freshLink.id) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: '#FFF9E8', border: '1px solid #F0DFA8', borderRadius: 8 }}>
              <code style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'IBM Plex Mono, monospace' }}>
                {freshLink.url}
              </code>
              <button onClick={() => copy(freshLink.url)} aria-label="Copy link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.navy }}>
                {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
              </button>
            </div>
          )}

          {/* Invite form */}
          <div style={{ borderTop: '1px solid #EEE', paddingTop: 18 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={S.label}>Name</label>
                <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Miss Jane Smith" />
              </div>
              <div>
                <label style={S.label}>Email (optional)</label>
                <input style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="jane.smith@nhs.net" />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Role</label>
              <select style={S.select} value={role} onChange={e => setRole(e.target.value)}>
                <option value="speaker">Speaker — can present and share their screen</option>
                <option value="moderator">Moderator — can present and answer questions</option>
                <option value="host">Co-host — full control of the session</option>
              </select>
            </div>

            <button
              onClick={invite}
              disabled={saving || !name.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '10px 18px', background: C.navy, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: saving || !name.trim() ? 0.5 : 1 }}
            >
              {saving ? <Loader className="animate-spin" size={14} /> : <Plus size={15} />}
              Create invite{email.trim() ? ' and email it' : ''}
            </button>

            <p style={S.hint}>
              The link is shown once, here. It can’t be retrieved later — use “New link” if a
              speaker loses theirs.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Pre-authoring for polls.
 *
 * Polls used to be writable only from the live studio sidebar — 380px wide,
 * while the webinar was running, which is the wrong moment and the wrong amount
 * of room to be composing questions. Drafts are already invisible to attendees
 * (the RLS policy is `status <> 'draft'`), so writing them ahead of time was
 * always safe; there was just nowhere sensible to do it.
 *
 * Editing is restricted to drafts. Once a poll has been launched its wording is
 * fixed, because votes already cast against the old wording would otherwise
 * stop meaning anything.
 */
function PollManager({
  session,
  onClose,
  onToast,
}: {
  session: SessionRow
  onClose: () => void
  onToast: (msg: string, type?: string) => void
}) {
  const supabase = createClient()
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [saving, setSaving] = useState(false)

  const emptyForm = {
    question: '',
    options: ['', ''],
    allow_multiple: false,
    results_visible: true,
  }
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('webinar_polls')
      .select('*')
      .eq('session_id', session.id)
      .order('sort_order', { ascending: true })
    setPolls(data ?? [])
    setLoading(false)
  }, [session.id, supabase])

  useEffect(() => { load() }, [load])

  function openNew() {
    setForm(emptyForm)
    setEditing('new')
  }

  function openEdit(poll: any) {
    setForm({
      question: poll.question,
      options: (poll.options ?? []).map((o: any) => o.label),
      allow_multiple: poll.allow_multiple,
      results_visible: poll.results_visible,
    })
    setEditing(poll.id)
  }

  async function save() {
    const clean = form.options.map(o => o.trim()).filter(Boolean)
    if (!form.question.trim()) { onToast('Give the poll a question.', 'err'); return }
    if (clean.length < 2) { onToast('A poll needs at least two options.', 'err'); return }

    setSaving(true)
    const payload = {
      question: form.question.trim(),
      options: clean.map((label, i) => ({ id: String.fromCharCode(97 + i), label })),
      allow_multiple: form.allow_multiple,
      results_visible: form.results_visible,
    }

    const { error } =
      editing === 'new'
        ? await supabase.from('webinar_polls').insert({
            ...payload,
            session_id: session.id,
            sort_order: polls.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1) + 1,
          })
        : await supabase.from('webinar_polls').update(payload).eq('id', editing)

    setSaving(false)
    if (error) { onToast(error.message, 'err'); return }

    setEditing(null)
    onToast(editing === 'new' ? 'Poll added.' : 'Poll updated.')
    load()
  }

  async function remove(poll: any) {
    if (!confirm(`Delete “${poll.question}”?`)) return
    const { error } = await supabase.from('webinar_polls').delete().eq('id', poll.id)
    if (error) { onToast(error.message, 'err'); return }
    onToast('Poll deleted.')
    load()
  }

  /** Swap a poll with its neighbour and renumber, so sort_order stays dense. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= polls.length) return

    const reordered = [...polls]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setPolls(reordered)

    await Promise.all(
      reordered.map((p, i) =>
        supabase.from('webinar_polls').update({ sort_order: i }).eq('id', p.id)
      )
    )
    load()
  }

  const STATUS_TEXT: Record<string, string> = {
    draft: 'Queued',
    live: 'Live now',
    closed: 'Closed',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 50, display: 'grid', placeItems: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #EEE', position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: C.fg }}>Polls</h2>
            <p style={{ fontSize: 12.5, color: C.secondary }}>{session.event?.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.secondary }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          <p style={{ fontSize: 13, color: C.secondary, marginBottom: 16, lineHeight: 1.55 }}>
            Prepare polls here before the webinar. They stay hidden from attendees until you
            press <strong>Launch</strong> in the host studio, so you can queue up as many as you
            like and fire each one when the talk reaches it.
          </p>

          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
              <Loader className="animate-spin" size={24} style={{ color: C.secondary }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
              {polls.map((poll, i) => (
                <div key={poll.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2 }}>
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? C.muted : C.secondary, padding: 0, lineHeight: 0 }}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === polls.length - 1}
                        aria-label="Move down"
                        style={{ background: 'none', border: 'none', cursor: i === polls.length - 1 ? 'default' : 'pointer', color: i === polls.length - 1 ? C.muted : C.secondary, padding: 0, lineHeight: 0 }}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={S.badge(
                          poll.status === 'live' ? '#FDECEC' : poll.status === 'closed' ? '#EFEFF1' : '#E8EEF7',
                          poll.status === 'live' ? C.destructive : poll.status === 'closed' ? C.secondary : C.navy
                        )}>
                          {STATUS_TEXT[poll.status]}
                        </span>
                        {poll.allow_multiple && <span style={S.badge('#F2F2F4', C.secondary)}>Multiple answers</span>}
                        {!poll.results_visible && <span style={S.badge('#F2F2F4', C.secondary)}>Results hidden</span>}
                      </div>

                      <p style={{ fontSize: 14, fontWeight: 600, color: C.fg, marginBottom: 3 }}>
                        {poll.question}
                      </p>
                      <p style={{ fontSize: 12, color: C.secondary }}>
                        {(poll.options ?? []).map((o: any) => o.label).join(' · ')}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {poll.status === 'draft' && (
                        <button
                          onClick={() => openEdit(poll)}
                          style={{ padding: '6px 12px', background: '#fff', border: `1.5px solid ${C.muted}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.fg, cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => remove(poll)}
                        aria-label="Delete poll"
                        style={{ padding: 6, background: '#fff', border: `1.5px solid ${C.muted}`, borderRadius: 8, color: C.destructive, cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {poll.status !== 'draft' && (
                    <p style={{ fontSize: 11.5, color: C.secondary, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0F2' }}>
                      Already shown to attendees, so the wording is locked — votes cast against
                      it would stop matching otherwise.
                    </p>
                  )}
                </div>
              ))}

              {polls.length === 0 && (
                <p style={{ fontSize: 13.5, color: C.secondary, textAlign: 'center', padding: '24px 0' }}>
                  No polls yet.
                </p>
              )}
            </div>
          )}

          {editing ? (
            <div style={{ borderTop: '1px solid #EEE', paddingTop: 18 }}>
              <label style={S.label}>Question</label>
              <input
                style={S.input}
                value={form.question}
                onChange={e => setForm({ ...form, question: e.target.value })}
                placeholder="Which anastomotic technique do you prefer?"
              />

              <label style={{ ...S.label, marginTop: 14 }}>Options</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {form.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      style={S.input}
                      value={opt}
                      onChange={e => setForm({
                        ...form,
                        options: form.options.map((o, j) => (j === i ? e.target.value : o)),
                      })}
                      placeholder={`Option ${i + 1}`}
                    />
                    {form.options.length > 2 && (
                      <button
                        onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                        aria-label="Remove option"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.secondary, flexShrink: 0 }}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {form.options.length < 8 && (
                <button
                  onClick={() => setForm({ ...form, options: [...form.options, ''] })}
                  style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 12.5, fontWeight: 600, color: C.primary, cursor: 'pointer' }}
                >
                  + Add option
                </button>
              )}

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: C.fg, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.allow_multiple}
                    onChange={e => setForm({ ...form, allow_multiple: e.target.checked })}
                    style={{ accentColor: C.navy, width: 15, height: 15, marginTop: 2 }}
                  />
                  <span>
                    Allow multiple answers
                    <span style={{ display: 'block', fontSize: 11.5, color: C.secondary }}>
                      Attendees can tick more than one option.
                    </span>
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: C.fg, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.results_visible}
                    onChange={e => setForm({ ...form, results_visible: e.target.checked })}
                    style={{ accentColor: C.navy, width: 15, height: 15, marginTop: 2 }}
                  />
                  <span>
                    Show results to attendees
                    <span style={{ display: 'block', fontSize: 11.5, color: C.secondary }}>
                      Turn this off for a teaching question — seeing the distribution first
                      sways the room. You can reveal the results from the studio afterwards.
                    </span>
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  onClick={() => setEditing(null)}
                  style={{ padding: '9px 16px', background: 'none', border: 'none', fontSize: 13.5, fontWeight: 600, color: C.secondary, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: C.navy, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
                >
                  {saving ? <Loader className="animate-spin" size={14} /> : <Save size={14} />}
                  {editing === 'new' ? 'Add poll' : 'Save changes'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '11px 0', background: '#fff', border: `1.5px dashed ${C.muted}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: C.fg, cursor: 'pointer' }}
            >
              <Plus size={15} /> New poll
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
