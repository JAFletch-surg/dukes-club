'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Player from '@vimeo/player'
import { AlertTriangle, X } from 'lucide-react'

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
  const completedRef = useRef(false) // track if video ended to avoid unmount regression
  const hasErrorRef = useRef(false) // only show first error, don't spam

  const [progressError, setProgressError] = useState<string | null>(null)

  // ── Save progress to API ──────────────────────────────────────

  const saveProgress = useCallback(
    async (seconds: number, completed: boolean) => {
      try {
        const res = await fetch('/api/videos/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            watched_seconds: Math.floor(seconds),
            duration_seconds: Math.floor(durationRef.current),
            completed,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error('[VimeoPlayer] Progress save failed:', res.status, body)
          if (!hasErrorRef.current) {
            hasErrorRef.current = true
            setProgressError(body?.error || `Save failed (${res.status})`)
          }
        }
      } catch (err) {
        console.error('[VimeoPlayer] Progress save error:', err)
        if (!hasErrorRef.current) {
          hasErrorRef.current = true
          setProgressError('Network error — progress not being tracked')
        }
      }
    },
    [videoId]
  )

  // ── Initialise player & attach event listeners ────────────────

  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    // Reset state for this video instance
    completedRef.current = false
    hasErrorRef.current = false
    setProgressError(null)

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

    // Preflight check: verify progress API is accessible
    fetch(`/api/videos/progress?video_id=${videoId}`)
      .then(r => {
        if (!r.ok) {
          return r.json().catch(() => ({})).then(body => {
            console.error('[VimeoPlayer] Progress API check failed:', r.status, body)
            if (!hasErrorRef.current) {
              hasErrorRef.current = true
              setProgressError(body?.error || `Progress tracking unavailable (${r.status})`)
            }
          })
        }
        return r.json().then(progress => {
          if (progress && !progress.completed && progress.watched_seconds > 0) {
            player.setCurrentTime(progress.watched_seconds).catch(() => {})
          }
        })
      })
      .catch(() => {
        if (!hasErrorRef.current) {
          hasErrorRef.current = true
          setProgressError('Could not reach progress API')
        }
      })

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
      completedRef.current = true
      saveProgress(durationRef.current, true)
    })

    return () => {
      // Only save final position on unmount if video didn't already complete
      // (avoids race condition where unmount overwrites completed=true with false)
      if (!completedRef.current) {
        player.getCurrentTime().then(s => {
          saveProgress(s, false)
        }).catch(() => {})
      }
      player.destroy().catch(() => {})
      playerRef.current = null
      // Remove all SDK-injected wrapper divs to prevent stacking on re-mount
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [vimeoId, videoId, embedHash, saveProgress])

  return (
    <div>
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden shadow-lg"
      />
      {progressError && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">
            <strong>Progress tracking issue:</strong> {progressError}
          </span>
          <button
            onClick={() => setProgressError(null)}
            className="shrink-0 text-amber-600 hover:text-amber-800"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
