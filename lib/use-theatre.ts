'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Theatre mode for the live stage.
 *
 * Fullscreen is genuinely awkward on phones: `Element.requestFullscreen()` only
 * reached iPhone Safari around 17.2–17.4 and was unreliable for years before
 * that, where fullscreen worked on <video> elements alone. So a CSS theatre
 * mode is the primary mechanism — it fills the viewport everywhere and depends
 * on nothing — and the real Fullscreen API is layered on where it is present,
 * feature-detected rather than sniffed by user agent.
 *
 * Rotating a phone to landscape offers theatre automatically; it is never
 * forced, and rotating back leaves it.
 */
export function useTheatre(containerRef: React.RefObject<HTMLElement | null>) {
  const [theatre, setTheatre] = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)
  /** True once the user has deliberately left theatre, so rotation stops nagging. */
  const optedOut = useRef(false)

  // ── Orientation ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Coarse pointer keeps this to touch devices — a short desktop window is
    // not a phone held sideways.
    const mq = window.matchMedia('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)')

    const apply = (matches: boolean) => {
      setIsLandscape(matches)
      if (matches && !optedOut.current) setTheatre(true)
      if (!matches) setTheatre(false)
    }

    apply(mq.matches)
    const onChange = (e: MediaQueryListEvent) => apply(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ── Native fullscreen, where it exists ────────────────────────────
  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (el.requestFullscreen) await el.requestFullscreen()
    } catch {
      // Denied or unsupported — theatre mode alone still fills the viewport.
    }
  }, [containerRef])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen()
    } catch {
      /* nothing useful to do */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheatre(prev => {
      const next = !prev
      optedOut.current = !next
      if (next) enterFullscreen()
      else exitFullscreen()
      return next
    })
  }, [enterFullscreen, exitFullscreen])

  // Leaving fullscreen by the browser's own gesture should leave theatre too.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && !isLandscape) setTheatre(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [isLandscape])

  return { theatre, isLandscape, toggle }
}

/**
 * iPhone can put a <video> into real fullscreen even where it refuses to do so
 * for a div. Worth offering for a shared screen — you lose the name plates, but
 * you gain the whole display for someone's slides.
 */
export function nativeVideoFullscreen(container: HTMLElement | null): boolean {
  const video = container?.querySelector('video') as any
  if (video?.webkitEnterFullscreen) {
    video.webkitEnterFullscreen()
    return true
  }
  return false
}

export function supportsElementFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return typeof document.documentElement.requestFullscreen === 'function'
}
