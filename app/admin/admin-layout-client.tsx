'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Calendar, Newspaper, Video, Globe, UserCheck,
  GraduationCap, Users, Building2, Menu, Shield, ChevronLeft, Landmark, LogOut, Layout
} from 'lucide-react'
import { useAuth } from '@/lib/use-auth'

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
  { href: '/admin/institutions', label: 'Institutions', icon: Landmark },
  { href: '/admin/sponsors', label: 'Sponsors', icon: Building2 },
] as const

const LOGO_URL = 'https://wdajcvoqpcxtqpfmzndj.supabase.co/storage/v1/object/public/media/Dukes%20club%20modern%20title%20white.png'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { profile, signOut } = useAuth()

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : '?'

  return (
    <div style={{ minHeight: '100vh', background: '#F1F1F3', display: 'flex', fontFamily: 'Montserrat, -apple-system, sans-serif', color: '#181820' }}>

      {/* ── Sidebar ─────────────────────────────── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: '#0F1F3D', color: '#F5F8FC',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        transform: sidebarOpen ? 'translateX(0)' : undefined,
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href="/admin" style={{ display: 'block', textDecoration: 'none' }}>
            <img
              src={LOGO_URL}
              alt="The Dukes' Club"
              style={{ height: 36, maxWidth: 180, objectFit: 'contain' }}
            />
            <div style={{ fontSize: 10, color: 'rgba(245,248,252,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 }}>
              Admin Panel
            </div>
          </Link>
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
                  color: active ? '#E5A718' : 'rgba(245,248,252,0.55)',
                  background: active ? 'rgba(229,167,24,0.1)' : 'transparent',
                  borderRight: active ? '3px solid #E5A718' : '3px solid transparent',
                }}>
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href="/members" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(245,248,252,0.5)', textDecoration: 'none', padding: '6px 0', transition: 'color 0.15s' }}>
            <Layout size={14} /> Members Portal
          </Link>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(245,248,252,0.5)', textDecoration: 'none', padding: '6px 0', transition: 'color 0.15s' }}>
            <ChevronLeft size={14} /> Back to Site
          </Link>
          <button
            onClick={signOut}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(245,248,252,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', textAlign: 'left', fontFamily: 'inherit', transition: 'color 0.15s' }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={() => setSidebarOpen(false)} />}

      {/* ── Main ────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 260, minHeight: '100vh' }}>
        {/* Top bar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: '#fff', borderBottom: '1px solid #D1D1D6', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ display: 'none', padding: 8, border: 'none', background: 'none', cursor: 'pointer' }}>
            <Menu size={20} color="#181820" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#DB2424' }}>
            <Shield size={14} /> Admin Mode
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#181820' }}>
              {profile?.full_name || 'Admin'}
            </span>
            <div style={{ width: 32, height: 32, background: '#0F1F3D', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5F8FC', fontSize: 11, fontWeight: 700 }}>
              {initials}
            </div>
          </div>
        </header>

        <main style={{ padding: '28px 32px', maxWidth: 1400 }}>{children}</main>
      </div>
    </div>
  )
}