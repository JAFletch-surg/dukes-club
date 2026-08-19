'use client'

import { useEffect, useRef, useState } from 'react'
import { createLocalVideoTrack, createLocalAudioTrack, type LocalVideoTrack, type LocalAudioTrack } from 'livekit-client'
import { Check, X, AlertTriangle, Loader2, Mic, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  eventTitle: string
  startsAt?: string | null
  initialName: string
  sessionStatus: string
  joining?: boolean
  onJoin: (displayName: string) => void
}

type CheckState = 'checking' | 'ok' | 'fail'

/**
 * The speaker's green room. A visiting consultant lands here from an email
 * link, has never seen this site, and is about to present — so the goal is
 * zero ambiguity about whether their kit works.
 *
 * "Test your slides" is the control that earns its keep: it opens the
 * screen-share picker BEFORE going live, so the first attempt is not in front
 * of the audience.
 */
export function GreenRoom({
  eventTitle,
  startsAt,
  initialName,
  sessionStatus,
  joining,
  onJoin,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const audioTrackRef = useRef<LocalAudioTrack | null>(null)
  const rafRef = useRef<number | null>(null)

  const [name, setName] = useState(initialName)
  const [camera, setCamera] = useState<CheckState>('checking')
  const [mic, setMic] = useState<CheckState>('checking')
  const [level, setLevel] = useState(0)
  const [shareTested, setShareTested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Screen capture is desktop-only. iOS Safari cannot do it at all, and a
  // speaker should learn that now rather than three minutes before going live.
  const canShareScreen =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function'

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const vt = await createLocalVideoTrack()
        if (cancelled) { vt.stop(); return }
        trackRef.current = vt
        if (videoRef.current) vt.attach(videoRef.current)
        setCamera('ok')
      } catch {
        setCamera('fail')
      }

      try {
        const at = await createLocalAudioTrack()
        if (cancelled) { at.stop(); return }
        audioTrackRef.current = at
        setMic('ok')
        meter(at)
      } catch {
        setMic('fail')
      }
    })()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      trackRef.current?.stop()
      audioTrackRef.current?.stop()
    }
  }, [])

  /** Live input level, so the speaker can see the meter move when they talk. */
  function meter(track: LocalAudioTrack) {
    try {
      const stream = new MediaStream([track.mediaStreamTrack])
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setLevel(Math.min(100, Math.round((avg / 128) * 100)))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // A missing AudioContext is not worth failing the mic check over.
    }
  }

  async function testShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setShareTested(true)
      setError(null)
    } catch {
      setError('Screen sharing was cancelled or blocked. Check your browser permissions and try again.')
    }
  }

  const statusLine =
    sessionStatus === 'live'
      ? 'The webinar is live now — join when you are ready.'
      : sessionStatus === 'ended'
        ? 'This webinar has finished.'
        : startsAt
          ? `Starts ${new Date(startsAt).toLocaleString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}`
          : 'The host has not opened the room yet.'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 grid place-items-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-px bg-gold" />
          <p className="text-amber-700 text-[11px] font-bold tracking-[0.2em]">SPEAKER GREEN ROOM</p>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-1.5">
          You’re speaking at <span className="italic">{eventTitle}</span>
        </h1>
        <p className="text-slate-900/60 text-sm mb-7">{statusLine}</p>

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          {/* Preview */}
          <div>
            <div className="aspect-video rounded-xl overflow-hidden ring-1 ring-slate-300 bg-slate-900 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {camera === 'checking' && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2 size={24} className="animate-spin text-gold" />
                </div>
              )}
              {camera === 'fail' && (
                <div className="absolute inset-0 grid place-items-center text-center px-6">
                  <div>
                    <Video size={26} className="text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">
                      No camera access. Check the padlock icon in your browser’s address bar.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mic level */}
            <div className="mt-3 flex items-center gap-3">
              <Mic size={15} className={mic === 'ok' ? 'text-gold' : 'text-slate-400'} />
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gold transition-[width] duration-75"
                  style={{ width: `${level}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 w-24 text-right">
                {mic === 'ok' ? 'Say something' : mic === 'checking' ? 'Checking…' : 'No microphone'}
              </span>
            </div>
          </div>

          {/* Checklist + join */}
          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.14em] uppercase text-slate-500 mb-1.5">
                How your name appears on screen
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white ring-1 ring-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                placeholder="Miss Jane Smith"
              />
            </div>

            <div className="space-y-2">
              <CheckRow state={camera} label="Camera" />
              <CheckRow state={mic} label="Microphone" />
              <CheckRow
                state={canShareScreen ? (shareTested ? 'ok' : 'checking') : 'fail'}
                label="Screen sharing"
                hint={
                  !canShareScreen
                    ? 'Not available in this browser'
                    : shareTested
                      ? 'Tested'
                      : 'Not tested yet'
                }
              />
            </div>

            {!canShareScreen && (
              <div className="flex gap-2.5 p-3 rounded-lg bg-amber-50 ring-1 ring-amber-300">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[12.5px] leading-relaxed text-amber-900">
                  Screen sharing isn’t available in this browser. To present slides, join from a
                  laptop using Chrome, Edge or Safari.
                </p>
              </div>
            )}

            {canShareScreen && (
              <button
                type="button"
                onClick={testShare}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-white ring-1 ring-slate-300 hover:bg-slate-50 transition-colors"
              >
                {shareTested ? 'Test your slides again' : 'Test your slides'}
              </button>
            )}

            {error && <p className="text-[12.5px] text-red-300">{error}</p>}

            <button
              type="button"
              disabled={joining || sessionStatus === 'ended'}
              onClick={() => onJoin(name.trim() || initialName)}
              className="w-full py-3 rounded-lg bg-gold text-gold-foreground font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {joining && <Loader2 size={15} className="animate-spin" />}
              {sessionStatus === 'live' ? 'Join the live webinar' : 'Join as speaker'}
            </button>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Nothing is broadcast until you join. Your camera and microphone stay on this
              device until then.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckRow({ state, label, hint }: { state: CheckState; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          'w-5 h-5 rounded-full grid place-items-center shrink-0',
          state === 'ok' && 'bg-emerald-500/20 text-emerald-400',
          state === 'fail' && 'bg-red-500/20 text-red-400',
          state === 'checking' && 'bg-white/10 text-slate-500'
        )}
      >
        {state === 'ok' ? <Check size={12} /> : state === 'fail' ? <X size={12} /> : <Loader2 size={11} className="animate-spin" />}
      </span>
      <span className="text-slate-700">{label}</span>
      {hint && <span className="ml-auto text-[11px] text-slate-400">{hint}</span>}
    </div>
  )
}
