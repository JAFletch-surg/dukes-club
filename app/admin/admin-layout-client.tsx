'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Calendar, Newspaper, Video, Globe, UserCheck, Mic,
  GraduationCap, Users, Building2, Menu, Shield, ChevronLeft, Landmark, LogOut, Layout, FileText, X
} from 'lucide-react'
import { useAuth } from '@/lib/use-auth'

const navSections = [
  {
    label: 'CONTENT',
    items: [
      { href: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
      { href: '/admin/events', label: 'Events', icon: Calendar },
      { href: '/admin/posts', label: 'News & Posts', icon: Newspaper },
      { href: '/admin/videos', label: 'Videos', icon: Video },
      { href: '/admin/podcasts', label: 'Podcasts', icon: Mic },
      { href: '/admin/questions', label: 'Questions', icon: FileText },
      { href: '/admin/fellowships', label: 'Fellowships', icon: Globe },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { href: '/admin/team', label: 'Executive Team', icon: UserCheck },
      { href: '/admin/faculty', label: 'Faculty', icon: GraduationCap },
      { href: '/admin/members', label: 'Members', icon: Users, adminOnly: true },
    ],
  },
  {
    label: 'ORGANISATION',
    items: [
      { href: '/admin/institutions', label: 'Institutions', icon: Landmark },
      { href: '/admin/sponsors', label: 'Sponsors', icon: Building2 },
    ],
  },
]

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { profile, signOut, isAdmin } = useAuth()

  const isActive = (href: string, end?: boolean) => {
    if (end) return pathname === href
    return pathname.startsWith(href)
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : '?'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.08]">
        <Link href="/admin" className="block">
          <img
            src="/images/logo-white.png"
            alt="The Dukes' Club"
            className="h-10 max-w-[180px] object-contain"
          />
        </Link>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-5 h-px bg-gold" />
          <p className="text-gold/80 text-[11px] font-semibold tracking-[0.2em]">ADMIN PANEL</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-white/25 text-[10px] font-bold tracking-[0.18em] uppercase px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.filter((item) => !(item as any).adminOnly || isAdmin).map((item) => {
                const Icon = item.icon
                const active = isActive(item.href, (item as any).end)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? 'text-gold bg-gold/10 border-l-[3px] border-gold -ml-px shadow-sm'
                        : 'text-white/55 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/[0.08] space-y-0.5">
        <Link
          href="/members"
          className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <Layout size={16} /> Members Portal
        </Link>
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <ChevronLeft size={16} /> Back to Site
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5 w-full text-left"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#F1F1F3] flex" style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 bottom-0 w-[260px] bg-navy z-50">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[260px] h-full bg-navy flex flex-col z-10">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-[260px] min-h-screen min-w-0 overflow-x-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#D1D1D6] px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[#181820]"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-red-600">
              <Shield size={14} /> Admin Mode
            </div>
            <Link
              href="/members"
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-navy/10 text-navy text-[11px] font-semibold"
            >
              <Layout size={12} />
              Members
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[#181820] hidden sm:inline">
              {profile?.full_name || 'Admin'}
            </span>
            <div className="w-8 h-8 bg-navy rounded-full flex items-center justify-center text-white text-[11px] font-bold">
              {initials}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8 pb-20 lg:pb-8 max-w-[1400px] overflow-x-hidden">{children}</main>

        {/* Mobile bottom nav */}
        {!sidebarOpen && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy border-t border-white/10 safe-area-bottom">
            <div className="flex justify-around items-center h-14">
              {[
                { href: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
                { href: '/admin/events', label: 'Events', icon: Calendar },
                { href: '/admin/posts', label: 'Posts', icon: Newspaper },
                ...(isAdmin ? [{ href: '/admin/members', label: 'Members', icon: Users }] : []),
              ].map((item) => {
                const Icon = item.icon
                const active = isActive(item.href, item.end)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                      active ? 'text-gold' : 'text-white/50'
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}