'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number | undefined
  onChange: (value: number) => void
  /** Rendered as the group's accessible name. */
  label: string
}

const CAPTIONS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/**
 * 1–5 stars. Hovering previews the fill up to the hovered star, which makes the
 * control feel like a slider rather than five separate buttons.
 */
export default function StarRating({ value, onChange, label }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const shown = hovered ?? value ?? 0

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} out of 5 — ${CAPTIONS[i - 1]}`}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              size={30}
              strokeWidth={1.5}
              className={cn(
                'transition-colors',
                i <= shown ? 'fill-gold text-gold' : 'fill-transparent text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
      {shown > 0 && (
        <span className="text-xs font-medium text-muted-foreground">
          {CAPTIONS[shown - 1]}
        </span>
      )}
    </div>
  )
}
