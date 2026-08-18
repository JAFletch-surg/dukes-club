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
  children,
}: Props) {
  return (
    <div className="fixed inset-0 flex flex-col bg-navy text-navy-foreground">
      <header className="h-14 shrink-0 flex items-center gap-3 px-3 sm:px-4 border-b border-white/[0.08] bg-navy">
        <Link href="/members/webinars" className="shrink-0" aria-label="Back to webinars">
          <img
            src="/images/logo-white.png"
            alt="Dukes' Club"
            className="h-7 max-w-[110px] object-contain"
          />
        </Link>

        <div className="w-px h-6 bg-white/10 hidden sm:block" />

        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-gold/70 text-[9px] font-bold tracking-[0.18em] uppercase leading-none mb-0.5">
              {eyebrow}
            </p>
          )}
          <h1 className="font-serif text-[15px] sm:text-lg leading-tight truncate">{title}</h1>
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
              className="flex items-center gap-1.5 text-[11px] text-navy-foreground/50"
              title="This session is being recorded"
            >
              <Circle size={8} className="fill-red-500 text-red-500 wb-live-dot" />
              <span className="hidden sm:inline">REC</span>
            </span>
          )}

          {elapsed && status === 'live' && (
            <span className="text-[12px] text-navy-foreground/50 tabular-nums hidden sm:inline">
              {elapsed}
            </span>
          )}

          {typeof viewers === 'number' && (
            <span className="flex items-center gap-1.5 text-[12px] text-navy-foreground/50 tabular-nums">
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

/** Shared three-zone body: stage on the left, sidebar on the right, and a
 *  stacked layout below the lg breakpoint. */
export function WebinarLayout({
  stage,
  sidebar,
  controls,
}: {
  stage: React.ReactNode
  sidebar?: React.ReactNode
  controls?: React.ReactNode
}) {
  return (
    <div className={cn('h-full flex flex-col lg:flex-row min-h-0')}>
      <div className="relative flex-1 min-h-0 lg:min-w-0 flex flex-col">
        {/* On mobile the stage is a fixed 16:9 block pinned to the top so the
            sidebar below it always has room; on desktop it fills the column. */}
        <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 lg:min-h-0 shrink-0">
          {stage}
          {controls && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">{controls}</div>
          )}
        </div>
      </div>

      {sidebar && (
        <aside className="flex-1 lg:flex-none lg:w-[360px] xl:w-[380px] min-h-0 border-t lg:border-t-0 lg:border-l border-white/[0.08] flex flex-col">
          {sidebar}
        </aside>
      )}
    </div>
  )
}
