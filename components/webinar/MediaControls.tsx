'use client'

import { useState } from 'react'
import { useLocalParticipant } from '@livekit/components-react'
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onLeave?: () => void
  /** Screen share needs a desktop browser; hidden where it cannot work. */
  canShareScreen?: boolean
}

/**
 * Mic / camera / present / leave, for speakers and hosts.
 *
 * Attendees never render this — they are view-only, and a greyed-out mic just
 * invites "how do I unmute?" questions in the chat. The absence is the
 * affordance.
 */
export function MediaControls({ onLeave, canShareScreen = true }: Props) {
  const { localParticipant } = useLocalParticipant()
  const [busy, setBusy] = useState<string | null>(null)

  const micOn = localParticipant.isMicrophoneEnabled
  const camOn = localParticipant.isCameraEnabled
  const sharing = localParticipant.isScreenShareEnabled

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      console.error(`[webinar] ${key} failed`, err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-2 bg-navy/90 backdrop-blur-sm rounded-full px-2.5 py-2 ring-1 ring-white/10 shadow-xl">
      <ControlButton
        active={micOn}
        busy={busy === 'mic'}
        label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        onClick={() => run('mic', () => localParticipant.setMicrophoneEnabled(!micOn))}
      >
        {micOn ? <Mic size={17} /> : <MicOff size={17} />}
      </ControlButton>

      <ControlButton
        active={camOn}
        busy={busy === 'cam'}
        label={camOn ? 'Turn camera off' : 'Turn camera on'}
        onClick={() => run('cam', () => localParticipant.setCameraEnabled(!camOn))}
      >
        {camOn ? <Video size={17} /> : <VideoOff size={17} />}
      </ControlButton>

      {canShareScreen && (
        <button
          type="button"
          aria-label={sharing ? 'Stop presenting' : 'Present your screen'}
          disabled={busy === 'share'}
          onClick={() =>
            run('share', () =>
              localParticipant.setScreenShareEnabled(!sharing, {
                // Carries sound from video embedded in a deck.
                audio: true,
                // The single most important option for slides: it tells the
                // encoder to keep text sharp rather than chase frame rate.
                contentHint: 'detail',
              })
            )
          }
          className={cn(
            'flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-50',
            sharing
              ? 'bg-gold text-gold-foreground hover:bg-gold/90'
              : 'bg-white/10 text-navy-foreground hover:bg-white/[0.16]'
          )}
        >
          {busy === 'share' ? <Loader2 size={16} className="animate-spin" /> : <MonitorUp size={16} />}
          <span className="hidden sm:inline">{sharing ? 'Stop presenting' : 'Present'}</span>
        </button>
      )}

      {onLeave && (
        <>
          <div className="w-px h-6 bg-white/10 mx-0.5" />
          <ControlButton active={false} destructive label="Leave" onClick={onLeave}>
            <PhoneOff size={17} />
          </ControlButton>
        </>
      )}
    </div>
  )
}

function ControlButton({
  children,
  active,
  busy,
  destructive,
  label,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  busy?: boolean
  destructive?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={onClick}
      className={cn(
        'w-10 h-10 rounded-full grid place-items-center transition-colors disabled:opacity-50',
        destructive
          ? 'bg-red-600/90 text-white hover:bg-red-600'
          : active
            ? 'bg-white/10 text-navy-foreground hover:bg-white/[0.16]'
            : 'bg-red-600/20 text-red-300 hover:bg-red-600/30'
      )}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : children}
    </button>
  )
}
