'use client'

import { cn } from '@/lib/utils'
import { npsBand } from '@/lib/site-feedback-questions'

interface ScaleSelectProps {
  /** 'nps' renders 0–10 and colour-bands the selection; 'likert' renders 1–5. */
  variant: 'nps' | 'likert'
  value: number | undefined
  onChange: (value: number) => void
  lowLabel: string
  highLabel: string
  label: string
  /** Likert only: the word under each point, e.g. 'Neutral'. */
  pointLabels?: readonly string[]
}

/**
 * The segmented numeric scale behind both the NPS question (0–10) and every
 * agreement statement (1–5). On NPS the chosen pill is coloured by band, so a
 * detractor score reads as one at a glance in a way a plain navy pill does not.
 */
export default function ScaleSelect({
  variant,
  value,
  onChange,
  lowLabel,
  highLabel,
  label,
  pointLabels,
}: ScaleSelectProps) {
  const points =
    variant === 'nps'
      ? Array.from({ length: 11 }, (_, i) => i)
      : [1, 2, 3, 4, 5]

  const selectedClasses = (point: number) => {
    if (variant === 'likert') return 'border-navy bg-navy text-navy-foreground shadow-md'
    switch (npsBand(point)) {
      case 'detractor':
        return 'border-destructive bg-destructive text-destructive-foreground shadow-md'
      case 'passive':
        return 'border-gold bg-gold text-gold-foreground shadow-md'
      case 'promoter':
        return 'border-emerald-600 bg-emerald-600 text-white shadow-md'
    }
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          'grid gap-1.5',
          // NPS wraps 0–5 / 6–10 on a phone rather than squeezing 11 across.
          variant === 'nps' ? 'grid-cols-6 sm:grid-cols-11' : 'grid-cols-5',
        )}
      >
        {points.map(point => {
          const isSelected = value === point
          return (
            <button
              key={point}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={pointLabels ? `${point} — ${pointLabels[point - 1]}` : String(point)}
              onClick={() => onChange(point)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg border py-2.5 text-sm font-semibold transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected
                  ? cn(selectedClasses(point), 'scale-105')
                  : 'border-border bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-navy/40 hover:text-foreground hover:shadow-sm',
              )}
            >
              <span>{point}</span>
              {pointLabels && (
                <span className="hidden px-1 text-center text-[10px] font-medium leading-tight opacity-80 sm:block">
                  {pointLabels[point - 1]}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}
