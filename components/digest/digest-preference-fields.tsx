'use client'

import { Calendar, Newspaper, Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { NEWS_CATEGORIES } from '@/lib/constants/news-categories'
import type { DigestFrequency } from '@/lib/emails/digest'

export interface DigestPreferenceValue {
  frequency: DigestFrequency
  includeEvents: boolean
  includeNews: boolean
  /** Empty means every category. */
  newsCategories: string[]
}

export const DEFAULT_DIGEST_PREFERENCES: DigestPreferenceValue = {
  frequency: 'weekly',
  includeEvents: true,
  includeNews: true,
  newsCategories: [],
}

const FREQUENCY_OPTIONS: Array<{ value: DigestFrequency; label: string; hint: string }> = [
  { value: 'weekly', label: 'Weekly', hint: 'Every week' },
  { value: 'fortnightly', label: 'Fortnightly', hint: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly', hint: 'Every 4 weeks' },
  { value: 'never', label: 'Never', hint: 'Opt out entirely' },
]

/**
 * The round-up preference form, shared by the members' profile page and the
 * token-based preference centre members reach from the email footer. Both need
 * to offer identical choices, so the fields live here and each page brings its
 * own loading, saving and persistence.
 */
export function DigestPreferenceFields({
  value,
  onChange,
  disabled = false,
}: {
  value: DigestPreferenceValue
  onChange: (next: DigestPreferenceValue) => void
  disabled?: boolean
}) {
  const optedOut = value.frequency === 'never'

  const toggleCategory = (category: string) => {
    const next = value.newsCategories.includes(category)
      ? value.newsCategories.filter((c) => c !== category)
      : [...value.newsCategories, category]
    onChange({ ...value, newsCategories: next })
  }

  return (
    <div className="space-y-6">
      {/* Frequency */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">How often would you like the round-up?</Label>
          <p className="text-xs text-muted-foreground mt-1">
            A summary of upcoming events and new posts, with links straight to them.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FREQUENCY_OPTIONS.map((option) => {
            const selected = value.frequency === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChange({ ...value, frequency: option.value })}
                className={`relative rounded-lg border p-3 text-left transition-all disabled:opacity-50 ${
                  selected
                    ? option.value === 'never'
                      ? 'border-muted-foreground/40 bg-muted'
                      : 'border-gold bg-gold/10 shadow-sm'
                    : 'border-input hover:border-gold/50 hover:bg-muted/40'
                }`}
              >
                {selected && (
                  <Check
                    size={14}
                    className={`absolute top-2 right-2 ${option.value === 'never' ? 'text-muted-foreground' : 'text-gold'}`}
                  />
                )}
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{option.hint}</span>
              </button>
            )
          })}
        </div>
        {optedOut && (
          <p className="text-xs text-muted-foreground bg-muted/60 border rounded-md px-3 py-2">
            You won&rsquo;t receive the round-up. Emails about your own account &mdash; bookings,
            certificates and password resets &mdash; are unaffected.
          </p>
        )}
      </div>

      {!optedOut && (
        <>
          <Separator />

          {/* What's included */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">What should it include?</Label>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Upcoming events</p>
                  <p className="text-xs text-muted-foreground">
                    Courses, webinars and meetings coming up, with booking links
                  </p>
                </div>
              </div>
              <Switch
                checked={value.includeEvents}
                disabled={disabled}
                onCheckedChange={(checked) => onChange({ ...value, includeEvents: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Newspaper size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">News &amp; blog posts</p>
                  <p className="text-xs text-muted-foreground">
                    Anything published since your last round-up
                  </p>
                </div>
              </div>
              <Switch
                checked={value.includeNews}
                disabled={disabled}
                onCheckedChange={(checked) => onChange({ ...value, includeNews: checked })}
              />
            </div>

            {value.includeNews && (
              <div className="pl-0 sm:pl-7 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {value.newsCategories.length === 0
                    ? 'All categories. Pick specific ones to narrow it down.'
                    : `Only: ${value.newsCategories.join(', ')}`}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {NEWS_CATEGORIES.map((category) => {
                    const selected = value.newsCategories.includes(category)
                    return (
                      <button
                        key={category}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => toggleCategory(category)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors disabled:opacity-50 ${
                          selected
                            ? 'bg-navy text-navy-foreground border-navy'
                            : 'bg-background text-muted-foreground border-input hover:border-navy/40'
                        }`}
                      >
                        {category}
                      </button>
                    )
                  })}
                  {value.newsCategories.length > 0 && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ ...value, newsCategories: [] })}
                      className="px-2.5 py-1 rounded-full text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {!value.includeEvents && !value.includeNews && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                With both switched off there&rsquo;s nothing left to send, so you won&rsquo;t
                receive the round-up at all.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
