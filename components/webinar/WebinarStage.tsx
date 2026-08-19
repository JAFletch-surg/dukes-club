'use client'

import { useMemo } from 'react'
import { Track, ConnectionState } from 'livekit-client'
import { useTracks, useConnectionState, useMaybeRoomContext } from '@livekit/components-react'
import { Loader2, Video as VideoIcon, WifiOff } from 'lucide-react'
import { ParticipantTile } from './ParticipantTile'
import { readMetadata, type StageMode } from '@/lib/webinars'
import { cn } from '@/lib/utils'

interface Props {
  /** Host-controlled layout. Everyone follows the same value. */
  stageMode?: StageMode
  /** LiveKit identity to feature when stageMode is 'spotlight'. */
  spotlightIdentity?: string | null
  /** Hide the camera rail so slides get the whole stage. */
  slidesOnly?: boolean
}

/**
 * The shared stage, used identically by the attendee, speaker and host views.
 *
 * The LiveKit hooks below throw outright if there is no Room in context, which
 * takes down the whole page rather than degrading — and neither the build nor
 * the typechecker can catch it, because it only happens at render. So the
 * public component is a guard: it calls the one hook that is allowed to come
 * back empty, and only mounts the hook-using body once a room actually exists.
 */
export function WebinarStage(props: Props) {
  const room = useMaybeRoomContext()

  if (!room) {
    return (
      <StageMessage icon={<Loader2 size={30} className="animate-spin text-amber-400" />}>
        Connecting to the webinar room…
      </StageMessage>
    )
  }

  return <ConnectedStage {...props} />
}

function ConnectedStage({ stageMode = 'auto', spotlightIdentity, slidesOnly }: Props) {
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
      tracks.filter(
        t => (t.publication?.source === Track.Source.Camera || !t.publication) && !!t.participant
      ),
    [tracks]
  )

  const activeCamera = useMemo(
    () => cameras.find(t => t.participant.isSpeaking) ?? cameras[0],
    [cameras]
  )

  if (connectionState === ConnectionState.Connecting) {
    return (
      <StageMessage icon={<Loader2 size={30} className="animate-spin text-amber-400" />}>
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
      <StageMessage icon={<VideoIcon size={30} className="text-slate-500" />}>
        Waiting for the speaker to join
      </StageMessage>
    )
  }

  // ── Grid: every publisher equal, for a panel ──────────────────────
  if (stageMode === 'grid') {
    const cells = screenShare ? [screenShare, ...cameras] : cameras
    return (
      <div className="w-full h-full wb-stage-well p-2">
        <div
          className={cn(
            'w-full h-full grid gap-2',
            cells.length <= 1 && 'grid-cols-1',
            cells.length === 2 && 'grid-cols-1 sm:grid-cols-2',
            cells.length === 3 && 'grid-cols-2 [&>*:first-child]:col-span-2 sm:grid-cols-3 sm:[&>*:first-child]:col-span-1',
            cells.length >= 4 && 'grid-cols-2'
          )}
        >
          {cells.slice(0, 6).map(track => (
            <div key={`${track.participant.identity}-${track.publication?.source ?? 'cam'}`} className="min-h-0">
              <ParticipantTile participant={track.participant} publication={track.publication} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Spotlight: one person fills the stage for everyone ────────────
  if (stageMode === 'spotlight' && spotlightIdentity) {
    // If the spotlit person is presenting, their slides are what "on stage"
    // means — putting their webcam up instead would be perverse.
    const theirShare =
      screenShare?.participant.identity === spotlightIdentity ? screenShare : undefined
    const theirCamera = cameras.find(t => t.participant.identity === spotlightIdentity)
    const featured = theirShare ?? theirCamera

    if (featured) {
      const rest = cameras.filter(t => t !== theirCamera)
      return (
        <StageWithRail
          main={
            <ParticipantTile
              participant={featured.participant}
              publication={featured.publication}
              variant="stage"
              showLowerThird={!theirShare}
            />
          }
          cameras={slidesOnly ? [] : rest}
        />
      )
    }
    // Spotlit person has left — fall through to auto rather than a blank stage.
  }

  // ── Share-dominant ────────────────────────────────────────────────
  if (screenShare) {
    return (
      <StageWithRail
        main={
          <ParticipantTile
            participant={screenShare.participant}
            publication={screenShare.publication}
            variant="stage"
          />
        }
        presenterName={
          readMetadata(screenShare.participant.metadata)?.name ??
          screenShare.participant.name ??
          undefined
        }
        cameras={slidesOnly ? [] : cameras}
      />
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

  // ── Active speaker + the rest alongside ───────────────────────────
  return (
    <StageWithRail
      main={
        activeCamera && (
          <ParticipantTile
            participant={activeCamera.participant}
            publication={activeCamera.publication}
            variant="stage"
            showLowerThird
          />
        )
      }
      cameras={cameras.filter(t => t !== activeCamera)}
    />
  )
}

/**
 * Main content plus the other cameras.
 *
 * The cameras used to be an `absolute bottom-3 right-3` overlay, which on a
 * phone covered the bottom-right of whatever was being presented — slides and
 * the presenter's name plate both. Everything here is in normal flow, so the
 * main content can never be obscured, in any orientation.
 */
function StageWithRail({
  main,
  cameras,
  presenterName,
}: {
  main: React.ReactNode
  cameras: any[]
  presenterName?: string
}) {
  const shown = cameras.slice(0, 4)
  const overflow = cameras.length - shown.length

  return (
    <div className="w-full h-full wb-stage-well flex flex-row min-h-0">
      <div className="relative flex-1 min-w-0 min-h-0">
        {main}
        {presenterName && (
          <div className="absolute bottom-2 left-2 max-w-[80%] bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded">
            <p className="text-[11px] text-white/90 truncate">{presenterName} — presenting</p>
          </div>
        )}
      </div>

      {/* A rail in normal flow, never an overlay. The camera tiles used to be
          absolutely positioned over the stage, which on a phone covered the
          bottom-right of whatever was being presented. Narrow on small screens
          so the slides still get most of the width. */}
      {shown.length > 0 && (
        <div className="shrink-0 flex flex-col gap-1.5 p-1.5 w-20 sm:w-32 lg:w-40 xl:w-48 overflow-y-auto">
          {shown.map(track => (
            <div key={`${track.participant.identity}-cam`} className="shrink-0 w-full aspect-video">
              <ParticipantTile participant={track.participant} publication={track.publication} />
            </div>
          ))}

          {overflow > 0 && (
            <div className="shrink-0 w-full h-8 rounded-lg bg-white/10 grid place-items-center text-white/70 text-[12px] font-semibold">
              +{overflow}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StageMessage({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full h-full grid place-items-center wb-stage-well">
      <div className="text-center px-6">
        <div className="flex justify-center mb-3">{icon}</div>
        <p className="text-slate-400 text-sm">{children}</p>
      </div>
    </div>
  )
}
