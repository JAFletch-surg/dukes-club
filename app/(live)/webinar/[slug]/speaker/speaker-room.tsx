'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import { Loader2, AlertTriangle, Radio } from 'lucide-react'
import { elapsedSince } from '@/lib/webinars'
import { WebinarShell, WebinarLayout } from '@/components/webinar/WebinarShell'
import { WebinarStage } from '@/components/webinar/WebinarStage'
import { WebinarSidebar } from '@/components/webinar/WebinarSidebar'
import { ChatPanel } from '@/components/webinar/ChatPanel'
import { QAPanel } from '@/components/webinar/QAPanel'
import { PollPanel } from '@/components/webinar/PollPanel'
import { ResourcesPanel } from '@/components/webinar/ResourcesPanel'
import { GreenRoom } from '@/components/webinar/GreenRoom'
import { MediaControls } from '@/components/webinar/MediaControls'

/** How often the speaker's sidebar refreshes. See the polling note below. */
const POLL_MS = 4000

interface SpeakerState {
  session: any
  questions: any[]
  chat: any[]
  polls: any[]
  resources: any[]
  speaker: { id: string; name: string; role: string }
}

export function SpeakerRoom({ slug }: { slug: string }) {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('t')

  const [state, setState] = useState<SpeakerState | null>(null)
  const [eventTitle, setEventTitle] = useState('')
  const [startsAt, setStartsAt] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * A guest has no auth.users row, so Supabase RLS cannot admit them and
   * Realtime is unavailable. (Signing them in anonymously would work but the
   * profiles table is readable by any authenticated user, which would hand a
   * visiting speaker the whole member directory.) So the sidebar polls a
   * service-role route instead — one speaker every few seconds is nothing.
   */
  const refresh = useCallback(async () => {
    if (!inviteToken) return
    try {
      const res = await fetch(`/api/webinars/speaker?t=${encodeURIComponent(inviteToken)}`)
      if (!res.ok) {
        if (res.status === 401) setError('invalid')
        return
      }
      setState(await res.json())
    } catch {
      // A dropped poll is not worth surfacing — the next one will catch up.
    }
  }, [inviteToken])

  // Fetch the event details up front so the green room can name the webinar.
  useEffect(() => {
    if (!inviteToken) { setError('invalid'); setLoading(false); return }

    ;(async () => {
      const res = await fetch('/api/webinars/speaker-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No displayName yet — this call is just to validate the link and read
        // the event. The real join re-mints with the chosen name.
        body: JSON.stringify({ inviteToken }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error === 'ended' ? 'ended' : 'invalid')
        setLoading(false)
        return
      }

      setEventTitle(data.event?.title ?? 'Dukes’ Club webinar')
      setStartsAt(data.event?.startsAt ?? null)
      setName(data.displayName ?? '')
      setLoading(false)
      refresh()
    })()
  }, [inviteToken, refresh])

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  async function join(displayName: string) {
    if (!inviteToken) return
    setJoining(true)
    setError(null)

    const res = await fetch('/api/webinars/speaker-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken, displayName }),
    })
    const data = await res.json()
    setJoining(false)

    if (!res.ok) {
      setError(data.error === 'ended' ? 'ended' : 'invalid')
      return
    }

    setName(data.displayName)
    setToken(data.token)
    setServerUrl(data.url)
  }

  async function post(action: 'chat' | 'answer', payload: Record<string, unknown>) {
    const res = await fetch('/api/webinars/speaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken, action, ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    await refresh()
    return { error: res.ok ? null : (data.error ?? 'Could not send') }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 grid place-items-center">
        <Loader2 size={28} className="animate-spin text-amber-700" />
      </div>
    )
  }

  if (error === 'invalid' || error === 'ended') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center px-5">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/12 grid place-items-center mx-auto mb-5">
            <AlertTriangle size={24} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            {error === 'ended' ? 'This webinar has finished' : 'This speaker link isn’t valid'}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {error === 'ended'
              ? 'Thank you for speaking. The recording will be published to Dukes’ Club members shortly.'
              : 'The link may have expired or been replaced. Please ask the organisers to send you a new one.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Green room ────────────────────────────────────────────────────
  if (!token || !serverUrl) {
    return (
      <GreenRoom
        eventTitle={eventTitle}
        startsAt={startsAt}
        initialName={name}
        sessionStatus={state?.session?.status ?? 'scheduled'}
        joining={joining}
        onJoin={join}
      />
    )
  }

  const session = state?.session
  const isLive = session?.status === 'live'

  const sidebar = (
    <WebinarSidebar
      defaultTab="qa"
      counts={{ chat: state?.chat.length, qa: state?.questions.length, resources: state?.resources.length }}
      hide={{ polls: !session?.polls_enabled }}
      chat={
        <ChatPanel
          messages={state?.chat ?? []}
          currentUserId={null}
          enabled={!!session?.chat_enabled}
          onSend={body => post('chat', { body })}
        />
      }
      qa={
        <QAPanel
          questions={state?.questions ?? []}
          currentUserId={null}
          enabled={false}
          readOnly
          canAnswer
          onAsk={async () => ({ error: null })}
          onAnswer={(questionId, answer) =>
            post('answer', {
              questionId,
              body: answer.body,
              attachmentUrl: answer.attachmentUrl,
              attachmentName: answer.attachmentName,
              attachmentType: answer.attachmentType,
            })
          }
        />
      }
      polls={
        <PollPanel
          polls={state?.polls ?? []}
          results={{}}
          enabled={false}
          readOnly
          onVote={async () => ({ error: null })}
        />
      }
      resources={<ResourcesPanel resources={state?.resources ?? []} />}
    />
  )

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video
      onDisconnected={() => setToken(null)}
      className="contents"
    >
      <RoomAudioRenderer />
      <WebinarShell
        title={eventTitle}
        status={isLive ? 'live' : 'scheduled'}
        eyebrow="You are a speaker"
        elapsed={elapsedSince(session?.started_at ?? null)}
        recording={session?.recording_status === 'recording'}
        actions={
          !isLive && (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
              <Radio size={12} /> Not broadcasting yet
            </span>
          )
        }
      >
        <WebinarLayout
          stage={<WebinarStage />}
          sidebar={sidebar}
          controls={<MediaControls />}
        />
      </WebinarShell>
    </LiveKitRoom>
  )
}
