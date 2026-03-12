'use client'

import { useEffect, useRef, useCallback } from 'react'
import Player from '@vimeo/player'

interface VimeoPlayerProps {
  vimeoId: string
  videoId: string // Supabase UUID — used for progress tracking
  embedHash?: string | null // Privacy hash for unlisted/private videos
}

const PROGRESS_INTERVAL_S = 10 // save progress every 10 seconds

export default function VimeoPlayer({ vimeoId, videoId, embedHash }: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const lastSavedRef = useRef(0)
  const durationRef = useRef(0)

  // ── Save progress to API ──────────────────────────────────────

  const saveProgress = useCallback(
    async (seconds: number, completed: boolean) => {
      try {
        await fetch('/api/videos/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            watched_seconds: Math.floor(seconds),
            duration_seconds: Math.floor(durationRef.current),
            completed,
          }),
        })
      } catch {
        // Silently fail — progress tracking is non-critical
      }
    },
    [videoId]
  )

  // ── Initialise player & attach event listeners ────────────────

  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    const playerOpts: Record<string, unknown> = {
      width: containerRef.current.offsetWidth,
      autoplay: true,
      title: false,
      byline: false,
      portrait: false,
      responsive: true,
    }

    if (embedHash) {
      // For unlisted/private videos, use the full URL with hash
      playerOpts.url = `https://player.vimeo.com/video/${vimeoId}?h=${embedHash}`
    } else {
      playerOpts.id = parseInt(vimeoId, 10)
    }

    const player = new Player(containerRef.current, playerOpts)

    playerRef.current = player

    // Store duration once ready
    player.getDuration().then(d => {
      durationRef.current = d
    })

    // Resume from saved position
    fetch(`/api/videos/progress?video_id=${videoId}`)
      .then(r => r.json())
      .then(progress => {
        if (progress && !progress.completed && progress.watched_seconds > 0) {
          player.setCurrentTime(progress.watched_seconds).catch(() => {})
        }
      })
      .catch(() => {})

    // Track playback — debounced save every PROGRESS_INTERVAL_S
    player.on('timeupdate', (event: { seconds: number; duration: number }) => {
      durationRef.current = event.duration
      if (Math.abs(event.seconds - lastSavedRef.current) >= PROGRESS_INTERVAL_S) {
        lastSavedRef.current = event.seconds
        saveProgress(event.seconds, false)
      }
    })

    // Mark completed on end
    player.on('ended', () => {
      saveProgress(durationRef.current, true)
    })

    return () => {
      // Save final position on unmount
      player.getCurrentTime().then(s => {
        saveProgress(s, false)
      }).catch(() => {})
      player.destroy()
      playerRef.current = null
    }
  }, [vimeoId, videoId, embedHash, saveProgress])

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden bg-black shadow-lg"
    />
  )
}
