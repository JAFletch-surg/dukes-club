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
  const baseWatchedRef = useRef(0)    // accumulated watched_seconds from previous sessions
  const sessionWatchedRef = useRef(0) // watch time accumulated this session (wall-clock)
  const playStartRef = useRef<number | null>(null) // timestamp when playback started

  // ── Accumulate wall-clock watch time ────────────────────────────
  // Called whenever playback pauses, ends, or we need current total.
  // Uses Date.now() delta since last play event — simple and reliable.

  const flushWatchTime = useCallback(() => {
    if (playStartRef.current !== null) {
      const elapsed = (Date.now() - playStartRef.current) / 1000
      sessionWatchedRef.current += elapsed
      playStartRef.current = Date.now() // reset for next interval
    }
  }, [])

  // ── Save progress to API ──────────────────────────────────────

  const saveProgress = useCallback(
    async (position: number, completed: boolean) => {
      flushWatchTime()
      const totalWatched = baseWatchedRef.current + sessionWatchedRef.current
      try {
        await fetch('/api/videos/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            watched_seconds: Math.floor(totalWatched),
            last_position: Math.floor(position),
            duration_seconds: Math.floor(durationRef.current),
            completed,
          }),
        })
      } catch {
        // Silently fail — progress tracking is non-critical
      }
    },
    [videoId, flushWatchTime]
  )

  // ── Initialise player & attach event listeners ────────────────

  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    // Clean up any leftover DOM from a previous player instance
    // (React StrictMode double-mounts; destroy() is async so wrapper divs may linger)
    if (playerRef.current) {
      playerRef.current.destroy().catch(() => {})
      playerRef.current = null
    }
    containerRef.current.innerHTML = ''

    const playerOpts: Record<string, unknown> = {
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

    // Resume from saved position & load accumulated watch time
    fetch(`/api/videos/progress?video_id=${videoId}`)
      .then(r => r.json())
      .then(progress => {
        if (progress) {
          baseWatchedRef.current = progress.watched_seconds || 0
          if (!progress.completed && progress.last_position > 0) {
            player.setCurrentTime(progress.last_position).catch(() => {})
          }
        }
      })
      .catch(() => {})

    // Start wall-clock timer when video plays
    player.on('play', () => {
      playStartRef.current = Date.now()
    })

    // Stop wall-clock timer when video pauses
    player.on('pause', () => {
      if (playStartRef.current !== null) {
        sessionWatchedRef.current += (Date.now() - playStartRef.current) / 1000
        playStartRef.current = null
      }
    })

    // Track playback position — debounced save every PROGRESS_INTERVAL_S
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
      player.destroy().catch(() => {})
      playerRef.current = null
      // Remove all SDK-injected wrapper divs to prevent stacking on re-mount
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [vimeoId, videoId, embedHash, saveProgress])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden shadow-lg"
    />
  )
}
