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
  const completedRef = useRef(false)
  const hasErrorRef = useRef(false)

  const [progressError, setProgressError] = useState<string | null>(null)

  // ── Helper: show error once ─────────────────────────────────────

  const showError = useCallback((msg: string) => {
    if (!hasErrorRef.current) {
      hasErrorRef.current = true
      setProgressError(msg)
    }
  }, [])

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
          showError(body?.error || `Save failed (${res.status})`)
        }
      } catch (err) {
        console.error('[VimeoPlayer] Progress save error:', err)
        showError('Network error — progress not being tracked')
      }
    },
    [videoId, showError]
  )

  // ── Initialise player & attach event listeners ────────────────

  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    // Reset state for this video instance
    completedRef.current = false
    hasErrorRef.current = false
    setProgressError(null)

    // Clean up any leftover DOM from a previous player instance
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
      playerOpts.url = `https://player.vimeo.com/video/${vimeoId}?h=${embedHash}`
    } else {
      playerOpts.id = parseInt(vimeoId, 10)
    }

    const player = new Player(containerRef.current, playerOpts)
    playerRef.current = player

    // ── Catch player-level errors (embed restrictions, load failures) ──

    player.on('error', (err: { name: string; message: string; method?: string }) => {
      console.error('[VimeoPlayer] Player error:', err)
      showError(err.message || 'Video player error')
    })

    // ── Wait for player to be ready before setting up tracking ──

    player.ready().then(() => {
      console.log('[VimeoPlayer] Player ready — tracking enabled')

      player.getDuration().then(d => {
        durationRef.current = d
      }).catch(() => {})

      // Resume from saved position
      fetch(`/api/videos/progress?video_id=${videoId}`)
        .then(r => {
          if (!r.ok) {
            return r.json().catch(() => ({})).then(body => {
              console.error('[VimeoPlayer] Progress API check failed:', r.status, body)
              showError(body?.error || `Progress tracking unavailable (${r.status})`)
            })
          }
          return r.json().then(progress => {
            if (progress && !progress.completed && progress.watched_seconds > 0) {
              player.setCurrentTime(progress.watched_seconds).catch(() => {})
            }
          })
        })
        .catch(() => {
          showError('Could not reach progress API')
        })

      // Track playback — save every PROGRESS_INTERVAL_S seconds
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

    }).catch((err: Error) => {
      // Player failed to load — embed restriction, invalid video, etc.
      console.error('[VimeoPlayer] Player failed to load:', err)
      showError(err.message || 'Video could not be loaded — check Vimeo embed domain settings')
    })

    return () => {
      if (!completedRef.current) {
        player.getCurrentTime().then(s => {
          saveProgress(s, false)
        }).catch(() => {})
      }
      player.destroy().catch(() => {})
      playerRef.current = null
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [vimeoId, videoId, embedHash, saveProgress, showError])

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
