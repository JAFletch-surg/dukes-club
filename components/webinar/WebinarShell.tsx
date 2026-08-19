'use client'

import Link from 'next/link'
import { Users, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  status: 'scheduled' | 'live' | 'ended' | 'processing' | 'published'
  eyebrow?: string
  elapsed?: string
  viewers?: number
  recording?: boolean
  actions?: React.ReactNode
  /** Theatre mode hides the header so the stage owns the whole viewport. */
  hideHeader?: boolean
  children: React.ReactNode
}

/**
 * The full-bleed dark frame every live surface sits in.
 *
 * The live pages deliberately sit in their own route group rather than under
 * /members, because the members layout wraps children in a padded, scrolling
 * <main> with a fixed mobile bottom nav — which a video stage cannot live
 * inside. It also means the guest-speaker route works without a session.
 */
export function WebinarShell({
  title,
  status,
  eyebrow,
  elapsed,
  viewers,
  recording,
  actions,
  hideHeader,
  children,
}: Props) {
  return (
    <div className={cn('fixed inset-0 flex flex-col text-slate-900', hideHeader ? 'bg-black' : 'bg-white')}>
      <header
        className={cn(
          'h-14 shrink-0 flex items-center gap-3 px-3 sm:px-4 border-b border-slate-200 bg-white',
          hideHeader && 'hidden'
        )}
      >
        <Link href="/members/webinars" className="shrink-0" aria-label="Back to webinars">
          <img
            src="/images/logo-navy.png"
            alt="Dukes' Club"
            className="h-7 max-w-[110px] object-contain"
          />
        </Link>

        <div className="w-px h-6 bg-slate-200 hidden sm:block" />

        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-amber-600 text-[9px] font-bold tracking-[0.18em] uppercase leading-none mb-0.5">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[15px] sm:text-lg font-semibold leading-tight truncate">{title}</h1>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {status === 'live' && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 wb-live-dot" />
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-red-400">
                Live
              </span>
            </span>
          )}

          {recording && (
            <span
              className="flex items-center gap-1.5 text-[11px] text-slate-500"
              title="This session is being recorded"
            >
              <Circle size={8} className="fill-red-500 text-red-500 wb-live-dot" />
              <span className="hidden sm:inline">REC</span>
            </span>
          )}

          {elapsed && status === 'live' && (
            <span className="text-[12px] text-slate-500 tabular-nums hidden sm:inline">
              {elapsed}
            </span>
          )}

          {typeof viewers === 'number' && (
            <span className="flex items-center gap-1.5 text-[12px] text-slate-500 tabular-nums">
              <Users size={13} />
              {viewers}
            </span>
          )}

          {actions}
        </div>
      </header>

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

/** Portrait sidebar heights. Peek leaves just the tab bar visible so the stage
 *  gets the screen; full hands the panel almost everything for reading a long
 *  Q&A thread. */
export type SheetSnap = 'peek' | 'half' | 'full'

/**
 * Portrait sizing. The panel always takes the remaining space and the *stage*
 * height is what the snap changes — sizing both independently left a band of
 * dead white below the panel, since neither was told to grow.
 */
const SNAP_STAGE: Record<SheetSnap, string> = {
  peek: 'flex-1 min-h-0',      // panel collapsed to its tab bar; stage takes the screen
  half: 'aspect-video shrink-0', // the natural default
  // Deliberately well under 16:9 — at 26vh this happened to equal the aspect
  // ratio on a 390px-wide phone, so "full" looked identical to "half".
  full: 'h-[17vh] shrink-0',
}

const SNAP_PANEL: Record<SheetSnap, string> = {
  // Tall enough for the handle plus the tab strip, so an unread badge is still
  // visible and a panel is one tap away without expanding first.
  peek: 'h-[78px] shrink-0',
  half: 'flex-1 min-h-0',
  full: 'flex-1 min-h-0',
}

const NEXT_SNAP: Record<SheetSnap, SheetSnap> = { peek: 'half', half: 'full', full: 'peek' }

/**
 * Shared body: stage plus panel.
 *
 * Three arrangements rather than the old two, because a phone in landscape is a
 * different device from a phone in portrait:
 *
 *  - **Desktop** — stage fills the column, panel a fixed rail on the right.
 *  - **Portrait** — stage 16:9 on top, panel below at one of three heights the
 *    viewer picks, so it can be got out of the way or read properly.
 *  - **Theatre (landscape)** — stage owns the viewport and the panel is gone,
 *    reachable as a translucent overlay over the right third. Slides stay
 *    unobstructed by default, which is the whole point.
 */
export function WebinarLayout({
  stage,
  sidebar,
  controls,
  theatre,
  overlayOpen,
  onOverlayChange,
  snap = 'half',
  onSnapChange,
}: {
  stage: React.ReactNode
  sidebar?: React.ReactNode
  controls?: React.ReactNode
  theatre?: boolean
  overlayOpen?: boolean
  onOverlayChange?: (open: boolean) => void
  snap?: SheetSnap
  onSnapChange?: (snap: SheetSnap) => void
}) {
  // ── Theatre: stage everywhere, panel on demand ────────────────────
  if (theatre) {
    return (
      <div className="relative h-full w-full min-h-0 bg-black">
        <div className="absolute inset-0">{stage}</div>

        {controls && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">{controls}</div>
        )}

        {sidebar && overlayOpen && (
          <>
            {/* Tap anywhere on the stage to dismiss. */}
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => onOverlayChange?.(false)}
              className="absolute inset-0 z-20 bg-black/30"
            />
            {/* Roughly the right third: enough to read a question thread, but
                the slides stay the larger half of the screen. */}
            <aside className="absolute inset-y-0 right-0 z-30 w-[42%] min-w-[260px] max-w-[360px] bg-white/95 backdrop-blur-sm border-l border-slate-200 flex flex-col wb-panel-enter">
              {sidebar}
            </aside>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      {/* Must not grow on portrait — the stage is a fixed 16:9 block and the
          panel takes the rest; flex-1 here once left a dead band under the
          video. On desktop it fills the column. */}
      <div
        className={cn(
          'relative w-full lg:!flex-1 lg:!aspect-auto lg:!h-auto lg:min-w-0 lg:min-h-0',
          SNAP_STAGE[snap]
        )}
      >
        {stage}
        {controls && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">{controls}</div>
        )}
      </div>

      {sidebar && (
        <aside
          className={cn(
            'overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col bg-slate-50',
            SNAP_PANEL[snap],
            'lg:!flex-none lg:h-auto lg:w-[360px] xl:w-[380px]'
          )}
        >
          {/* Drag handle — tap cycles peek → half → full. A tap target rather
              than a real drag: on a phone this sits directly above a scrolling
              list, and a drag gesture there fights the list. */}
          <button
            type="button"
            onClick={() => onSnapChange?.(NEXT_SNAP[snap])}
            aria-label={`Resize panel (currently ${snap})`}
            className="lg:hidden shrink-0 py-2 grid place-items-center hover:bg-slate-100 transition-colors"
          >
            <span className="w-9 h-1 rounded-full bg-slate-300" />
          </button>

          {/* Not conditionally unmounted: at peek the container is simply too
              short to show more than the tab strip, which keeps panel state
              (scroll position, a half-typed question) intact across resizes. */}
          <div className="flex-1 flex flex-col min-h-0">{sidebar}</div>
        </aside>
      )}
    </div>
  )
}
