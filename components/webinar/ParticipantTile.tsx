'use client'

import { useEffect, useRef } from 'react'
import { Track, type Participant, type TrackPublication } from 'livekit-client'
import { MicOff, Monitor } from 'lucide-react'
import { readMetadata } from '@/lib/webinars'
import { cn } from '@/lib/utils'

interface Props {
  participant: Participant
  publication?: TrackPublication
  /** Screen shares fill the stage; cameras are cropped to fill their tile. */
  variant?: 'stage' | 'tile'
  showLowerThird?: boolean
  className?: string
}

/**
 * A single video tile, styled to the Dukes' palette rather than LiveKit's.
 * We attach tracks by hand instead of using <VideoTrack>, which keeps the
 * markup ours and lets the screen-share case use object-contain — cropping a
 * PowerPoint slide is worse than letterboxing it.
 */
export function ParticipantTile({
  participant,
  publication,
  variant = 'tile',
  showLowerThird = false,
  className,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const meta = readMetadata(participant.metadata)
  const name = participant.name || meta?.name || 'Speaker'
  const isScreenShare = publication?.source === Track.Source.ScreenShare
  const isSpeaking = participant.isSpeaking && !isScreenShare
  const micMuted = participant.isMicrophoneEnabled === false

  useEffect(() => {
    const track = publication?.track
    if (!track || !videoRef.current) return
    if (track.kind !== Track.Kind.Video) return

    track.attach(videoRef.current)
    return () => { track.detach() }
  }, [publication?.track])

  useEffect(() => {
    // Local participants must never hear themselves.
    if (participant.isLocal) return
    const pub = participant.getTrackPublication(Track.Source.Microphone)
    if (!pub?.track || !audioRef.current) return

    pub.track.attach(audioRef.current)
    return () => { pub.track?.detach() }
  }, [participant])

  const hasVideo = !!publication?.track && publication.isSubscribed !== false

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-black/60',
        variant === 'stage' ? 'w-full h-full' : 'rounded-lg ring-1 ring-white/10',
        isSpeaking && 'ring-2 ring-gold',
        className
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={cn(
            'w-full h-full',
            isScreenShare ? 'object-contain' : 'object-cover',
            // A local camera preview should mirror; a shared screen must not.
            participant.isLocal && !isScreenShare && 'scale-x-[-1]'
          )}
        />
      ) : (
        <div className="w-full h-full grid place-items-center bg-navy">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-gold/15 text-gold grid place-items-center mx-auto mb-2 font-semibold text-lg">
              {initials(name)}
            </div>
            <p className="text-navy-foreground/50 text-xs">Camera off</p>
          </div>
        </div>
      )}

      {!participant.isLocal && <audio ref={audioRef} autoPlay />}

      {/* Lower third — used on the stage, where there is room for it */}
      {showLowerThird && !isScreenShare && (
        <div className="absolute bottom-4 left-4 max-w-[70%] bg-navy/85 backdrop-blur-sm px-3.5 py-2 rounded-md">
          <p className="text-lg font-semibold leading-tight text-white truncate">{name}</p>
          {meta?.title && (
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-gold mt-0.5 truncate">
              {meta.title}
            </p>
          )}
        </div>
      )}

      {/* Compact name chip — used on filmstrip tiles */}
      {!showLowerThird && (
        <div className="absolute bottom-0 inset-x-0 flex items-center gap-1.5 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
          {micMuted && <MicOff size={11} className="text-red-400 shrink-0" />}
          {isScreenShare && <Monitor size={11} className="text-gold shrink-0" />}
          <span className="text-[11px] font-medium text-white/90 truncate">
            {isScreenShare ? `${name} — presenting` : name}
          </span>
        </div>
      )}
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}
