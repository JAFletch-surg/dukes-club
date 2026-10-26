'use client'

import { useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, BookOpen, Calendar, Loader, Mail, MessageSquare, Radio, RefreshCw, Users, Video,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fetchUsageSummary } from '@/lib/admin/usage'
import { USAGE_RANGES, type UsageRange, type UsageSummary } from '@/lib/admin/usage-types'

// Categorical slots 1–4 of the validated reference palette (light surface).
// Fixed order, never cycled: videos, questions, webinars, bookings.
const SERIES = {
  videos: '#2a78d6',
  questions: '#eb6834',
  webinars: '#1baf7a',
  bookings: '#eda100',
} as const
const INK = '#0b0b0b'
const INK_SECONDARY = '#52514e'
const GRID = '#e5e7eb'

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-GB'))
const fmtMinutes = (m: number | null | undefined) => {
  if (m === null || m === undefined) return '—'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'
const shortDay = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ icon: Icon, title, caption, children }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-start gap-2 mb-3">
        <Icon size={18} className="text-slate-700 mt-0.5" />
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          {caption && <p className="text-xs text-gray-500">{caption}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

const th = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50'
const thNum = `${th} text-right`
const td = 'px-4 py-2.5 text-gray-700 border-t border-gray-100'
const tdNum = `${td} text-right tabular-nums`

export default function UsageDashboard() {
  const [range, setRange] = useState<UsageRange>(30)
  const [reloadKey, setReloadKey] = useState(0)
  // One result per (range, reload) key; "loading" is simply "the result on
  // screen is not for the key we want", so no loading flag has to be set.
  const wantedKey = `${range}:${reloadKey}`
  const [result, setResult] = useState<{ key: string; data: UsageSummary | null; error: string }>({
    key: '', data: null, error: '',
  })

  useEffect(() => {
    let cancelled = false
    fetchUsageSummary(range).then((res) => {
      if (cancelled) return
      setResult((prev) => res.success
        ? { key: wantedKey, data: res.data, error: '' }
        : { key: wantedKey, data: prev.data, error: res.error })
    })
    return () => { cancelled = true }
  }, [range, wantedKey])

  const loading = result.key !== wantedKey
  const { data, error } = result

  const rangeLabel = `last ${range} days`

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">Site Usage</h1>
          <p className="text-sm text-gray-500 mt-1">
            How members are using the site. Figures cover the {rangeLabel} unless marked all-time.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {USAGE_RANGES.map((days) => (
            <button
              key={days}
              onClick={() => setRange(days)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                range === days
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {days === 365 ? '12 months' : `${days} days`}
            </button>
          ))}
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            className="p-1.5 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="flex justify-center items-center h-[300px]">
          <Loader className="animate-spin" size={28} color="#D1D1D6" />
        </div>
      )}

      {data && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.warnings.length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Some sources could not be read, so the related figures are missing:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {data.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Members */}
          <Section icon={Users} title="Members" caption="Sign-ins come from Supabase Auth; “active” means signed in or did something measurable below.">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatTile label="Active members" value={fmt(data.members.activeInRange)} sub={rangeLabel} />
              <StatTile label="Signed in" value={fmt(data.members.signedInInRange)} sub={rangeLabel} />
              <StatTile label="New registrations" value={fmt(data.members.newInRange)} sub={rangeLabel} />
              <StatTile label="Approved members" value={fmt(data.members.approved)} sub={`of ${fmt(data.members.total)} registered`} />
              <StatTile label="Never signed in" value={fmt(data.members.neverSignedIn)} sub="all-time" />
              <StatTile label="Unverified email" value={fmt(data.members.unverifiedEmail)} sub="cannot sign in" />
            </div>
          </Section>

          {/* Daily activity */}
          <Section icon={Activity} title="Activity per day" caption="Videos watched, question sessions completed, webinar joins and event bookings, by day.">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tick={{ fontSize: 11, fill: INK_SECONDARY }}
                      axisLine={{ stroke: GRID }}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_SECONDARY }} axisLine={false} tickLine={false} />
                    <Tooltip
                      labelFormatter={(label) => shortDay(String(label))}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID, color: INK }}
                      cursor={{ stroke: INK_SECONDARY, strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: INK_SECONDARY }} iconType="plainline" />
                    <Line type="monotone" dataKey="videos" name="Videos watched" stroke={SERIES.videos} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="questions" name="Question sessions" stroke={SERIES.questions} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="webinars" name="Webinar joins" stroke={SERIES.webinars} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="bookings" name="Event bookings" stroke={SERIES.bookings} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Section>

          {/* Videos */}
          <Section
            icon={Video}
            title="Video archive"
            caption="Minutes are the playback position each member reached in a video, summed. A video counts as watched when its progress was last updated in the period."
          >
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
              <StatTile label="Minutes watched" value={fmtMinutes(data.videos.minutesInRange)} sub={rangeLabel} />
              <StatTile label="Videos watched" value={fmt(data.videos.watchedInRange)} sub={`${fmt(data.videos.uniqueViewersInRange)} viewers`} />
              <StatTile label="Newly started" value={fmt(data.videos.startedInRange)} sub={rangeLabel} />
              <StatTile label="Completed" value={fmt(data.videos.completedInRange)} sub={rangeLabel} />
              <StatTile label="Minutes watched" value={fmtMinutes(data.videos.minutesAllTime)} sub="all-time" />
              <StatTile label="Completed" value={fmt(data.videos.completedAllTime)} sub="all-time" />
            </div>

            {data.videos.top.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* The table alongside carries the same figures, so the chart
                    can step aside where its label column would crush the bars. */}
                <div className="hidden md:block bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Most watched, by minutes</p>
                  <div style={{ height: Math.max(160, data.videos.top.length * 34) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.videos.top} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={6}>
                        <CartesianGrid stroke={GRID} horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="title"
                          width={180}
                          tick={{ fontSize: 11, fill: INK }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(t: string) => (t.length > 28 ? `${t.slice(0, 27)}…` : t)}
                        />
                        <Tooltip
                          formatter={(value) => [fmtMinutes(Number(value)), 'Minutes']}
                          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID, color: INK }}
                          cursor={{ fill: '#f3f4f6' }}
                        />
                        <Bar dataKey="minutes" fill={SERIES.videos} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                          <LabelList dataKey="minutes" position="right" formatter={(v) => fmtMinutes(Number(v))} style={{ fontSize: 11, fill: INK_SECONDARY }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <TableCard>
                  <thead>
                    <tr>
                      <th className={th}>Video</th>
                      <th className={thNum}>Viewers</th>
                      <th className={thNum}>Minutes</th>
                      <th className={thNum}>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.videos.top.map((v) => (
                      <tr key={v.id}>
                        <td className={td}>{v.title}</td>
                        <td className={tdNum}>{fmt(v.viewers)}</td>
                        <td className={tdNum}>{fmt(v.minutes)}</td>
                        <td className={tdNum}>{fmt(v.completions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableCard>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No video activity in this period.</p>
            )}
          </Section>

          {/* Question bank */}
          <Section icon={BookOpen} title="FRCS question bank" caption="A session is one completed practice or exam run.">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatTile label="Sessions" value={fmt(data.questions.sessionsInRange)} sub={rangeLabel} />
              <StatTile label="Questions answered" value={fmt(data.questions.questionsAnsweredInRange)} sub={rangeLabel} />
              <StatTile label="Members practising" value={fmt(data.questions.uniqueUsersInRange)} sub={rangeLabel} />
              <StatTile label="Average score" value={data.questions.avgPercentageInRange === null ? '—' : `${data.questions.avgPercentageInRange}%`} sub={rangeLabel} />
              <StatTile label="Sessions" value={fmt(data.questions.sessionsAllTime)} sub="all-time" />
              <StatTile label="Questions answered" value={fmt(data.questions.questionsAnsweredAllTime)} sub="all-time" />
            </div>
          </Section>

          {/* Webinars */}
          <Section icon={Radio} title="Live webinars" caption="Attendance is recorded when a member joins a live room.">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
              <StatTile label="Attendances" value={fmt(data.webinars.attendancesInRange)} sub={`${fmt(data.webinars.uniqueAttendeesInRange)} members`} />
              <StatTile label="Minutes watched live" value={fmtMinutes(data.webinars.minutesInRange)} sub={rangeLabel} />
              <StatTile label="Chat messages" value={fmt(data.webinars.chatMessagesInRange)} sub={rangeLabel} />
              <StatTile label="Questions asked" value={fmt(data.webinars.questionsAskedInRange)} sub={rangeLabel} />
              <StatTile label="Webinars attended" value={fmt(data.webinars.top.length)} sub={rangeLabel} />
            </div>
            {data.webinars.top.length > 0 && (
              <TableCard>
                <thead>
                  <tr>
                    <th className={th}>Webinar</th>
                    <th className={thNum}>Attendees</th>
                    <th className={thNum}>Minutes watched</th>
                  </tr>
                </thead>
                <tbody>
                  {data.webinars.top.map((w) => (
                    <tr key={w.sessionId}>
                      <td className={td}>{w.title}</td>
                      <td className={tdNum}>{fmt(w.attendees)}</td>
                      <td className={tdNum}>{fmt(w.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </Section>

          {/* Events, messaging, feedback */}
          <Section icon={Calendar} title="Events, messaging and feedback">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatTile label="Event bookings" value={fmt(data.events.bookingsInRange)} sub={rangeLabel} />
              <StatTile label="Bookings approved" value={fmt(data.events.byStatus.approved ?? 0)} sub={`${fmt(data.events.byStatus.pending ?? 0)} pending · ${fmt(data.events.byStatus.waitlisted ?? 0)} waitlisted`} />
              <StatTile label="Certificates issued" value={fmt(data.events.certificatesInRange)} sub={rangeLabel} />
              <StatTile label="Messages sent" value={fmt(data.messaging.messagesInRange)} sub={rangeLabel} />
              <StatTile label="Site feedback" value={fmt(data.messaging.feedbackResponsesInRange)} sub="responses" />
              <StatTile label="Bookings cancelled" value={fmt(data.events.byStatus.cancelled ?? 0)} sub={rangeLabel} />
            </div>
          </Section>

          {/* Most active members */}
          <Section icon={MessageSquare} title="Most active members" caption={`Ranked by video and webinar minutes plus questions answered, ${rangeLabel}.`}>
            {data.topMembers.length > 0 ? (
              <TableCard>
                <thead>
                  <tr>
                    <th className={th}>Member</th>
                    <th className={th}>Region</th>
                    <th className={thNum}>Videos</th>
                    <th className={thNum}>Video min</th>
                    <th className={thNum}>Q sessions</th>
                    <th className={thNum}>Questions</th>
                    <th className={thNum}>Webinar min</th>
                    <th className={th}>Last sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topMembers.map((m) => (
                    <tr key={m.id}>
                      <td className={td}>
                        <p className="font-medium text-slate-800">{m.name}</p>
                        {m.email && <p className="text-xs text-gray-500">{m.email}</p>}
                      </td>
                      <td className={td}>{m.region || '—'}</td>
                      <td className={tdNum}>{fmt(m.videosWatched)}</td>
                      <td className={tdNum}>{fmt(m.videoMinutes)}</td>
                      <td className={tdNum}>{fmt(m.questionSessions)}</td>
                      <td className={tdNum}>{fmt(m.questionsAnswered)}</td>
                      <td className={tdNum}>{fmt(m.webinarMinutes)}</td>
                      <td className={`${td} text-xs whitespace-nowrap`}>{fmtDate(m.lastSignIn)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            ) : (
              <p className="text-sm text-gray-500">No measurable member activity in this period.</p>
            )}
          </Section>

          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Mail size={12} /> Generated {new Date(data.generatedAt).toLocaleString('en-GB')}. Super admins only.
          </p>
        </div>
      )}
    </div>
  )
}
