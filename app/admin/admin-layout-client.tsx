'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Calendar, Newspaper, Video, Globe, UserCheck,
  GraduationCap, Users, Building2, Menu, Shield, ChevronLeft
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { type: 'divider', label: 'CONTENT' },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/posts', label: 'News & Posts', icon: Newspaper },
  { href: '/admin/videos', label: 'Videos', icon: Video },
  { href: '/admin/fellowships', label: 'Fellowships', icon: Globe },
  { type: 'divider', label: 'PEOPLE' },
  { href: '/admin/team', label: 'Executive Team', icon: UserCheck },
  { href: '/admin/faculty', label: 'Faculty', icon: GraduationCap },
  { href: '/admin/members', label: 'Members', icon: Users },
  { type: 'divider', label: 'ORGANISATION' },
  { href: '/admin/sponsors', label: 'Sponsors', icon: Building2 },
] as const

/* ── Style guide tokens ─────────────────────────── */
const C = {
  navy: '#0F1F3D',
  navyFg: '#F5F8FC',
  gold: '#E5A718',
  goldFg: '#2D1F04',
  primary: '#7C3AED',
  primaryFg: '#F5F3FF',
  bg: '#F1F1F3',
  fg: '#181820',
  card: '#FAFAFA',
  muted: '#D1D1D6',
  mutedFg: '#181820',
  secondary: '#504F58',
  destructive: '#DB2424',
  ring: '#7C3AED',
  border: '#D1D1D6',
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', fontFamily: 'Montserrat, -apple-system, sans-serif', color: C.fg }}>

        {/* ── Sidebar ─────────────────────────────── */}
        <aside style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: C.navy, color: C.navyFg,
          zIndex: 50, display: 'flex', flexDirection: 'column',
          transform: sidebarOpen ? 'translateX(0)' : undefined,
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, background: C.gold, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.goldFg, fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 700, fontSize: 22 }}>D</div>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Dukes&apos; Club</div>
                <div style={{ fontSize: 10, color: 'rgba(245,248,252,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 2 }}>Admin Panel</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
            {navItems.map((item, i) => {
              if ('type' in item && item.type === 'divider') {
                return <div key={i} style={{ padding: '20px 20px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(245,248,252,0.25)' }}>{item.label}</div>
              }
              if (!('href' in item)) return null
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', fontSize: 14, fontWeight: active ? 600 : 400,
                    textDecoration: 'none', transition: 'all 0.15s',
                    color: active ? C.gold : 'rgba(245,248,252,0.55)',
                    background: active ? 'rgba(229,167,24,0.1)' : 'transparent',
                    borderRight: active ? `3px solid ${C.gold}` : '3px solid transparent',
                  }}>
                  <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(245,248,252,0.4)', textDecoration: 'none' }}>
              <ChevronLeft size={14} /> Back to site
            </Link>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={() => setSidebarOpen(false)} />}

        {/* ── Main ────────────────────────────────── */}
        <div style={{ flex: 1, marginLeft: 260, minHeight: '100vh' }}>
          {/* Top bar */}
          <header style={{ position: 'sticky', top: 0, zIndex: 30, background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ display: 'none', padding: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
              <Menu size={20} color={C.fg} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.destructive }}>
              <Shield size={14} /> Admin Mode
            </div>
            <div style={{ width: 32, height: 32, background: C.navy, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navyFg, fontSize: 11, fontWeight: 700 }}>A</div>
          </header>

          <main style={{ padding: '28px 32px', maxWidth: 1400 }}>{children}</main>
        </div>
      </div>
    </>
  )
}