'use client'

/**
 * NOTE ON STYLING: the rest of /admin uses inline `const S = {...}` style
 * objects, but this studio uses Tailwind because it shares WebinarShell,
 * WebinarStage and the sidebar panels with the attendee and speaker surfaces.
 * Re-implementing the stage in inline styles to match the admin convention
 * would mean maintaining it twice. This inconsistency is deliberate.
 */

import { useCallback, useEffect, useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import {
  Loader2, Radio, Square, Circle, Plus, X, Play, Check, Eye,
  AlertTriangle, Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useWebinarRealtime } from '@/lib/use-webinar-realtime'
import { elapsedSince, attachmentKind, MAX_WEBINAR_UPLOAD, type WebinarSession } from '@/lib/webinars'
import { useImageUpload } from '@/lib/use-image-upload'
import { WebinarShell, WebinarLayout } from '@/components/webinar/WebinarShell'
import { WebinarStage } from '@/components/webinar/WebinarStage'
import { WebinarSidebar } from '@/components/webinar/WebinarSidebar'
import { ChatPanel } from '@/components/webinar/ChatPanel'
import { QAPanel } from '@/components/webinar/QAPanel'
import { ResourcesPanel } from '@/components/webinar/ResourcesPanel'
import { MediaControls } from '@/components/webinar/MediaControls'

interface Props {
  event: { id: string; title: string; slug: string; starts_at: string }
  initialSession: WebinarSession
  userId: string
  displayName: string
}

export function HostStudio({ event, initialSession, userId, displayName }: Props) {
  const supabase = createClient()

  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [confirmGoLive, setConfirmGoLive] = useState(false)
  const [, setTick] = useState(0)

  const {
    session, messages, questions, polls, resources, results,
    sendMessage, askQuestion, refresh,
  } = useWebinarRealtime({ sessionId: initialSession.id, userId })

  const live = session ?? initialSession

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const authFetch = useCallback(
    async (url: string, body: any) => {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) throw new Error('Your session has expired.')

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    },
    [supabase]
  )

  // Join the room as host as soon as the studio opens, so devices can be
  // checked before going live.
  const connect = useCallback(async () => {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) return

    const res = await fetch('/api/webinars/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({ eventId: event.id }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.message || 'Could not join the room', 'err'); return }

    setToken(data.token)
    setServerUrl(data.url)
  }, [event.id, supabase])

  useEffect(() => { connect() }, [connect])

  async function goLive() {
    setConfirmGoLive(false)
    setBusy('go-live')
    try {
      const data = await authFetch(`/api/webinars/${live.id}/session`, { action: 'go-live' })
      showToast(
        data.recordingWarning
          ? `You are live — but recording failed to start: ${data.recordingWarning}`
          : 'You are live.',
        data.recordingWarning ? 'err' : 'ok'
      )
      // These routes return the updated row; take it straight away rather than
      // waiting on a realtime echo, so the header flips the moment it lands.
      await refresh()
    } catch (err: any) {
      showToast(err.message, 'err')
    } finally {
      setBusy(null)
    }
  }

  async function endSession() {
    if (!confirm('End the webinar for everyone? This stops the recording and disconnects all attendees.')) return
    setBusy('end')
    try {
      await authFetch(`/api/webinars/${live.id}/session`, { action: 'end' })
      await refresh()
      showToast('Webinar ended. The recording will be processed shortly.')
    } catch (err: any) {
      showToast(err.message, 'err')
    } finally {
      setBusy(null)
    }
  }

  async function toggleRecording() {
    const action = live.recording_status === 'recording' ? 'stop-recording' : 'start-recording'
    setBusy('rec')
    try {
      await authFetch(`/api/webinars/${live.id}/session`, { action })
      await refresh()
      showToast(action === 'start-recording' ? 'Recording started.' : 'Recording stopped.')
    } catch (err: any) {
      showToast(err.message, 'err')
    } finally {
      setBusy(null)
    }
  }

  // ── Moderation ────────────────────────────────────────────────────
  // Each of these follows the write with a refresh, so the moderator sees the
  // effect immediately instead of waiting on a realtime echo.
  const hideMessage = async (id: string) => {
    await supabase.from('webinar_chat_messages').update({ is_hidden: true }).eq('id', id)
    await refresh()
  }

  const pinQuestion = async (id: string, pinned: boolean) => {
    await supabase.from('webinar_questions').update({ is_pinned: pinned }).eq('id', id)
    await refresh()
  }

  const hideQuestion = async (id: string) => {
    await supabase.from('webinar_questions').update({ status: 'hidden' }).eq('id', id)
    await refresh()
  }

  const answerQuestion = async (
    questionId: string,
    answer: { body: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: string }
  ) => {
    const { error } = await supabase
      .from('webinar_questions')
      .update({
        answer_body: answer.body || null,
        answer_attachment_url: answer.attachmentUrl ?? null,
        answer_attachment_name: answer.attachmentName ?? null,
        answer_attachment_type: answer.attachmentType ?? null,
        answered_by: userId,
        answered_by_name: displayName,
        answered_at: new Date().toISOString(),
        status: 'answered',
      })
      .eq('id', questionId)
    if (!error) await refresh()
    return { error: error?.message ?? null }
  }

  const sidebar = (
    <WebinarSidebar
      defaultTab="qa"
      counts={{ chat: messages.length, qa: questions.length, polls: polls.length, resources: resources.length }}
      chat={
        <ChatPanel
          messages={messages}
          currentUserId={userId}
          enabled={live.chat_enabled}
          canModerate
          onSend={body => sendMessage(body, displayName, true)}
          onHide={hideMessage}
        />
      }
      qa={
        <QAPanel
          questions={questions}
          currentUserId={userId}
          enabled={live.qa_enabled}
          canAnswer
          onAsk={body => askQuestion(body, displayName)}
          onAnswer={answerQuestion}
          onPin={pinQuestion}
          onHide={hideQuestion}
        />
      }
      polls={
        <HostPollPanel
          sessionId={live.id}
          polls={polls}
          results={results}
          onToast={showToast}
          onChanged={refresh}
        />
      }
      resources={
        <HostResourcesPanel
          sessionId={live.id}
          resources={resources}
          userId={userId}
          onToast={showToast}
          onChanged={refresh}
        />
      }
    />
  )

  const headerActions = (
    <div className="flex items-center gap-2">
      {live.status === 'scheduled' && (
        <button
          type="button"
          onClick={() => setConfirmGoLive(true)}
          disabled={busy === 'go-live'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-gold-foreground text-[12.5px] font-bold hover:bg-gold/90 disabled:opacity-50"
        >
          {busy === 'go-live' ? <Loader2 size={13} className="animate-spin" /> : <Radio size={13} />}
          Go live
        </button>
      )}

      {live.status === 'live' && (
        <>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={busy === 'rec'}
            title={live.recording_status === 'recording' ? 'Stop recording' : 'Start recording'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-[12px] font-semibold hover:bg-slate-200 disabled:opacity-50"
          >
            {busy === 'rec'
              ? <Loader2 size={12} className="animate-spin" />
              : live.recording_status === 'recording'
                ? <Square size={11} className="fill-current" />
                : <Circle size={11} className="fill-red-500 text-red-500" />}
            <span className="hidden md:inline">
              {live.recording_status === 'recording' ? 'Stop' : 'Record'}
            </span>
          </button>

          <button
            type="button"
            onClick={endSession}
            disabled={busy === 'end'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 text-white text-[12.5px] font-bold hover:bg-red-500 disabled:opacity-50"
          >
            {busy === 'end' && <Loader2 size={12} className="animate-spin" />}
            End
          </button>
        </>
      )}
    </div>
  )

  const body = (
    <>
      <WebinarLayout
        stage={<WebinarStage />}
        sidebar={sidebar}
        controls={token ? <MediaControls /> : undefined}
      />

      {live.status === 'scheduled' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-white ring-1 ring-amber-300 text-[12px] font-medium text-amber-800 shadow-lg">
          Attendees can’t see you yet — press “Go live” when you’re ready
        </div>
      )}

      {live.recording_status === 'failed' && live.recording_error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-950/90 ring-1 ring-red-500/30 text-[12px] text-red-200 max-w-lg backdrop-blur-sm">
          <AlertTriangle size={13} className="shrink-0" />
          Recording problem: {live.recording_error}
        </div>
      )}

      {toast && (
        <div
          className={`fixed top-20 right-5 z-[100] px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg max-w-sm ${
            toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {confirmGoLive && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 grid place-items-center p-4"
          onClick={() => setConfirmGoLive(false)}
        >
          <div
            className="bg-white ring-1 ring-slate-200 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold tracking-tight mb-1.5">Go live?</h2>
            <p className="text-slate-500 text-[13px] leading-relaxed mb-5">
              Everyone registered for <span className="text-slate-900">{event.title}</span> will
              be taken into the room immediately.
            </p>

            <ul className="space-y-2 mb-6">
              <Checklist ok label="Room connected" hint={token ? 'Connected' : 'Connecting…'} />
              <Checklist
                ok={live.recording_enabled}
                label="Recording"
                hint={live.recording_enabled ? 'Will start automatically' : 'Off for this webinar'}
              />
              <Checklist ok={live.chat_enabled} label="Chat" hint={live.chat_enabled ? 'Open' : 'Disabled'} />
              <Checklist ok={live.qa_enabled} label="Q&A" hint={live.qa_enabled ? 'Open' : 'Disabled'} />
            </ul>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmGoLive(false)}
                className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-900"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={goLive}
                className="px-5 py-2.5 rounded-lg bg-gold text-gold-foreground text-[13px] font-bold hover:bg-gold/90"
              >
                Go live now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  const shell = (
    <WebinarShell
      title={event.title}
      status={live.status}
      eyebrow="Host studio"
      elapsed={elapsedSince(live.started_at)}
      viewers={live.peak_attendees || undefined}
      recording={live.recording_status === 'recording'}
      actions={headerActions}
    >
      {body}
    </WebinarShell>
  )

  if (!token || !serverUrl) return shell

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio={false}
      video={false}
      className="contents"
    >
      <RoomAudioRenderer />
      {shell}
    </LiveKitRoom>
  )
}

function Checklist({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span
        className={`w-5 h-5 rounded-full grid place-items-center shrink-0 ${
          ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {ok ? <Check size={11} /> : <X size={11} />}
      </span>
      <span className="text-slate-700">{label}</span>
      <span className="ml-auto text-[11.5px] text-slate-400">{hint}</span>
    </li>
  )
}

/** Poll authoring + launch control, layered over the shared attendee view. */
function HostPollPanel({
  sessionId,
  polls,
  results,
  onToast,
  onChanged,
}: {
  sessionId: string
  polls: any[]
  results: any
  onToast: (msg: string, type?: 'ok' | 'err') => void
  /** Re-reads the session's data. Without this a new poll only appeared if a
   *  realtime echo arrived, so with replication off the host saved a draft and
   *  then had nothing to launch. */
  onChanged: () => Promise<void> | void
}) {
  const supabase = createClient()
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [saving, setSaving] = useState(false)

  async function create() {
    const clean = options.map(o => o.trim()).filter(Boolean)
    if (!question.trim() || clean.length < 2) {
      onToast('A poll needs a question and at least two options.', 'err')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('webinar_polls').insert({
      session_id: sessionId,
      question: question.trim(),
      options: clean.map((label, i) => ({ id: String.fromCharCode(97 + i), label })),
      // Max + 1 rather than polls.length, which collides after a delete.
      sort_order: polls.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1) + 1,
    })
    setSaving(false)

    if (error) { onToast(error.message, 'err'); return }
    setQuestion('')
    setOptions(['', ''])
    setCreating(false)
    await onChanged()
    onToast('Poll saved as a draft. Press Launch when you want it live.')
  }

  async function setStatus(pollId: string, status: 'live' | 'closed') {
    const patch: Record<string, any> = { status }
    if (status === 'live') { patch.launched_at = new Date().toISOString(); patch.closed_at = null }
    if (status === 'closed') patch.closed_at = new Date().toISOString()

    const { error } = await supabase.from('webinar_polls').update(patch).eq('id', pollId)
    if (error) { onToast(error.message, 'err'); return }
    await onChanged()
    onToast(status === 'live' ? 'Poll is live for attendees.' : 'Poll closed.')
  }

  /** Reveal a poll whose results were deliberately hidden while people voted. */
  async function reveal(pollId: string) {
    const { error } = await supabase
      .from('webinar_polls')
      .update({ results_visible: true })
      .eq('id', pollId)
    if (error) { onToast(error.message, 'err'); return }
    await onChanged()
    onToast('Results revealed to attendees.')
  }

  // Run-of-show order: what to fire next, what is running, what is done.
  const queued = polls.filter(p => p.status === 'draft')
  const liveNow = polls.filter(p => p.status === 'live')
  const closed = polls.filter(p => p.status === 'closed')

  const card = (poll: any) => {
    const voters = results[poll.id]?.voters ?? 0
    const showBars = poll.status !== 'draft'

    return (
      <div
        key={poll.id}
        className={cn(
          'rounded-lg bg-white ring-1 p-3',
          poll.status === 'live' ? 'ring-primary/40 shadow-sm' : 'ring-slate-200'
        )}
      >
        <p className="text-[14.5px] font-semibold leading-snug mb-2">{poll.question}</p>

        {showBars && (
          <div className="space-y-1.5 mb-2.5">
            {poll.options.map((o: any) => {
              const count = results[poll.id]?.counts[o.id] ?? 0
              const pct = voters ? Math.round((count / voters) * 100) : 0
              return (
                <div key={o.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] text-slate-700 flex-1">{o.label}</span>
                    <span className="text-[11.5px] tabular-nums text-slate-900 font-medium">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-accent overflow-hidden">
                    <div
                      className="wb-bar h-full rounded-full bg-chart-1"
                      style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {poll.status === 'draft' && (
          <p className="text-[11.5px] text-slate-400 mb-2.5">
            {poll.options.length} options
            {poll.allow_multiple && ' · multiple answers'}
            {!poll.results_visible && ' · results hidden until revealed'}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {poll.status === 'draft' && (
            <button
              type="button"
              onClick={() => setStatus(poll.id, 'live')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-[11.5px] font-bold hover:bg-primary/90"
            >
              <Play size={10} /> Launch
            </button>
          )}

          {poll.status === 'live' && (
            <>
              <button
                type="button"
                onClick={() => setStatus(poll.id, 'closed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-[11.5px] font-semibold hover:bg-slate-200"
              >
                <Square size={10} /> Close
              </button>
              {!poll.results_visible && (
                <button
                  type="button"
                  onClick={() => reveal(poll.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-[11.5px] font-semibold hover:bg-slate-200"
                >
                  <Eye size={10} /> Reveal
                </button>
              )}
            </>
          )}

          {poll.status === 'closed' && (
            <button
              type="button"
              onClick={() => setStatus(poll.id, 'live')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-[11.5px] font-semibold hover:bg-slate-200"
            >
              <Play size={10} /> Reopen
            </button>
          )}

          <span className="ml-auto text-[11px] text-slate-400">
            {poll.status === 'draft'
              ? 'Not yet shown'
              : `${voters} response${voters === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>
    )
  }

  const group = (label: string, items: any[]) =>
    items.length > 0 && (
      <div className="space-y-2">
        <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 px-0.5">
          {label}
        </p>
        {items.map(card)}
      </div>
    )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
        {group('Live now', liveNow)}
        {group(`Queued${queued.length > 1 ? ` · ${queued.length}` : ''}`, queued)}
        {group('Closed', closed)}

        {polls.length === 0 && !creating && (
          <p className="text-[12.5px] text-slate-400 text-center px-4 py-6 leading-relaxed">
            No polls yet. Prepare them in advance under
            <br />
            <span className="text-slate-500">Admin → Live Webinars → Polls</span>, or add a
            quick one below.
          </p>
        )}

        {creating ? (
          <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 space-y-2">
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Poll question"
              className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-[13px] placeholder:text-slate-900/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={e => setOptions(prev => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-200 text-[12.5px] placeholder:text-slate-900/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}
                    aria-label="Remove option"
                    className="text-slate-400 hover:text-red-400"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptions(prev => [...prev, ''])}
              className="text-[11.5px] text-slate-500 hover:text-slate-900"
            >
              + Add option
            </button>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="text-[11.5px] text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-gold-foreground text-[11.5px] font-bold disabled:opacity-50"
              >
                {saving && <Loader2 size={10} className="animate-spin" />}
                Save poll
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full py-2.5 rounded-lg ring-1 ring-dashed ring-slate-300 text-[12.5px] text-slate-500 hover:text-slate-900 hover:ring-slate-400 inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={13} /> New poll
          </button>
        )}
      </div>
    </div>
  )
}

/** Resource library plus the composer that pushes one to the audience. */
function HostResourcesPanel({
  sessionId,
  resources,
  userId,
  onToast,
  onChanged,
}: {
  sessionId: string
  resources: any[]
  userId: string
  onToast: (msg: string, type?: 'ok' | 'err') => void
  onChanged: () => Promise<void> | void
}) {
  const supabase = createClient()
  const { upload, uploading } = useImageUpload()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function share() {
    if (!title.trim() || (!url.trim() && !file)) {
      onToast('Add a title and either a link or a file.', 'err')
      return
    }

    setSaving(true)
    let finalUrl = url.trim()
    let kind: string = 'link'

    if (file) {
      const uploaded = await upload(file, 'webinar-resources')
      if (!uploaded) { onToast('Upload failed.', 'err'); setSaving(false); return }
      finalUrl = uploaded
      kind = attachmentKind(file)
    }

    const { error } = await supabase.from('webinar_resources').insert({
      session_id: sessionId,
      title: title.trim(),
      url: finalUrl,
      kind,
      posted_by: userId,
    })
    setSaving(false)

    if (error) { onToast(error.message, 'err'); return }
    setTitle('')
    setUrl('')
    setFile(null)
    await onChanged()
    onToast('Shared with everyone watching.')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ResourcesPanel resources={resources} />

      <div className="border-t border-slate-200 p-3 space-y-2 shrink-0">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title, e.g. “Anastomotic leak consensus”"
          className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-[12.5px] placeholder:text-slate-900/30 focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={!!file}
          placeholder="Paste a link…"
          className="w-full px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-200 text-[12px] placeholder:text-slate-900/30 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-40"
        />
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 cursor-pointer">
            <Link2 size={12} />
            {file ? file.name.slice(0, 20) : 'or attach a file'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.size > MAX_WEBINAR_UPLOAD) { onToast('Files must be under 10MB.', 'err'); return }
                setFile(f)
                setUrl('')
              }}
            />
          </label>
          <button
            type="button"
            onClick={share}
            disabled={saving || uploading}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-gold-foreground text-[11.5px] font-bold hover:bg-gold/90 disabled:opacity-50"
          >
            {(saving || uploading) && <Loader2 size={10} className="animate-spin" />}
            Share now
          </button>
        </div>
      </div>
    </div>
  )
}
