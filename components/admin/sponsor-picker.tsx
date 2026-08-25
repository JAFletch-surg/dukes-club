'use client'

/* ══════════════════════════════════════════════════════════════════
   SPONSOR PICKER — attach existing sponsors to an event

   Sponsors are managed once in Admin → Sponsors (logo, website, tier)
   and reused across events, so this only searches what is already
   there. Anything missing is added on the sponsors page first, which
   the empty state links to.
   ══════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, Building2 } from 'lucide-react'

export interface SponsorOption {
  id: string
  name: string
  logo_url?: string | null
  tier?: string | null
  website_url?: string | null
}

/** Small logo, falling back to a building icon when there is none. */
export function SponsorLogo({ sponsor, size = 28 }: { sponsor?: SponsorOption; size?: number }) {
  if (sponsor?.logo_url) {
    return <img src={sponsor.logo_url} alt="" style={{ width: size * 1.6, height: size, objectFit: 'contain', borderRadius: 4, background: '#fff' }} />
  }
  return (
    <div style={{ width: size * 1.6, height: size, borderRadius: 4, background: '#F1F1F3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
      <Building2 size={size * 0.6} />
    </div>
  )
}

export function SponsorPicker({
  sponsors,
  selectedIds,
  onAdd,
  placeholder,
}: {
  sponsors: SponsorOption[]
  selectedIds: string[]
  onAdd: (id: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const available = sponsors.filter(s => {
    if (selectedIds.includes(s.id)) return false
    if (!query) return true
    const q = query.toLowerCase()
    return s.name?.toLowerCase().includes(q) || s.tier?.toLowerCase().includes(q)
  })

  const emptyMessage = sponsors.length === 0
    ? 'No sponsors yet'
    : query ? 'No matching sponsors' : 'Every sponsor is already on this event'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #D1D1D6', borderRadius: 10, padding: '0 12px', background: '#fff' }}>
        <Search size={15} color="#999" style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || 'Search sponsors by name or tier...'}
          style={{ width: '100%', padding: '10px 0', border: 'none', fontSize: 14, color: '#000', background: 'transparent', outline: 'none' }}
        />
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #E4E4E8', borderRadius: 10,
          marginTop: 4, maxHeight: 280, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}>
          {available.length === 0 ? (
            <div style={{ padding: '16px 14px', textAlign: 'center', color: '#999', fontSize: 13 }}>
              {emptyMessage}
              <Link href="/admin/sponsors" target="_blank" style={{ display: 'block', marginTop: 4, color: '#7C3AED', fontWeight: 600 }}>
                Manage sponsors →
              </Link>
            </div>
          ) : (
            available.slice(0, 20).map(s => (
              <button key={s.id} type="button"
                onClick={() => { onAdd(s.id); setQuery(''); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', border: 'none', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <SponsorLogo sponsor={s} size={24} />
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: '#181820' }}>{s.name}</span>
                {s.tier && <span style={{ fontSize: 11, color: '#888' }}>{s.tier}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
