'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader, Download, BedDouble, Check, Search, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Room requests for a Dukes Weekend.
//
// A request is not a reservation — members state that they need a bed, and
// Dukes allocates the actual rooms offline. This screen is where that
// allocation gets recorded against each member.

const S = {
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  stat: { background: '#fff', border: '1px solid #E4E4E8', borderRadius: 12, padding: 16, flex: 1, minWidth: 150 } as React.CSSProperties,
}

interface WeekendEvent {
  id: string
  title: string
  slug: string
  weekend_friday_room_capacity: number | null
  weekend_saturday_room_capacity: number | null
}

interface CourseBookingRow {
  user_id: string
  weekend_courses: { day: string } | { day: string }[] | null
}

interface RoomRow {
  id: string
  user_id: string
  applicant_name: string
  applicant_email: string
  status: string
  attends_friday: boolean
  attends_saturday: boolean
  attends_sunday: boolean
  saturday_mode: string | null
  room_friday_requested: boolean
  room_saturday_requested: boolean
  room_friday_allocated: string | null
  room_saturday_allocated: string | null
}

type Filter = 'all' | 'friday' | 'saturday' | 'both' | 'unallocated'

export default function WeekendRoomsAdmin() {
  const { eventId } = useParams<{ eventId: string }>()
  const supabase = useMemo(() => createClient(), [])

  const [event, setEvent] = useState<WeekendEvent | null>(null)
  const [rows, setRows] = useState<RoomRow[]>([])
  const [fridayCourseHolders, setFridayCourseHolders] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [drafts, setDrafts] = useState<Record<string, { friday: string; saturday: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const [{ data: ev }, { data: bookings }, { data: courseBookings }] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('event_bookings').select('*').eq('event_id', eventId).neq('status', 'cancelled'),
      supabase.from('weekend_course_bookings')
        .select('user_id, weekend_courses(day)')
        .eq('event_id', eventId).eq('status', 'booked'),
    ])

    setEvent(ev)

    const requesting = ((bookings || []) as RoomRow[])
      .filter(b => b.room_friday_requested || b.room_saturday_requested)
      .sort((a, b) => (a.applicant_name || '').localeCompare(b.applicant_name || ''))
    setRows(requesting)

    // Used to flag a Friday request that has lost the course it depended on.
    // The booking flow keeps these in step, but an admin editing bookings by
    // hand can still leave one stranded — better to show it than hide it.
    const holders = new Set<string>()
    for (const cb of (courseBookings || []) as CourseBookingRow[]) {
      const c = Array.isArray(cb.weekend_courses) ? cb.weekend_courses[0] : cb.weekend_courses
      if (c?.day === 'friday') holders.add(cb.user_id)
    }
    setFridayCourseHolders(holders)

    const d: Record<string, { friday: string; saturday: string }> = {}
    for (const r of requesting) {
      d[r.id] = { friday: r.room_friday_allocated || '', saturday: r.room_saturday_allocated || '' }
    }
    setDrafts(d)
    setLoading(false)
  }, [supabase, eventId])

  useEffect(() => { if (eventId) load() }, [eventId, load])

  const saveAllocation = async (row: RoomRow) => {
    setSavingId(row.id)
    try {
      const draft = drafts[row.id] || { friday: '', saturday: '' }
      const { error } = await supabase
        .from('event_bookings')
        .update({
          room_friday_allocated: draft.friday.trim() || null,
          room_saturday_allocated: draft.saturday.trim() || null,
        })
        .eq('id', row.id)
      if (error) throw error
      showToast('Allocation saved')
      setRows(prev => prev.map(r => r.id === row.id
        ? { ...r, room_friday_allocated: draft.friday.trim() || null, room_saturday_allocated: draft.saturday.trim() || null }
        : r))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save', 'error')
    }
    setSavingId(null)
  }

  const filtered = rows.filter(r => {
    if (search) {
      const q = search.toLowerCase()
      if (!r.applicant_name?.toLowerCase().includes(q) && !r.applicant_email?.toLowerCase().includes(q)) return false
    }
    if (filter === 'friday') return r.room_friday_requested
    if (filter === 'saturday') return r.room_saturday_requested
    if (filter === 'both') return r.room_friday_requested && r.room_saturday_requested
    if (filter === 'unallocated') {
      return (r.room_friday_requested && !r.room_friday_allocated)
        || (r.room_saturday_requested && !r.room_saturday_allocated)
    }
    return true
  })

  const fridayCount = rows.filter(r => r.room_friday_requested).length
  const saturdayCount = rows.filter(r => r.room_saturday_requested).length
  const unallocated = rows.filter(r =>
    (r.room_friday_requested && !r.room_friday_allocated) ||
    (r.room_saturday_requested && !r.room_saturday_allocated)
  ).length

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Friday night', 'Saturday night', 'Friday room', 'Saturday room', 'Days attending', 'Saturday mode']
    const lines = filtered.map(r => [
      r.applicant_name || '',
      r.applicant_email || '',
      r.room_friday_requested ? 'Yes' : 'No',
      r.room_saturday_requested ? 'Yes' : 'No',
      r.room_friday_allocated || '',
      r.room_saturday_allocated || '',
      [r.attends_friday && 'Fri', r.attends_saturday && 'Sat', r.attends_sunday && 'Sun'].filter(Boolean).join(' '),
      r.saturday_mode || '',
    ])

    // Quote everything and double any embedded quotes, so a name containing a
    // comma cannot shift the columns.
    const csv = [header, ...lines]
      .map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `room-requests-${event?.slug || eventId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
  }

  const capFri = event?.weekend_friday_room_capacity
  const capSat = event?.weekend_saturday_room_capacity

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      <Link href="/admin/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7C3AED', textDecoration: 'none', fontWeight: 600, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to Events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#0F1F3D]">Room Requests</h1>
          <p className="text-sm text-[#504F58] mt-1">{event?.title}</p>
        </div>
        <button onClick={exportCsv} style={S.btn}><Download size={15} /> Export CSV</button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div style={S.stat}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Friday night</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0F1F3D', marginTop: 4 }}>
            {fridayCount}{capFri != null && <span style={{ fontSize: 14, color: '#888', fontWeight: 500 }}> / {capFri}</span>}
          </p>
          {capFri != null && fridayCount >= capFri && (
            <p style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 2 }}>Full — no further requests accepted</p>
          )}
        </div>
        <div style={S.stat}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Saturday night</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0F1F3D', marginTop: 4 }}>
            {saturdayCount}{capSat != null && <span style={{ fontSize: 14, color: '#888', fontWeight: 500 }}> / {capSat}</span>}
          </p>
          {capSat != null && saturdayCount >= capSat && (
            <p style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 2 }}>Full — no further requests accepted</p>
          )}
        </div>
        <div style={S.stat}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Awaiting allocation</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: unallocated > 0 ? '#B45309' : '#16a34a', marginTop: 4 }}>{unallocated}</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#D1D1D6' }} />
          <input style={{ ...S.input, paddingLeft: 34 }} placeholder="Search name or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={S.select} value={filter} onChange={e => setFilter(e.target.value as Filter)}>
          <option value="all">All requests</option>
          <option value="friday">Friday night</option>
          <option value="saturday">Saturday night</option>
          <option value="both">Both nights</option>
          <option value="unallocated">Awaiting allocation</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '80px 20px', textAlign: 'center' }}>
          <BedDouble size={40} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No room requests</p>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>
            {rows.length === 0 ? 'No members have requested a room yet.' : 'No requests match this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(row => {
            const draft = drafts[row.id] || { friday: '', saturday: '' }
            const dirty = draft.friday !== (row.room_friday_allocated || '')
              || draft.saturday !== (row.room_saturday_allocated || '')
            const orphanedFriday = row.room_friday_requested && !fridayCourseHolders.has(row.user_id)

            return (
              <div key={row.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E4E8', padding: 16 }}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#181820' }}>{row.applicant_name || 'Unknown'}</p>
                    <p style={{ fontSize: 12, color: '#504F58', marginTop: 2 }}>{row.applicant_email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {row.room_friday_requested && <span style={S.badge('#EFF6FF', '#1D4ED8')}>Friday night</span>}
                    {row.room_saturday_requested && <span style={S.badge('#ECFDF5', '#047857')}>Saturday night</span>}
                    <span style={S.badge('#F3F4F6', '#666')}>
                      {[row.attends_friday && 'Fri', row.attends_saturday && 'Sat', row.attends_sunday && 'Sun'].filter(Boolean).join(' · ') || 'No days'}
                    </span>
                    {row.saturday_mode === 'stream' && <span style={S.badge('#FEF9E7', '#92400E')}>Streaming</span>}
                  </div>
                </div>

                {orphanedFriday && (
                  <p style={{ fontSize: 11, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                    This member has a Friday room request but no confirmed Friday course. Requests are
                    normally cancelled automatically when the last Friday course is dropped, so this one
                    is worth checking.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {row.room_friday_requested && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Friday room</label>
                      <input style={S.input} value={draft.friday}
                        onChange={e => setDrafts(d => ({ ...d, [row.id]: { ...draft, friday: e.target.value } }))}
                        placeholder="e.g. Room 214" />
                    </div>
                  )}
                  {row.room_saturday_requested && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Saturday room</label>
                      <input style={S.input} value={draft.saturday}
                        onChange={e => setDrafts(d => ({ ...d, [row.id]: { ...draft, saturday: e.target.value } }))}
                        placeholder="e.g. Room 214" />
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-3">
                  <button onClick={() => saveAllocation(row)} disabled={!dirty || savingId === row.id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                      borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: dirty ? 'pointer' : 'default',
                      background: dirty ? '#0F1F3D' : '#F3F4F6', color: dirty ? '#fff' : '#999',
                      border: 'none', opacity: savingId === row.id ? 0.5 : 1,
                    }}>
                    {savingId === row.id ? <Loader className="animate-spin" size={12} />
                      : dirty ? <Save size={12} /> : <Check size={12} />}
                    {dirty ? 'Save allocation' : 'Saved'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
