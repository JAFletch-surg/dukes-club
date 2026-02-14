'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Calendar, Newspaper, Video, Globe, UserCheck,
  GraduationCap, Users, Building2, Menu, Shield,
  ChevronRight, Radio, Mic, FileText, ArrowLeft
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { type: 'divider', label: 'CONTENT' },
  { href: '/admin/events', label: 'Events', icon: Calendar },
  { href: '/admin/posts', label: 'News & Posts', icon: Newspaper },
  { href: '/admin/videos', label: 'Videos', icon: Video },

  { href: '/admin/podcasts', label: 'Podcasts', icon: Mic },
  { href: '/admin/fellowships', label: 'Fellowships', icon: Globe },
  { type: 'divider', label: 'EXAMS' },
  { href: '/admin/questions', label: 'Question Bank', icon: FileText },
  { type: 'divider', label: 'PEOPLE' },
  { href: '/admin/team', label: 'Executive Team', icon: UserCheck },
  { href: '/admin/faculty', label: 'Faculty', icon: GraduationCap },
  { href: '/admin/members', label: 'Members', icon: Users },
  { type: 'divider', label: 'ORGANISATION' },
  { href: '/admin/sponsors', label: 'Sponsors', icon: Building2 },
] as const

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F1F3', fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, zIndex: 50,
        background: '#0F1F3D', color: '#fff', display: 'flex', flexDirection: 'column',
        transform: sidebarOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.3s ease',
      }} className={`${sidebarOpen ? '' : 'max-lg:!-translate-x-full'} lg:!translate-x-0`}>

        {/* Logo */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/images/logo-white.png" alt="Dukes' Club" style={{ height: 32 }} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>Admin CMS</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
          {navItems.map((item, i) => {
            if ('type' in item && item.type === 'divider') {
              return (
                <div key={i} style={{ padding: '18px 20px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.25)' }}>
                  {item.label}
                </div>
              )
            }
            if (!('href' in item)) return null
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px',
                  fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                  color: active ? '#C49A6C' : 'rgba(255,255,255,0.55)',
                  background: active ? 'rgba(196,154,108,0.12)' : 'transparent',
                  borderRight: active ? '3px solid #C49A6C' : '3px solid transparent',
                  textDecoration: 'none',
                }}>
                <Icon size={17} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Back to site
          </Link>
          <Link href="/members" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginTop: 8 }}>
            <Users size={14} /> Members Area
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, marginLeft: 260, minHeight: '100vh' }} className="max-lg:!ml-0">
        {/* Top bar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: '#fff', borderBottom: '1px solid #E4E4E8', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ display: 'none', padding: 8, border: 'none', background: 'none', cursor: 'pointer' }} className="max-lg:!block">
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#C49A6C' }}>
            <Shield size={15} /> Admin Mode
          </div>
          <div style={{ width: 32, height: 32, background: '#0F1F3D', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>A</div>
        </header>

        <main style={{ padding: 24 }}>{children}</main>
      </div>
    </div>
  )
}
