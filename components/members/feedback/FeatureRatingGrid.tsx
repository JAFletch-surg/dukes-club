'use client'

import { cn } from '@/lib/utils'
import { FEATURE_VALUE_LABELS, type SiteFeature } from '@/lib/site-feedback-questions'

interface FeatureRatingGridProps {
  /** Only the features the member said they use — see step 3. */
  features: SiteFeature[]
  value: Record<string, number> | undefined
  onChange: (value: Record<string, number>) => void
}

/**
 * One row per feature the member uses, rated 1–5 for usefulness.
 *
 * Deliberately not a <table>: on a phone each row becomes a stacked card with a
 * full-width segmented bar, which a table layout fights. The scale wording is
 * printed once above the rows rather than repeated per row.
 */
export default function FeatureRatingGrid({ features, value, onChange }: FeatureRatingGridProps) {
  const ratings = value ?? {}

  if (features.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Tick the parts you’ve used above and they’ll appear here to rate.
      </p>
    )
  }

  const setRating = (featureId: string, rating: number) => {
    // Clicking the current rating again clears it — the only way back to
    // "no opinion" once you've touched a row.
    const next = { ...ratings }
    if (next[featureId] === rating) delete next[featureId]
    else next[featureId] = rating
    onChange(next)
  }

  const ratedCount = features.filter(f => ratings[f.id] !== undefined).length

  return (
    <div>
      {/* Scale wording, printed once. On desktop it aligns over the buttons. */}
      <div className="mb-2 hidden items-center gap-4 px-1 md:flex">
        <div className="w-[220px] shrink-0" />
        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {FEATURE_VALUE_LABELS.map(label => (
            <span
              key={label}
              className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-3 flex justify-between text-[11px] text-muted-foreground md:hidden">
        <span>{FEATURE_VALUE_LABELS[0]}</span>
        <span>{FEATURE_VALUE_LABELS[FEATURE_VALUE_LABELS.length - 1]}</span>
      </div>

      <div className="space-y-2">
        {features.map(feature => {
          const rating = ratings[feature.id]
          const Icon = feature.icon
          return (
            <div
              key={feature.id}
              className={cn(
                'flex flex-col gap-3 rounded-xl border px-3.5 py-3 transition-colors md:flex-row md:items-center md:gap-4',
                rating !== undefined
                  ? 'border-l-2 border-l-gold border-border bg-card'
                  : 'border-border bg-card hover:bg-muted/30',
              )}
            >
              <div className="flex min-w-0 items-center gap-3 md:w-[220px] md:shrink-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                  <Icon size={17} />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'truncate text-sm text-foreground',
                      rating !== undefined ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {feature.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{feature.blurb}</p>
                </div>
              </div>

              <div
                role="radiogroup"
                aria-label={`How valuable is ${feature.label}?`}
                className="grid flex-1 grid-cols-5 gap-1.5"
              >
                {[1, 2, 3, 4, 5].map(point => {
                  const isSelected = rating === point
                  return (
                    <button
                      key={point}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${feature.label}: ${FEATURE_VALUE_LABELS[point - 1]}`}
                      onClick={() => setRating(feature.id, point)}
                      className={cn(
                        'rounded-lg border py-2 text-xs font-semibold transition-all',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'border-navy bg-navy text-navy-foreground shadow-sm'
                          : 'border-border bg-background text-muted-foreground hover:border-navy/40 hover:text-foreground',
                      )}
                    >
                      <span className="md:hidden">{point}</span>
                      <span className="hidden md:inline">{point}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-right text-[11px] text-muted-foreground">
        {ratedCount} of {features.length} rated
        {ratedCount < features.length && ' — skip any you’d rather not score'}
      </p>
    </div>
  )
}
