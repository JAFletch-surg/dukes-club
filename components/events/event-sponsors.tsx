'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Sponsors attached to an event, grouped by tier.
//
// These are rows from the site-wide sponsors table joined through
// event_sponsors — the same records the homepage strip and the sponsors admin
// screen use, so a logo uploaded once is available everywhere. tier_override
// lets a sponsor sit at a different level for one event without disturbing its
// global tier.

interface EventSponsor {
  id: string
  tier: string | null
  sort_order: number
  name: string
  logo_url: string | null
  website_url: string | null
  description: string | null
}

// Tiers render in standing order; anything unrecognised falls to the end.
const TIER_ORDER = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Partner']

export function EventSponsors({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [sponsors, setSponsors] = useState<EventSponsor[]>([])

  useEffect(() => {
    let active = true
    supabase
      .from('event_sponsors')
      .select('id, tier_override, sort_order, sponsors(name, logo_url, website_url, description, tier, is_active)')
      .eq('event_id', eventId)
      .order('sort_order')
      .then(({ data }) => {
        if (!active) return
        const rows = (data || [])
          .map((row: Record<string, unknown>) => {
            const raw = row.sponsors as Record<string, unknown> | Record<string, unknown>[] | null
            const s = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined
            if (!s || s.is_active === false) return null
            return {
              id: row.id as string,
              tier: (row.tier_override as string) || (s.tier as string) || null,
              sort_order: (row.sort_order as number) ?? 0,
              name: s.name as string,
              logo_url: (s.logo_url as string) ?? null,
              website_url: (s.website_url as string) ?? null,
              description: (s.description as string) ?? null,
            }
          })
          .filter((s): s is EventSponsor => s !== null)
        setSponsors(rows)
      })
    return () => { active = false }
  }, [supabase, eventId])

  if (sponsors.length === 0) return null

  const tiers = Array.from(new Set(sponsors.map(s => s.tier || 'Partner')))
    .sort((a, b) => {
      const ia = TIER_ORDER.indexOf(a)
      const ib = TIER_ORDER.indexOf(b)
      return (ia === -1 ? TIER_ORDER.length : ia) - (ib === -1 ? TIER_ORDER.length : ib)
    })

  return (
    <div className="mt-16">
      <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">With thanks to our sponsors</h2>

      <div className="space-y-8">
        {tiers.map(tier => {
          const inTier = sponsors.filter(s => (s.tier || 'Partner') === tier)
          return (
            <div key={tier}>
              {/* Only label tiers when there is more than one to tell apart. */}
              {tiers.length > 1 && (
                <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-3">{tier}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {inTier.map(sponsor => {
                  const card = (
                    <div className="h-full rounded-lg border border-navy-foreground/15 bg-navy-foreground/5 p-4 flex flex-col items-center justify-center text-center transition-colors group-hover:border-gold/40">
                      {sponsor.logo_url ? (
                        <img
                          src={sponsor.logo_url}
                          alt={sponsor.name}
                          className="h-12 w-full object-contain mb-2"
                        />
                      ) : (
                        <span className="text-sm font-bold text-navy-foreground mb-2">{sponsor.name}</span>
                      )}
                      {sponsor.description && (
                        <span className="text-[11px] text-navy-foreground/50 leading-snug">{sponsor.description}</span>
                      )}
                    </div>
                  )

                  return sponsor.website_url ? (
                    <a
                      key={sponsor.id}
                      href={sponsor.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                      title={sponsor.name}
                    >
                      {card}
                    </a>
                  ) : (
                    <div key={sponsor.id} className="group">{card}</div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
