'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import { Loader2, Calendar, ArrowLeft, Lock, Clock, PlayCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { registerForEvent } from '@/lib/events'
import { useWebinarRealtime } from '@/lib/use-webinar-realtime'
import { countdownTo, elapsedSince, type WebinarSession } from '@/lib/webinars'
import { WebinarShell, WebinarLayout, type SheetSnap } from '@/components/webinar/WebinarShell'
import { TheatreControls } from '@/components/webinar/StageControls'
import { useTheatre } from '@/lib/use-theatre'
import { WebinarStage } from '@/components/webinar/WebinarStage'
import { WebinarSidebar } from '@/components/webinar/WebinarSidebar'
import { ChatPanel } from '@/components/webinar/ChatPanel'
import { QAPanel } from '@/components/webinar/QAPanel'
import { PollPanel } from '@/components/webinar/PollPanel'
import { ResourcesPanel } from '@/components/webinar/ResourcesPanel'
import VimeoPlayer from '@/components/members/VimeoPlayer'

interface EventRow {
  id: string
  title: string
  slug: string
  description_plain: string | null
  starts_at: string
  ends_at: string | null
  featured_image_url: string | null
  auto_approve: boolean
}

interface Props {
  event: EventRow
  initialSession: WebinarSession
  booking: { id: string; status: string } | null
  userId: string
  displayName: string
  isAdmin: boolean
}

/**
 * What an attendee sees. They are view-only by construction — the token minted
 * for them has canPublish:false — so there are no mic or camera controls
 * anywhere on this page. The absence is the affordance; a greyed-out mic just
 * invites "how do I unmute?" in the chat.
 */
export function AttendeeRoom({
  event,
  initialSession,
  booking: initialBooking,
  userId,
  displayName,
  isAdmin,
}: Props) {
  const supabase = createClient()

  const [booking, setBooking] = useState(initialBooking)
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Mobile viewing state: theatre fills the screen in landscape, the panel
  // becomes a tap-to-open overlay there, and in portrait it has three heights.
  const surfaceRef = useRef<HTMLDivElement>(null)
  const { theatre, toggle: toggleTheatre } = useTheatre(surfaceRef)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [snap, setSnap] = useState<SheetSnap>('half')

  const {
    session, messages, questions, polls, resources, results,
    sendMessage, askQuestion, vote,
  } = useWebinarRealtime({ sessionId: initialSession.id, userId })

  const live = session ?? initialSession
  const registered = !!booking && ['approved', 'confirmed'].includes(booking.status)
  /** Badges the overlay button in theatre, so a poll launching mid-talk is
   *  not missed while the panel is hidden. */
  const livePoll = polls.some(p => p.status === 'live')

  // Drives the countdown and the elapsed clock.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const fetchToken = useCallback(async () => {
    setConnecting(true)
    setJoinError(null)

    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession) { setJoinError('Your session has expired. Please sign in again.'); setConnecting(false); return }

    const res = await fetch('/api/webinars/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSession.access_token}`,
      },
      body: JSON.stringify({ eventId: event.id }),
    })

    const data = await res.json()
    setConnecting(false)

    if (!res.ok) {
      // 'not_live' is expected before the host starts — the lobby handles it.
      if (data.error !== 'not_live') setJoinError(data.message || 'Could not join the webinar.')
      return
    }

    setToken(data.token)
    setServerUrl(data.url)
  }, [event.id, supabase])

  // Join automatically the moment the host goes live.
  useEffect(() => {
    if (live.status === 'live' && registered && !token && !connecting) {
      fetchToken()
    }
  }, [live.status, registered, token, connecting, fetchToken])

  async function register() {
    setConnecting(true)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, training_stage, region')
      .eq('id', userId)
      .single()

    const { booking: created, error } = await registerForEvent(supabase, {
      eventId: event.id,
      userId,
      status: event.auto_approve ? 'approved' : 'pending',
      applicantName: profile?.full_name ?? displayName,
      applicantEmail: profile?.email ?? '',
      applicantTrainingLevel: profile?.training_stage ?? '',
      applicantHospital: '',
      applicantDeanery: profile?.region ?? '',
    })

    setConnecting(false)
    if (!error && created) setBooking(created)
  }

  const sidebar = (
    <WebinarSidebar
      defaultTab="qa"
      counts={{ chat: messages.length, qa: questions.length, polls: polls.filter(p => p.status !== 'draft').length, resources: resources.length }}
      hide={{ chat: !live.chat_enabled, qa: !live.qa_enabled, polls: !live.polls_enabled }}
      attention={{ polls: polls.some(p => p.status === 'live') }}
      chat={
        <ChatPanel
          messages={messages}
          currentUserId={userId}
          enabled={live.chat_enabled && live.status === 'live'}
          readOnly={live.status === 'ended' || live.status === 'published'}
          onSend={body => sendMessage(body, displayName, isAdmin)}
        />
      }
      qa={
        <QAPanel
          questions={questions}
          currentUserId={userId}
          enabled={live.qa_enabled && live.status === 'live'}
          readOnly={live.status === 'ended' || live.status === 'published'}
          onAsk={body => askQuestion(body, displayName)}
        />
      }
      polls={
        <PollPanel
          polls={polls}
          results={results}
          enabled={live.polls_enabled}
          onVote={vote}
        />
      }
      resources={<ResourcesPanel resources={resources} />}
    />
  )

  // ── Not registered ────────────────────────────────────────────────
  if (!registered) {
    return (
      <Gate
        event={event}
        icon={<Lock size={26} className="text-amber-700" />}
        title={booking?.status === 'pending' ? 'Your place is awaiting approval' : 'Register to join'}
        body={
          booking?.status === 'pending'
            ? 'The organisers will confirm your place shortly. You will receive an email as soon as it is approved, and this page will let you in.'
            : 'This webinar is open to Dukes’ Club members. Register now and you can join as soon as it starts.'
        }
        action={
          !booking && (
            <button
              type="button"
              onClick={register}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gold text-gold-foreground font-semibold text-sm hover:bg-gold/90 disabled:opacity-50"
            >
              {connecting && <Loader2 size={15} className="animate-spin" />}
              Register for this webinar
            </button>
          )
        }
      />
    )
  }

  // ── Ended ─────────────────────────────────────────────────────────
  if (live.status === 'ended' || live.status === 'processing' || live.status === 'published') {
    return (
      <WebinarShell title={event.title} status={live.status} eyebrow="Dukes’ Live">
        <div className="h-full flex flex-col lg:flex-row min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-8">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight mb-2">This webinar has finished</h2>

              {live.recording_video_id ? (
                <>
                  <p className="text-slate-500 text-sm mb-5">
                    The recording is ready to watch.
                  </p>
                  <div className="rounded-xl overflow-hidden ring-1 ring-slate-200">
                    <RecordingPlayer videoId={live.recording_video_id} />
                  </div>
                </>
              ) : (
                <div className="flex gap-3 p-4 rounded-lg bg-white ring-1 ring-slate-200">
                  <Clock size={17} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-700 mb-1">
                      The recording is being processed
                    </p>
                    <p className="text-[12.5px] text-slate-400 leading-relaxed">
                      It usually appears within an hour or two, here and in the webinars
                      library. We’ll email you when it’s ready.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/members/webinars"
                  className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft size={14} /> Back to webinars
                </Link>
                {live.recording_video_id && (
                  <Link
                    href={`/members/videos?v=${live.recording_video_id}`}
                    className="inline-flex items-center gap-2 text-[13px] text-amber-700 hover:underline"
                  >
                    <PlayCircle size={14} /> Open in the video library
                  </Link>
                )}
              </div>
            </div>
          </div>

          <aside className="flex-1 lg:flex-none lg:w-[360px] xl:w-[380px] min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col">
            {sidebar}
          </aside>
        </div>
      </WebinarShell>
    )
  }

  // ── Pre-live lobby ────────────────────────────────────────────────
  if (live.status !== 'live' || !token || !serverUrl) {
    return (
      <WebinarShell title={event.title} status={live.status} eyebrow="Dukes’ Live">
        <div className="h-full flex flex-col lg:flex-row min-h-0">
          <div className="relative flex-1 min-h-0 wb-stage-well grid place-items-center overflow-hidden">
            {event.featured_image_url && (
              <img
                src={event.featured_image_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20"
              />
            )}
            <div className="relative text-center px-6 py-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-5 h-px bg-gold" />
                <p className="text-amber-700 text-[10px] font-bold tracking-[0.2em]">STARTING SOON</p>
                <div className="w-5 h-px bg-gold" />
              </div>

              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight mb-4 max-w-2xl">
                {event.title}
              </h2>

              <p className="text-5xl sm:text-6xl font-bold tracking-tight text-amber-700 tabular-nums mb-3">
                {countdownTo(event.starts_at)}
              </p>

              <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                <Calendar size={14} />
                {new Date(event.starts_at).toLocaleString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>

              {joinError && <p className="text-red-300 text-[12.5px] mt-4">{joinError}</p>}

              <p className="text-slate-400 text-[12px] mt-6 max-w-md mx-auto leading-relaxed">
                You’re registered. This page will take you straight in the moment the
                host goes live — no need to refresh.
              </p>
            </div>
          </div>

          <aside className="flex-1 lg:flex-none lg:w-[360px] xl:w-[380px] min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col">
            {sidebar}
          </aside>
        </div>
      </WebinarShell>
    )
  }

  // ── Live ──────────────────────────────────────────────────────────
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio={false}
      video={false}
      onDisconnected={() => setToken(null)}
      className="contents"
    >
      <RoomAudioRenderer />
      <WebinarShell
        title={event.title}
        status="live"
        eyebrow="Dukes’ Live"
        elapsed={elapsedSince(live.started_at)}
        viewers={live.peak_attendees || undefined}
        recording={live.recording_status === 'recording'}
        hideHeader={theatre}
      >
        <div ref={surfaceRef} className="h-full">
          <WebinarLayout
            theatre={theatre}
            overlayOpen={overlayOpen}
            onOverlayChange={setOverlayOpen}
            snap={snap}
            onSnapChange={setSnap}
            stage={
              <>
                <WebinarStage
                  stageMode={live.stage_mode}
                  spotlightIdentity={live.spotlight_identity}
                />
                <TheatreControls
                  theatre={theatre}
                  onToggleTheatre={toggleTheatre}
                  onOpenPanel={() => setOverlayOpen(true)}
                  unread={livePoll}
                />
              </>
            }
            sidebar={sidebar}
          />
        </div>
      </WebinarShell>
    </LiveKitRoom>
  )
}

/** Loads the Vimeo id for a finished recording and hands it to the existing
 *  members player, rather than introducing a second video player. */
function RecordingPlayer({ videoId }: { videoId: string }) {
  const supabase = createClient()
  const [video, setVideo] = useState<{ vimeo_id: string; vimeo_embed_hash: string | null } | null>(null)

  useEffect(() => {
    supabase
      .from('videos')
      .select('vimeo_id, vimeo_embed_hash')
      .eq('id', videoId)
      .maybeSingle()
      .then(({ data }) => setVideo(data as any))
  }, [videoId, supabase])

  if (!video) {
    return (
      <div className="aspect-video bg-black/50 grid place-items-center">
        <Loader2 size={22} className="animate-spin text-amber-700" />
      </div>
    )
  }

  return (
    <VimeoPlayer
      vimeoId={video.vimeo_id}
      videoId={videoId}
      embedHash={video.vimeo_embed_hash ?? undefined}
    />
  )
}

function Gate({
  event,
  icon,
  title,
  body,
  action,
}: {
  event: EventRow
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center px-5 py-12">
      <div className="max-w-lg text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 grid place-items-center mx-auto mb-5">
          {icon}
        </div>
        <p className="text-amber-700 text-[10px] font-bold tracking-[0.2em] mb-2">DUKES’ LIVE</p>
        <h1 className="text-3xl font-bold tracking-tight leading-tight mb-2">{title}</h1>
        <p className="text-slate-400 text-lg mb-4">{event.title}</p>
        <p className="text-slate-500 text-sm leading-relaxed mb-7">{body}</p>
        {action}
        <div className="mt-7">
          <Link
            href="/members/webinars"
            className="inline-flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Back to webinars
          </Link>
        </div>
      </div>
    </div>
  )
}
