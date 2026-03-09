'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, Newspaper, Video, Globe, Users, Building2,
  ChevronRight, Database, Loader, Mic, FileText, MapPin, Clock
} from 'lucide-react'

const badgeStyle = (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    events: 0, posts: 0, videos: 0, fellowships: 0, members: 0, sponsors: 0, podcasts: 0, questions: 0,
  })
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const tables = ['events', 'posts', 'videos', 'fellowships', 'profiles', 'sponsors', 'podcasts', 'questions'] as const
      const results = await Promise.all(
        tables.map((t) => supabase.from(t).select('id', { count: 'exact', head: true }))
      )
      setStats({
        events: results[0].count || 0,
        posts: results[1].count || 0,
        videos: results[2].count || 0,
        fellowships: results[3].count || 0,
        members: results[4].count || 0,
        sponsors: results[5].count || 0,
        podcasts: results[6].count || 0,
        questions: results[7].count || 0,
      })
      const { data: evts } = await supabase
        .from('events')
        .select('id, title, starts_at, event_type, status')
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentEvents(evts || [])
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Events', count: stats.events, icon: Calendar, color: '#2563EB', bg: '#EFF6FF', href: '/admin/events' },
    { label: 'Posts', count: stats.posts, icon: Newspaper, color: '#C49A6C', bg: '#FFF7ED', href: '/admin/posts' },
    { label: 'Videos', count: stats.videos, icon: Video, color: '#16A34A', bg: '#F0FDF4', href: '/admin/videos' },
    { label: 'Fellowships', count: stats.fellowships, icon: Globe, color: '#EA580C', bg: '#FFF7ED', href: '/admin/fellowships' },
    { label: 'Podcasts', count: stats.podcasts, icon: Mic, color: '#9333EA', bg: '#FAF5FF', href: '/admin/podcasts' },
    { label: 'Questions', count: stats.questions, icon: FileText, color: '#0891B2', bg: '#ECFEFF', href: '/admin/questions' },
    { label: 'Members', count: stats.members, icon: Users, color: '#7C3AED', bg: '#F5F3FF', href: '/admin/members' },
    { label: 'Sponsors', count: stats.sponsors, icon: Building2, color: '#DC2626', bg: '#FEF2F2', href: '/admin/sponsors' },
  ]

  const typeBadgeColors: Record<string, [string, string]> = {
    Webinar: ['#EFF6FF', '#2563EB'], 'Online Lecture': ['#EFF6FF', '#2563EB'],
    'Practical Workshop': ['#F5F3FF', '#7C3AED'], Conference: ['#FFF7ED', '#C2410C'],
    'In Person Course': ['#F0FDF4', '#16A34A'], Hybrid: ['#ECFEFF', '#0891B2'],
  }

  const typeBadge = (t: string) => {
    const [bg, fg] = typeBadgeColors[t] || ['#F3F4F6', '#666']
    return badgeStyle(bg, fg)
  }

  const statusBadge = (status: string) => badgeStyle(
    status === 'published' ? '#f0fdf4' : status === 'draft' ? '#fefce8' : '#f3f4f6',
    status === 'published' ? '#16a34a' : status === 'draft' ? '#a16207' : '#666'
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader className="animate-spin" size={28} color="#D1D1D6" />
      </div>
    )
  }

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 md:mb-7">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#0F1F3D]">Dashboard</h1>
          <p className="text-sm text-[#504F58] mt-1">Overview of your Dukes&apos; Club content</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-green-50 rounded-lg text-[13px] font-semibold text-green-600 shrink-0">
          <Database size={14} /> Connected to Supabase
        </div>
      </div>

      {/* Stats grid — 2 cols mobile, 3 cols tablet, 4 cols desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-9">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="no-underline bg-white rounded-2xl border border-[#E4E4E8] p-4 md:p-5 transition-all hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="w-9 h-9 md:w-[38px] md:h-[38px] rounded-[10px] flex items-center justify-center" style={{ background: c.bg }}>
                <c.icon size={18} color={c.color} />
              </div>
              <ChevronRight size={14} className="text-[#D1D1D6]" />
            </div>
            <div className="text-2xl md:text-[28px] font-bold" style={{ color: c.color }}>{c.count}</div>
            <div className="text-[13px] text-[#504F58] mt-0.5">{c.label}</div>
          </Link>
        ))}
      </div>

      {/* Recent events */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg md:text-xl font-bold text-[#0F1F3D]">Recent Events</h2>
          <Link href="/admin/events" className="text-sm text-blue-600 no-underline font-semibold">View all →</Link>
        </div>
        <div className="bg-white rounded-2xl border border-[#E4E4E8] overflow-hidden">
          {recentEvents.length === 0 ? (
            <div className="py-14 px-5 text-center">
              <Calendar size={36} color="#D1D1D6" className="mx-auto mb-3" />
              <p className="text-[15px] font-semibold text-[#181820]">No events yet</p>
              <p className="text-sm text-[#504F58] mt-1">Create your first event to get started</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#F1F1F3]">
                      {['Title', 'Date', 'Type', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3.5 text-[11px] font-bold text-[#504F58] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((e) => (
                      <tr key={e.id} className="border-b border-[#F1F1F3]">
                        <td className="px-4 py-3.5 font-semibold text-[#181820]">{e.title}</td>
                        <td className="px-4 py-3.5 text-[#504F58]">
                          {e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span style={typeBadge(e.event_type)}>{e.event_type}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span style={statusBadge(e.status)}>{e.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-[#F1F1F3]">
                {recentEvents.map((e) => (
                  <Link key={e.id} href="/admin/events" className="block px-4 py-3.5 no-underline active:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-sm font-semibold text-[#181820] leading-snug">{e.title}</p>
                      <span style={statusBadge(e.status)} className="shrink-0">{e.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#504F58]">
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-[#D1D1D6]" />
                        {e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                      <span style={typeBadge(e.event_type)}>{e.event_type}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
