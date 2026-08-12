'use client'

import { cn } from '@/lib/utils'
import { SITE_FEEDBACK_STEPS } from '@/lib/site-feedback-questions'

interface StepProgressProps {
  /** Zero-based index of the step being shown. */
  current: number
}

export default function StepProgress({ current }: StepProgressProps) {
  const total = SITE_FEEDBACK_STEPS.length
  const step = SITE_FEEDBACK_STEPS[current]
  const percent = Math.round(((current + 1) / total) * 100)

  return (
    // Deliberately not sticky: the members layout scrolls <main>, not the
    // window, and a sticky bar inside that padded scroll container leaves a gap
    // for content to show through. Steps are short enough not to need it.
    <div className="mb-6 rounded-xl border border-border bg-card px-5 py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Step {current + 1} of {total}
          <span className="ml-2 normal-case text-foreground">{step.title}</span>
        </p>
        <div className="flex items-center gap-1.5">
          {SITE_FEEDBACK_STEPS.map((s, i) => (
            <span
              key={s.id}
              aria-hidden
              className={cn(
                'h-1.5 rounded-full transition-all',
                i < current && 'w-1.5 bg-gold',
                i === current && 'w-6 bg-gold',
                i > current && 'w-1.5 bg-muted',
              )}
            />
          ))}
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gold transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
