'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SITE_FEATURES } from '@/lib/site-feedback-questions'

interface OptionChipsProps {
  options: string[]
  multi: boolean
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
  label: string
  /** Picking this clears every other selection, and picking any other clears it. */
  exclusiveOption?: string
}

/** Feature options get their own icon, which makes the long list scannable. */
const iconFor = (option: string) =>
  SITE_FEATURES.find(f => f.label === option)?.icon

/**
 * Tile-style selector covering both single choice and multi-select. Chips
 * rather than radios/checkboxes because most of these lists are eleven items
 * long and need to be tappable on a phone.
 */
export default function OptionChips({
  options,
  multi,
  value,
  onChange,
  label,
  exclusiveOption,
}: OptionChipsProps) {
  const selected: string[] = multi
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === 'string' && value
      ? [value]
      : []

  const toggle = (option: string) => {
    if (!multi) {
      onChange(option)
      return
    }
    if (option === exclusiveOption) {
      // "None of these yet" is a statement about everything else.
      onChange(selected.includes(option) ? [] : [option])
      return
    }
    const withoutExclusive = selected.filter(o => o !== exclusiveOption)
    onChange(
      withoutExclusive.includes(option)
        ? withoutExclusive.filter(o => o !== option)
        : [...withoutExclusive, option],
    )
  }

  const allOptions = exclusiveOption ? [...options, exclusiveOption] : options

  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-label={label}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {allOptions.map(option => {
        const isSelected = selected.includes(option)
        const Icon = iconFor(option)
        const isExclusive = option === exclusiveOption
        return (
          <button
            key={option}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            onClick={() => toggle(option)}
            className={cn(
              'relative flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-gold bg-gold/10 font-semibold text-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-navy/30 hover:bg-muted/40 hover:text-foreground',
              isExclusive && 'sm:col-span-2',
            )}
          >
            {Icon && (
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isSelected ? 'bg-gold/25 text-gold-foreground' : 'bg-muted/60 text-muted-foreground',
                )}
              >
                <Icon size={16} />
              </span>
            )}
            <span className="min-w-0 flex-1">{option}</span>
            {isSelected && <Check size={16} className="shrink-0 text-gold-foreground" />}
          </button>
        )
      })}
    </div>
  )
}
