'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, Newspaper, Video, Globe, Users, Building2,
  ChevronRight, Database, Loader, Mic, FileText
} from 'lucide-react'

const S = {
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
}

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

  const typeBadge = (t: string) => {
    const m: Record<string, [string, string]> = {
      Webinar: ['#EFF6FF', '#2563EB'], 'Online Lecture': ['#EFF6FF', '#2563EB'],
      'Practical Workshop': ['#F5F3FF', '#7C3AED'], Conference: ['#FFF7ED', '#C2410C'],
      'In Person Course': ['#F0FDF4', '#16A34A'], Hybrid: ['#ECFEFF', '#0891B2'],
    }
    const [bg, fg] = m[t] || ['#F3F4F6', '#666']
    return S.badge(bg, fg)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Loader className="animate-spin" size={28} color="#D1D1D6" />
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>Overview of your Dukes&apos; Club content</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#F0FDF4', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
          <Database size={14} /> Connected to Supabase
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 36 }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: 'none', background: '#fff', borderRadius: 16, border: '1px solid #E4E4E8', padding: 20, transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={18} color={c.color} />
              </div>
              <ChevronRight size={14} color="#D1D1D6" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.count}</div>
            <div style={{ fontSize: 13, color: '#504F58', marginTop: 2 }}>{c.label}</div>
          </Link>
        ))}
      </div>

      {/* Recent events */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F1F3D' }}>Recent Events</h2>
          <Link href="/admin/events" style={{ fontSize: 14, color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E4E4E8', overflow: 'hidden' }}>
          {recentEvents.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Calendar size={36} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: '#181820' }}>No events yet</p>
              <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>Create your first event to get started</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #F1F1F3' }}>
                  {['Title', 'Date', 'Type', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #F1F1F3' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#181820' }}>{e.title}</td>
                    <td style={{ padding: '14px 16px', color: '#504F58' }}>
                      {e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={typeBadge(e.event_type)}>{e.event_type}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={S.badge(
                        e.status === 'published' ? '#f0fdf4' : e.status === 'draft' ? '#fefce8' : '#f3f4f6',
                        e.status === 'published' ? '#16a34a' : e.status === 'draft' ? '#a16207' : '#666'
                      )}>{e.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
