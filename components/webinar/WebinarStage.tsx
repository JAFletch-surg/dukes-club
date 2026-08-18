'use client'

import { useMemo } from 'react'
import { Track } from 'livekit-client'
import { useTracks, useConnectionState } from '@livekit/components-react'
import { ConnectionState } from 'livekit-client'
import { Loader2, Video as VideoIcon, WifiOff } from 'lucide-react'
import { ParticipantTile } from './ParticipantTile'

/**
 * The shared stage, used identically by the attendee, speaker and host views.
 *
 * Three layouts, chosen in this order:
 *   1. Someone is sharing a screen  → share-dominant (the PowerPoint case)
 *   2. Exactly one camera           → that camera fills the stage
 *   3. Several cameras              → the active speaker leads, rest filmstrip
 */
export function WebinarStage() {
  const connectionState = useConnectionState()

  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false }
  )

  const screenShare = useMemo(
    () => tracks.find(t => t.publication?.source === Track.Source.ScreenShare),
    [tracks]
  )

  const cameras = useMemo(
    () =>
      tracks
        .filter(t => t.publication?.source === Track.Source.Camera || !t.publication)
        // Attendees never publish, so anyone here is a speaker or the host.
        .filter(t => !!t.participant),
    [tracks]
  )

  const activeCamera = useMemo(() => {
    const speaking = cameras.find(t => t.participant.isSpeaking)
    return speaking ?? cameras[0]
  }, [cameras])

  if (connectionState === ConnectionState.Connecting) {
    return (
      <StageMessage icon={<Loader2 size={30} className="animate-spin text-gold" />}>
        Connecting to the webinar room…
      </StageMessage>
    )
  }

  if (connectionState === ConnectionState.Reconnecting) {
    return (
      <StageMessage icon={<WifiOff size={30} className="text-amber-400" />}>
        Connection lost — reconnecting…
      </StageMessage>
    )
  }

  if (!screenShare && cameras.length === 0) {
    return (
      <StageMessage icon={<VideoIcon size={30} className="text-navy-foreground/30" />}>
        Waiting for the speaker to join
      </StageMessage>
    )
  }

  // ── Share-dominant ────────────────────────────────────────────────
  if (screenShare) {
    return (
      <div className="relative w-full h-full wb-stage-well">
        <ParticipantTile
          participant={screenShare.participant}
          publication={screenShare.publication}
          variant="stage"
        />

        {cameras.length > 0 && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            {cameras.slice(0, 3).map(track => (
              <div
                key={`${track.participant.identity}-cam`}
                className="w-28 sm:w-36 lg:w-40 aspect-video shadow-lg"
              >
                <ParticipantTile
                  participant={track.participant}
                  publication={track.publication}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Single camera ─────────────────────────────────────────────────
  if (cameras.length === 1) {
    return (
      <div className="w-full h-full wb-stage-well">
        <ParticipantTile
          participant={cameras[0].participant}
          publication={cameras[0].publication}
          variant="stage"
          showLowerThird
        />
      </div>
    )
  }

  // ── Active speaker + filmstrip ────────────────────────────────────
  const others = cameras.filter(t => t !== activeCamera)

  return (
    <div className="relative w-full h-full wb-stage-well">
      {activeCamera && (
        <ParticipantTile
          participant={activeCamera.participant}
          publication={activeCamera.publication}
          variant="stage"
          showLowerThird
        />
      )}

      <div className="absolute bottom-3 right-3 flex gap-2">
        {others.slice(0, 3).map(track => (
          <div
            key={`${track.participant.identity}-strip`}
            className="w-28 sm:w-36 lg:w-40 aspect-video shadow-lg"
          >
            <ParticipantTile
              participant={track.participant}
              publication={track.publication}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function StageMessage({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full h-full grid place-items-center wb-stage-well">
      <div className="text-center px-6">
        <div className="flex justify-center mb-3">{icon}</div>
        <p className="text-navy-foreground/60 text-sm">{children}</p>
      </div>
    </div>
  )
}
