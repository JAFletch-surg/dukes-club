'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Sponsor {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
  tier: string
  sort_order: number
  is_active: boolean
}

// Tier display order and visual config (no tier labels shown publicly)
const TIER_CONFIG: Record<string, { order: number; logoHeight: string; textSize: string; opacity: string }> = {
  Partner: { order: 0, logoHeight: 'h-16', textSize: 'text-xl', opacity: 'opacity-80' },
  Platinum: { order: 1, logoHeight: 'h-14', textSize: 'text-xl', opacity: 'opacity-70' },
  Gold: { order: 2, logoHeight: 'h-12', textSize: 'text-lg', opacity: 'opacity-60' },
  Silver: { order: 3, logoHeight: 'h-10', textSize: 'text-base', opacity: 'opacity-50' },
  Bronze: { order: 4, logoHeight: 'h-8', textSize: 'text-sm', opacity: 'opacity-45' },
}

const SponsorsSection = () => {
  const [sponsors, setSponsors] = useState<Sponsor[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('sponsors')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }: { data: Sponsor[] | null }) => {
        if (data) setSponsors(data)
      })
  }, [])

  if (sponsors.length === 0) return null

  // Group by tier, maintaining sort_order within each group
  const grouped = sponsors.reduce<Record<string, Sponsor[]>>((acc, s) => {
    const tier = s.tier || 'Bronze'
    if (!acc[tier]) acc[tier] = []
    acc[tier].push(s)
    return acc
  }, {})

  // Sort tiers by display order
  const sortedTiers = Object.keys(grouped).sort(
    (a, b) => (TIER_CONFIG[a]?.order ?? 99) - (TIER_CONFIG[b]?.order ?? 99)
  )

  return (
    <section className="py-16 bg-background border-t border-border">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-12">
          Our Partners & Sponsors
        </p>

        <div className="space-y-10">
          {sortedTiers.map((tier) => {
            const config = TIER_CONFIG[tier] || TIER_CONFIG.Bronze
            const tierSponsors = grouped[tier]

            return (
              <div key={tier} className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                {tierSponsors.map((sponsor) => {
                  const inner = sponsor.logo_url && sponsor.logo_url.startsWith('http') ? (
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name}
                      className={`${config.logoHeight} max-w-[200px] object-contain`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'block'
                      }}
                    />
                  ) : null

                  const fallback = (
                    <span
                      className={`${config.textSize} font-semibold text-muted-foreground ${!sponsor.logo_url || !sponsor.logo_url.startsWith('http') ? 'block' : 'hidden'}`}
                    >
                      {sponsor.name}
                    </span>
                  )

                  const content = (
                    <div
                      className={`flex items-center justify-center grayscale hover:grayscale-0 ${config.opacity} hover:opacity-100 transition-all duration-300`}
                    >
                      {inner}
                      {fallback}
                    </div>
                  )

                  if (sponsor.website_url) {
                    return (
                      <a
                        key={sponsor.id}
                        href={sponsor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {content}
                      </a>
                    )
                  }

                  return <div key={sponsor.id}>{content}</div>
                })}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default SponsorsSection