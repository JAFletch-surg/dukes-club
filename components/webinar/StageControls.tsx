'use client'

import { Maximize2, Minimize2, MessageSquare, Monitor, LayoutGrid, User, Sparkles } from 'lucide-react'
import { STAGE_MODE_HINTS, STAGE_MODE_LABELS, type StageMode } from '@/lib/webinars'
import { cn } from '@/lib/utils'

const MODE_ICON: Record<StageMode, typeof Sparkles> = {
  auto: Sparkles,
  spotlight: User,
  grid: LayoutGrid,
}

/**
 * Host-only. Sets the layout everyone sees — this is the fix for each viewer's
 * browser previously deciding for itself, which meant two attendees could be
 * looking at different people during a handover.
 */
export function StageModeControls({
  mode,
  onChange,
  slidesOnly,
  onSlidesOnlyChange,
  hasShare,
  disabled,
}: {
  mode: StageMode
  onChange: (mode: StageMode) => void
  slidesOnly?: boolean
  onSlidesOnlyChange?: (v: boolean) => void
  hasShare?: boolean
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {(['auto', 'spotlight', 'grid'] as StageMode[]).map(m => {
          const Icon = MODE_ICON[m]
          const active = mode === m
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onChange(m)}
              title={STAGE_MODE_HINTS[m]}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40',
                active
                  ? 'bg-primary text-white'
                  : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icon size={14} />
              {STAGE_MODE_LABELS[m]}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-slate-500 leading-snug px-0.5">{STAGE_MODE_HINTS[mode]}</p>

      {hasShare && onSlidesOnlyChange && (
        <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer px-0.5">
          <input
            type="checkbox"
            checked={!!slidesOnly}
            onChange={e => onSlidesOnlyChange(e.target.checked)}
            className="accent-[hsl(207_90%_42%)] w-3.5 h-3.5"
          />
          <Monitor size={12} />
          Slides only — hide the camera rail
        </label>
      )}
    </div>
  )
}

/**
 * Floating buttons over the stage: enter/leave theatre, and (in theatre) open
 * the chat/Q&A/polls overlay. The badge is what stops someone missing a poll
 * while they are watching full-screen.
 */
export function TheatreControls({
  theatre,
  onToggleTheatre,
  onOpenPanel,
  unread,
}: {
  theatre: boolean
  onToggleTheatre: () => void
  onOpenPanel?: () => void
  unread?: boolean
}) {
  return (
    <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
      {theatre && onOpenPanel && (
        <button
          type="button"
          onClick={onOpenPanel}
          aria-label="Open chat, questions and polls"
          className="relative w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm text-white grid place-items-center hover:bg-black/70 transition-colors"
        >
          <MessageSquare size={16} />
          {unread && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 wb-live-dot" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={onToggleTheatre}
        aria-label={theatre ? 'Leave full screen' : 'Full screen'}
        className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm text-white grid place-items-center hover:bg-black/70 transition-colors"
      >
        {theatre ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  )
}
