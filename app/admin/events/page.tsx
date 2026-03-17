'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Edit, Trash2, Save, Loader, X, Radio, Users, Image, Upload, Search, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'
import { FacultyPicker, type FacultyMember } from '@/components/admin/faculty-picker'

const EVENT_TYPES = ['Webinar', 'Online Lecture', 'Practical Workshop', 'In Person Course', 'Hybrid', 'Conference']
const STATUSES = ['draft', 'published', 'archived']
const STREAM_TYPES = ['zoom', 'vimeo_live', 'hybrid']
const ACCESS_LEVELS = ['public', 'registered', 'members_only', 'invite_only']
const SUBSPECIALTIES = [
  'Cancer - Colon','Cancer - Rectal','Cancer - Anal','Cancer - Advanced',
  'Peritoneal Malignancy','IBD','Abdominal Wall','Pelvic Floor',
  'Proctology','Fistula','Intestinal Failure','Emergency','Trauma',
  'Research','Endoscopy','Training','Radiology','Anatomy','Evidence-based Medicine','Pilonidal',
  'Robotic','Laparoscopic',
  'Open','TAMIS','General',
]

const STOCK_IMAGES = [
  { label: 'Surgical Theatre', url: '/images/events/stock-theatre.jpg' },
  { label: 'Conference Hall', url: '/images/events/stock-conference.jpg' },
  { label: 'Laparoscopic', url: '/images/events/stock-laparoscopic.jpg' },
  { label: 'Robotic Surgery', url: '/images/events/stock-robotic.jpg' },
  { label: 'Anatomy Lab', url: '/images/events/stock-anatomy.jpg' },
  { label: 'Webinar / Online', url: '/images/events/stock-webinar.jpg' },
  { label: 'Dukes Gold', url: '/images/events/awr-yellow.png' },
  { label: 'IBD Yellow', url: '/images/events/ibd-yellow.png' },
  { label: 'Robot Blue', url: '/images/events/robot.png' },
]

const isStreamingType = (t: string) => ['Webinar', 'Online Lecture', 'Hybrid'].includes(t)

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface TimetableEntry { time: string; title: string }
interface TimetableDay { day: string; label: string; entries: TimetableEntry[] }

function parseCSV(text: string): TimetableEntry[] {
  const lines = text.trim().split('\n')
  const rows: TimetableEntry[] = []
  for (const line of lines) {
    const sep = line.includes('\t') ? '\t' : ','
    const parts = line.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ''))
    if (parts.length >= 2) {
      const time = parts[0]
      const title = parts.slice(1).join(', ')
      if (time.toLowerCase() === 'time' || time.toLowerCase() === 'start') continue
      rows.push({ time, title })
    }
  }
  return rows
}

/** Convert legacy flat timetable to multi-day format */
function normaliseTimetable(raw: any, startsAt?: string): TimetableDay[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  // Already multi-day format
  if (raw[0] && typeof raw[0] === 'object' && 'day' in raw[0] && 'entries' in raw[0]) {
    return raw as TimetableDay[]
  }
  // Legacy flat format — wrap in single day
  const day = startsAt ? startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  return [{ day, label: '', entries: raw as TimetableEntry[] }]
}

/** Flatten multi-day timetable for DB storage (returns null if empty) */
function serialiseTimetable(days: TimetableDay[]): TimetableDay[] | null {
  const nonEmpty = days.filter(d => d.entries.length > 0)
  return nonEmpty.length > 0 ? nonEmpty : null
}

const S = {
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 16, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 16, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 16, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif', minHeight: 100, resize: 'vertical' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  btn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  section: { background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E4E4E8', display: 'flex', flexDirection: 'column' as const, gap: 14 } as React.CSSProperties,
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#0F1F3D', marginBottom: 0 } as React.CSSProperties,
}

export default function EventsAdmin() {
  const { data: events, loading, create, update, remove } = useSupabaseTable<any>('events', 'starts_at', false)
  const [faculty, setFaculty] = useState<any[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('faculty').select('id, full_name, position_title, hospital, photo_url').order('full_name').then(({ data }: any) => setFaculty(data || []))
  }, [])

  const [eventFacultyMap, setEventFacultyMap] = useState<Record<string, { faculty_id: string; role: string }[]>>({})

  // Load event_faculty ONCE on mount — managed locally after that
  useEffect(() => {
    const supabase = createClient()
    supabase.from('event_faculty').select('event_id, faculty_id, role').then(({ data }: any) => {
      const map: Record<string, { faculty_id: string; role: string }[]> = {}
      ;(data || []).forEach((ef: any) => {
        if (!map[ef.event_id]) map[ef.event_id] = []
        map[ef.event_id].push({ faculty_id: ef.faculty_id, role: ef.role || 'Faculty' })
      })
      setEventFacultyMap(map)
    })
  }, [])

  const isApplicationType = (t: string) => ['Practical Workshop', 'In Person Course'].includes(t)

  const emptyForm = {
    title: '', slug: '', starts_at: '', ends_at: '', location: '', address: '',
    description_plain: '', event_type: 'In Person Course', capacity: 30,
    price_pence: 0, member_price_pence: '', status: 'draft',
    is_featured: false, booking_url: '', access_level: 'public',
    featured_image_url: '',
    assigned_faculty: [] as { faculty_id: string; role: string }[],
    stream_type: 'zoom', zoom_url: '', zoom_meeting_id: '', zoom_passcode: '',
    vimeo_live_id: '', vimeo_live_embed_url: '',
    subspecialties: [] as string[],
    timetable_data: [] as TimetableDay[],
    activeTimetableDay: 0,
    // Application fields
    applications_enabled: false,
    eligibility_criteria: '',
    eligibility_training_levels: [] as string[],
    application_deadline: '',
    application_questions: [] as { question: string; required: boolean }[],
    places_available: '' as string | number,
    auto_approve: false,
    confirmation_message: '',
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (e: any) => {
    setForm({
      title: e.title || '', slug: e.slug || '',
      starts_at: e.starts_at?.slice(0, 16) || '',
      ends_at: e.ends_at?.slice(0, 16) || '',
      location: e.location || '', address: e.address || '',
      description_plain: e.description_plain || '',
      event_type: e.event_type || 'In Person Course',
      capacity: e.capacity || 30, price_pence: e.price_pence || 0,
      member_price_pence: e.member_price_pence ?? '',
      status: e.status || 'draft', is_featured: e.is_featured || false,
      booking_url: e.booking_url || '', access_level: e.access_level || 'public',
      featured_image_url: e.featured_image_url || '',
      assigned_faculty: eventFacultyMap[e.id] || [],
      stream_type: e.stream_type || 'zoom',
      zoom_url: e.zoom_url || '', zoom_meeting_id: e.zoom_meeting_id || '',
      zoom_passcode: e.zoom_passcode || '',
      vimeo_live_id: e.vimeo_live_id || '', vimeo_live_embed_url: e.vimeo_live_embed_url || '',
      subspecialties: Array.isArray(e.subspecialties) ? e.subspecialties : [],
      timetable_data: normaliseTimetable(e.timetable_data, e.starts_at),
      activeTimetableDay: 0,
      // Application fields
      applications_enabled: e.applications_enabled || false,
      eligibility_criteria: e.eligibility_criteria || '',
      eligibility_training_levels: Array.isArray(e.eligibility_training_levels) ? e.eligibility_training_levels : [],
      application_deadline: e.application_deadline?.slice(0, 16) || '',
      application_questions: Array.isArray(e.application_questions) ? e.application_questions : [],
      places_available: e.places_available ?? '',
      auto_approve: e.auto_approve || false,
      confirmation_message: e.confirmation_message || '',
    })
    setEditing(e.id)
  }

  const handleSave = async () => {
    if (!form.title || !form.starts_at) { showToast('Title and start date are required', 'error'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload: any = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        location: form.location || null,
        address: form.address || null,
        description_plain: form.description_plain || null,
        event_type: form.event_type,
        capacity: form.capacity || null,
        price_pence: form.price_pence || 0,
        member_price_pence: form.member_price_pence ? Number(form.member_price_pence) : null,
        status: form.status,
        is_featured: form.is_featured,
        booking_url: form.booking_url || null,
        access_level: form.access_level,
        featured_image_url: form.featured_image_url || null,
        subspecialties: form.subspecialties,
        timetable_data: serialiseTimetable(form.timetable_data),
        published_at: form.status === 'published' ? new Date().toISOString() : null,
        // Application fields
        applications_enabled: form.applications_enabled,
        eligibility_criteria: form.eligibility_criteria || null,
        eligibility_training_levels: form.eligibility_training_levels,
        application_deadline: form.application_deadline ? new Date(form.application_deadline).toISOString() : null,
        application_questions: form.application_questions.length > 0 ? form.application_questions : [],
        places_available: form.places_available ? Number(form.places_available) : null,
        auto_approve: form.auto_approve,
        confirmation_message: form.confirmation_message || null,
      }
      if (isStreamingType(form.event_type)) {
        payload.stream_type = form.stream_type
        payload.zoom_url = form.zoom_url || null
        payload.zoom_meeting_id = form.zoom_meeting_id || null
        payload.zoom_passcode = form.zoom_passcode || null
        payload.vimeo_live_id = form.vimeo_live_id || null
        payload.vimeo_live_embed_url = form.vimeo_live_embed_url || null
      }

      let eventId: string
      if (editing === 'new') {
        const created = await create(payload)
        eventId = created.id
        showToast('Event created')
      } else {
        await update(editing!, payload)
        eventId = editing!
        showToast('Event updated')
      }

      // Sync event_faculty junction table
      const { error: delErr } = await supabase.from('event_faculty').delete().eq('event_id', eventId)
      if (delErr) console.error('DELETE event_faculty error:', delErr)

      if (form.assigned_faculty.length > 0) {
        const { error: insErr } = await supabase.from('event_faculty').insert(
          form.assigned_faculty.map((af) => ({
            event_id: eventId,
            faculty_id: af.faculty_id,
            role: af.role || 'Faculty',
          }))
        )
        if (insErr) console.error('INSERT event_faculty error:', insErr)
      }

      // Update local map
      setEventFacultyMap(prev => ({ ...prev, [eventId]: form.assigned_faculty }))
      setEditing(null)
    } catch (err: any) {
      showToast(err.message, 'error')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return
    setDeleting(id)
    try { await remove(id); showToast('Event deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const getFacultyNames = (eventId: string) => {
    const assigned = eventFacultyMap[eventId] || []
    return assigned.map(af => faculty.find(f => f.id === af.faculty_id)?.full_name).filter(Boolean).join(', ') || '—'
  }
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const filtered = events.filter((e: any) => {
    if (search && !e.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && e.event_type !== filterType) return false
    return true
  })

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#0F1F3D]">Events</h1>
          <p className="text-sm text-[#504F58] mt-1">{events.length} events in database</p>
        </div>
        <button onClick={openNew} style={S.btn} className="hidden sm:flex"><Plus size={16} strokeWidth={2.5} /> Add Event</button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input style={S.input} className="!max-w-full sm:!max-w-[300px] flex-1" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={S.select} className="!max-w-[180px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Mobile FAB */}
      <button onClick={openNew} className="sm:hidden fixed bottom-[4.5rem] right-4 z-30 w-14 h-14 rounded-full bg-[#0F1F3D] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform">
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '80px 20px', textAlign: 'center' }}>
          <Calendar size={40} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No events found</p>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>Create your first event to get started</p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #F1F1F3' }}>
                {['', 'Title', 'Date', 'Type', 'Faculty', 'Price', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px', ...(h === '' ? { width: 50 } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #F1F1F3' }}>
                  <td style={{ padding: '10px 16px' }}>
                    {e.featured_image_url ? (
                      <img src={e.featured_image_url} alt="" style={{ width: 40, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                      <div style={{ width: 40, height: 28, borderRadius: 4, background: '#F1F1F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Image size={14} color="#D1D1D6" />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#181820', maxWidth: 240 }}>
                    {isStreamingType(e.event_type) && <Radio size={13} style={{ display: 'inline', marginRight: 6, color: '#DC2626' }} />}
                    {e.title}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#504F58', whiteSpace: 'nowrap', fontSize: 13 }}>{fmtDate(e.starts_at)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={S.badge(
                      isStreamingType(e.event_type) ? '#EFF6FF' : '#F5F3FF',
                      isStreamingType(e.event_type) ? '#2563EB' : '#7C3AED'
                    )}>{e.event_type}</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#504F58', fontSize: 13, maxWidth: 180 }}>{getFacultyNames(e.id)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {e.price_pence === 0 ? <span style={S.badge('#f0fdf4', '#16a34a')}>Free</span> : `£${(e.price_pence / 100).toFixed(2)}`}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={S.badge(
                      e.status === 'published' ? '#f0fdf4' : e.status === 'draft' ? '#fefce8' : '#f3f4f6',
                      e.status === 'published' ? '#16a34a' : e.status === 'draft' ? '#a16207' : '#666'
                    )}>{e.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                      {e.applications_enabled && (
                        <Link href={`/admin/events/${e.id}/applicants`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                          borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                          background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                          <Users size={12} /> Applicants
                        </Link>
                      )}
                      <Link href={`/admin/events/${e.id}/feedback`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                        background: '#FEF9E7', color: '#92400E', border: '1px solid #FDE68A',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        <MessageSquare size={12} /> Feedback
                      </Link>
                      <button onClick={() => openEdit(e)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: '#F3F4F6', color: '#504F58', border: '1px solid #E4E4E8',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        <Edit size={12} /> Edit
                      </button>
                      <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: '#fff', color: '#D1D1D6', border: '1px solid #E4E4E8',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        {deleting === e.id ? <Loader className="animate-spin" size={12} /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3">
          {filtered.map((e: any) => (
            <div key={e.id} className="bg-white rounded-xl border border-[#E4E4E8] p-3.5 active:bg-gray-50">
              <div className="flex items-start gap-3">
                {e.featured_image_url ? (
                  <img src={e.featured_image_url} alt="" className="w-12 h-9 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-12 h-9 rounded bg-[#F1F1F3] flex items-center justify-center shrink-0">
                    <Image size={14} color="#D1D1D6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#181820] leading-snug truncate">
                    {isStreamingType(e.event_type) && <Radio size={11} className="inline mr-1 text-red-600" />}
                    {e.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[#504F58]">
                    <span>{fmtDate(e.starts_at)}</span>
                    <span>·</span>
                    <span>{e.price_pence === 0 ? 'Free' : `£${(e.price_pence / 100).toFixed(2)}`}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#F1F1F3]">
                <div className="flex items-center gap-1.5">
                  <span style={S.badge(
                    isStreamingType(e.event_type) ? '#EFF6FF' : '#F5F3FF',
                    isStreamingType(e.event_type) ? '#2563EB' : '#7C3AED'
                  )}>{e.event_type}</span>
                  <span style={S.badge(
                    e.status === 'published' ? '#f0fdf4' : e.status === 'draft' ? '#fefce8' : '#f3f4f6',
                    e.status === 'published' ? '#16a34a' : e.status === 'draft' ? '#a16207' : '#666'
                  )}>{e.status}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {e.applications_enabled && (
                    <Link href={`/admin/events/${e.id}/applicants`} className="p-2 rounded-lg bg-blue-50 text-blue-700">
                      <Users size={14} />
                    </Link>
                  )}
                  <Link href={`/admin/events/${e.id}/feedback`} className="p-2 rounded-lg bg-amber-50 text-amber-800">
                    <MessageSquare size={14} />
                  </Link>
                  <button onClick={() => openEdit(e)} className="p-2 rounded-lg bg-[#F3F4F6] text-[#504F58]">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="p-2 rounded-lg bg-white border border-[#E4E4E8] text-[#D1D1D6]">
                    {deleting === e.id ? <Loader className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto' }} className="p-3 md:p-6">
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex justify-between items-center px-4 py-4 sm:px-7 sm:py-5 border-b border-[#E4E4E8]">
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Create Event' : 'Edit Event'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>
            <div className="px-4 py-5 sm:px-7 sm:py-6" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>

              <div><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugify(e.target.value) })} placeholder="Event title" /></div>
              <div><label style={S.label}>Slug</label><input style={{ ...S.input, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>

              <div style={S.section}>
                <p style={S.sectionTitle}>EVENT IMAGE</p>
                <div>
                  <label style={S.label}>Image URL</label>
                  <input style={S.input} value={form.featured_image_url} onChange={(e) => setForm({ ...form, featured_image_url: e.target.value })} placeholder="https://... or select a stock image below" />
                  <p style={S.hint}>Paste any image URL, or pick from the stock images below</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {STOCK_IMAGES.map((img) => (
                    <button key={img.url} type="button" onClick={() => setForm({ ...form, featured_image_url: img.url })}
                      style={{ border: form.featured_image_url === img.url ? '2.5px solid #7C3AED' : '1.5px solid #D1D1D6', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#f8f8f8', padding: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F1F3' }}>
                        <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      </div>
                      <span style={{ fontSize: 10, padding: '4px 6px', color: form.featured_image_url === img.url ? '#7C3AED' : '#504F58', fontWeight: 600, textAlign: 'center' }}>{img.label}</span>
                    </button>
                  ))}
                </div>
                {form.featured_image_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={form.featured_image_url} alt="Preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #E4E4E8' }} />
                    <button type="button" onClick={() => setForm({ ...form, featured_image_url: '' })} style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove image</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div><label style={S.label}>Start Date/Time *</label><input style={S.input} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><label style={S.label}>End Date/Time</label><input style={S.input} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div><label style={S.label}>Location</label><input style={S.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Venue name" /></div>
                <div><label style={S.label}>Address</label><input style={S.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" /></div>
              </div>

              <div><label style={S.label}>Description</label><textarea style={S.textarea} value={form.description_plain} onChange={(e) => setForm({ ...form, description_plain: e.target.value })} placeholder="Event description..." /></div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
                <div>
                  <label style={S.label}>Event Type</label>
                  <select style={S.select} value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                    {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Capacity</label><input style={S.input} type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Access Level</label>
                  <select style={S.select} value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })}>
                    {ACCESS_LEVELS.map(a => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Faculty — searchable picker */}
              <div style={S.section}>
                <p style={S.sectionTitle}>SPEAKERS / FACULTY</p>
                {form.assigned_faculty.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.assigned_faculty.map((af, i) => {
                      const f = faculty.find(x => x.id === af.faculty_id)
                      return (
                        <div key={af.faculty_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E4E8', borderRadius: 8 }}>
                          {f?.photo_url ? (
                            <img src={f.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                              {f?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                            </div>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{f?.full_name || 'Unknown'}</span>
                          <select value={af.role} onChange={(e) => { const updated = [...form.assigned_faculty]; updated[i] = { ...updated[i], role: e.target.value }; setForm({ ...form, assigned_faculty: updated }) }}
                            style={{ padding: '4px 8px', border: '1px solid #D1D1D6', borderRadius: 6, fontSize: 12, color: '#504F58' }}>
                            <option value="Faculty">Faculty</option>
                            <option value="Course Director">Course Director</option>
                            <option value="Chair">Chair</option>
                            <option value="Speaker">Speaker</option>
                            <option value="Panellist">Panellist</option>
                          </select>
                          <button type="button" onClick={() => setForm({ ...form, assigned_faculty: form.assigned_faculty.filter((_, j) => j !== i) })}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><X size={14} /></button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div>
                  <label style={S.label}>Add Faculty Member</label>
                  <FacultyPicker
                    faculty={faculty}
                    selectedIds={form.assigned_faculty.map(af => af.faculty_id)}
                    onAdd={(id) => {
                      if (form.assigned_faculty.some(af => af.faculty_id === id)) { showToast('Already assigned', 'error'); return }
                      setForm({ ...form, assigned_faculty: [...form.assigned_faculty, { faculty_id: id, role: 'Faculty' }] })
                    }}
                    onRemove={(id) => setForm({ ...form, assigned_faculty: form.assigned_faculty.filter(af => af.faculty_id !== id) })}
                    onFacultyCreated={(f) => setFaculty(prev => [...prev, f].sort((a, b) => a.full_name.localeCompare(b.full_name)))}
                    showChips={false}
                  />
                  <p style={S.hint}>Search by name, hospital, or role. Can&apos;t find someone? Use the search to add a new faculty member inline.</p>
                </div>
              </div>

              {isStreamingType(form.event_type) && (
                <div style={S.section}>
                  <p style={S.sectionTitle}>STREAMING SETTINGS</p>
                  <div>
                    <label style={S.label}>Stream Type</label>
                    <select style={S.select} value={form.stream_type} onChange={(e) => setForm({ ...form, stream_type: e.target.value })}>
                      {STREAM_TYPES.map(t => <option key={t} value={t}>{t === 'zoom' ? 'Zoom' : t === 'vimeo_live' ? 'Vimeo Live' : 'Hybrid (Zoom + Vimeo)'}</option>)}
                    </select>
                  </div>
                  {(form.stream_type === 'zoom' || form.stream_type === 'hybrid') && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                        <div><label style={S.label}>Zoom URL</label><input style={S.input} value={form.zoom_url} onChange={(e) => setForm({ ...form, zoom_url: e.target.value })} placeholder="https://zoom.us/j/..." /></div>
                        <div><label style={S.label}>Meeting ID</label><input style={S.input} value={form.zoom_meeting_id} onChange={(e) => setForm({ ...form, zoom_meeting_id: e.target.value })} /></div>
                      </div>
                      <div style={{ maxWidth: 200 }}><label style={S.label}>Passcode</label><input style={S.input} value={form.zoom_passcode} onChange={(e) => setForm({ ...form, zoom_passcode: e.target.value })} /></div>
                    </>
                  )}
                  {(form.stream_type === 'vimeo_live' || form.stream_type === 'hybrid') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                      <div><label style={S.label}>Vimeo Live Event ID</label><input style={S.input} value={form.vimeo_live_id} onChange={(e) => setForm({ ...form, vimeo_live_id: e.target.value })} /></div>
                      <div><label style={S.label}>Vimeo Embed URL</label><input style={S.input} value={form.vimeo_live_embed_url} onChange={(e) => setForm({ ...form, vimeo_live_embed_url: e.target.value })} placeholder="https://vimeo.com/event/..." /></div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-3.5">
                <div><label style={S.label}>Price (pence)</label><input style={S.input} type="number" value={form.price_pence} onChange={(e) => setForm({ ...form, price_pence: Number(e.target.value) })} /><p style={S.hint}>0 = Free</p></div>
                <div><label style={S.label}>Member Price (pence)</label><input style={S.input} type="number" value={form.member_price_pence} onChange={(e) => setForm({ ...form, member_price_pence: e.target.value })} /><p style={S.hint}>Leave blank for same as above</p></div>
                <div className="col-span-2 sm:col-span-1"><label style={S.label}>Booking URL</label><input style={S.input} value={form.booking_url} onChange={(e) => setForm({ ...form, booking_url: e.target.value })} placeholder="https://..." /></div>
              </div>

              {/* APPLICATION SETTINGS — shown for workshops & courses */}
              {isApplicationType(form.event_type) && (
                <div style={S.section}>
                  <p style={S.sectionTitle}>APPLICATION SETTINGS</p>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#181820', cursor: 'pointer', marginBottom: 12 }}>
                    <input type="checkbox" checked={form.applications_enabled} onChange={(e) => setForm({ ...form, applications_enabled: e.target.checked })} style={{ width: 18, height: 18 }} />
                    Enable member applications for this event
                  </label>

                  {form.applications_enabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                        <div>
                          <label style={S.label}>Places Available</label>
                          <input style={S.input} type="number" value={form.places_available} onChange={(e) => setForm({ ...form, places_available: e.target.value })} placeholder="e.g. 20" />
                          <p style={S.hint}>Maximum approved applicants</p>
                        </div>
                        <div>
                          <label style={S.label}>Application Deadline</label>
                          <input style={S.input} type="datetime-local" value={form.application_deadline} onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} />
                          <p style={S.hint}>Leave blank for no deadline</p>
                        </div>
                      </div>

                      <div>
                        <label style={S.label}>Eligibility Criteria</label>
                        <textarea style={{ ...S.input, minHeight: 80 }} value={form.eligibility_criteria} onChange={(e) => setForm({ ...form, eligibility_criteria: e.target.value })} placeholder="Describe who is eligible to apply, e.g. 'Open to ST3+ colorectal trainees registered with ISCP'" />
                        <p style={S.hint}>Displayed to applicants on the event page</p>
                      </div>

                      <div>
                        <label style={S.label}>Required Training Level(s)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {['CT1-2', 'ST3', 'ST4', 'ST5', 'ST6', 'ST7', 'ST8', 'Post-CCT', 'Fellow', 'Consultant', 'SAS', 'Other'].map(level => {
                            const sel = form.eligibility_training_levels.includes(level)
                            return <button key={level} type="button" onClick={() => {
                              const v = sel ? form.eligibility_training_levels.filter(x => x !== level) : [...form.eligibility_training_levels, level]
                              setForm({ ...form, eligibility_training_levels: v })
                            }}
                              style={{ padding: '4px 12px', borderRadius: 20, border: sel ? '1.5px solid #2563EB' : '1.5px solid #D1D1D6', background: sel ? '#EFF6FF' : '#fff', color: sel ? '#2563EB' : '#504F58', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{level}</button>
                          })}
                        </div>
                        <p style={S.hint}>Leave empty to allow all training levels</p>
                      </div>

                      <div>
                        <label style={S.label}>Application Questions <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                        {form.application_questions.map((q, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <input style={{ ...S.input, flex: 1 }} value={q.question} onChange={(e) => {
                              const qs = [...form.application_questions]
                              qs[i] = { ...qs[i], question: e.target.value }
                              setForm({ ...form, application_questions: qs })
                            }} placeholder="e.g. What do you hope to gain from this course?" />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>
                              <input type="checkbox" checked={q.required} onChange={(e) => {
                                const qs = [...form.application_questions]
                                qs[i] = { ...qs[i], required: e.target.checked }
                                setForm({ ...form, application_questions: qs })
                              }} /> Required
                            </label>
                            <button type="button" onClick={() => setForm({ ...form, application_questions: form.application_questions.filter((_, j) => j !== i) })}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><X size={14} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setForm({ ...form, application_questions: [...form.application_questions, { question: '', required: false }] })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1.5px dashed #D1D1D6', borderRadius: 8, background: 'none', fontSize: 12, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>
                          <Plus size={13} /> Add question
                        </button>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 500, color: '#181820', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.auto_approve} onChange={(e) => setForm({ ...form, auto_approve: e.target.checked })} style={{ width: 16, height: 16 }} />
                        Auto-approve applications (skip manual review)
                      </label>

                      <div>
                        <label style={S.label}>Confirmation Message <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                        <textarea style={{ ...S.input, minHeight: 60 }} value={form.confirmation_message} onChange={(e) => setForm({ ...form, confirmation_message: e.target.value })} placeholder="Shown to applicants after approval, e.g. venue directions, what to bring" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={S.section}>
                <p style={S.sectionTitle}>TIMETABLE / SCHEDULE</p>

                {/* Day tabs */}
                {form.timetable_data.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {form.timetable_data.map((day, di) => (
                      <button key={di} type="button"
                        onClick={() => setForm(prev => ({ ...prev, activeTimetableDay: di }))}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: form.activeTimetableDay === di ? '2px solid #7C3AED' : '1.5px solid #D1D1D6',
                          background: form.activeTimetableDay === di ? '#F3EEFF' : '#fff',
                          color: form.activeTimetableDay === di ? '#7C3AED' : '#504F58',
                        }}>
                        {day.label || `Day ${di + 1}`}
                        {day.day && <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>({day.day})</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Add Day button */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={() => {
                    const startDate = form.starts_at ? new Date(form.starts_at) : new Date()
                    const dayOffset = form.timetable_data.length
                    const newDate = new Date(startDate)
                    newDate.setDate(newDate.getDate() + dayOffset)
                    const dayStr = newDate.toISOString().slice(0, 10)
                    setForm(prev => ({
                      ...prev,
                      timetable_data: [...prev.timetable_data, { day: dayStr, label: `Day ${prev.timetable_data.length + 1}`, entries: [] }],
                      activeTimetableDay: prev.timetable_data.length,
                    }))
                  }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1.5px dashed #7C3AED', borderRadius: 8, background: '#FAFAFF', fontSize: 12, fontWeight: 600, color: '#7C3AED', cursor: 'pointer' }}>
                    <Plus size={13} /> Add Day
                  </button>
                  {form.timetable_data.length > 0 && (
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, timetable_data: [], activeTimetableDay: 0 }))}
                      style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all days</button>
                  )}
                </div>

                {/* Active day editor */}
                {form.timetable_data.length > 0 && form.timetable_data[form.activeTimetableDay] && (() => {
                  const dayIdx = form.activeTimetableDay
                  const activeDay = form.timetable_data[dayIdx]
                  const updateDay = (updates: Partial<TimetableDay>) => {
                    setForm(prev => {
                      const days = [...prev.timetable_data]
                      days[dayIdx] = { ...days[dayIdx], ...updates }
                      return { ...prev, timetable_data: days }
                    })
                  }
                  const updateEntry = (ei: number, field: 'time' | 'title', value: string) => {
                    setForm(prev => {
                      const days = [...prev.timetable_data]
                      const entries = [...days[dayIdx].entries]
                      entries[ei] = { ...entries[ei], [field]: value }
                      days[dayIdx] = { ...days[dayIdx], entries }
                      return { ...prev, timetable_data: days }
                    })
                  }
                  const removeEntry = (ei: number) => {
                    setForm(prev => {
                      const days = [...prev.timetable_data]
                      days[dayIdx] = { ...days[dayIdx], entries: days[dayIdx].entries.filter((_, j) => j !== ei) }
                      return { ...prev, timetable_data: days }
                    })
                  }
                  const removeDay = () => {
                    setForm(prev => {
                      const days = prev.timetable_data.filter((_, j) => j !== dayIdx)
                      return { ...prev, timetable_data: days, activeTimetableDay: Math.max(0, dayIdx - 1) }
                    })
                  }

                  return (
                    <div style={{ border: '1px solid #E5E5EA', borderRadius: 10, padding: 16, background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Day header: date + label */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="date" style={{ ...S.input, maxWidth: 160 }} value={activeDay.day}
                          onChange={(e) => updateDay({ day: e.target.value })} />
                        <input style={{ ...S.input, flex: 1, minWidth: 120 }} value={activeDay.label}
                          onChange={(e) => updateDay({ label: e.target.value })} placeholder="Day label, e.g. Day 1 — Lectures" />
                        <button type="button" onClick={removeDay}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, flexShrink: 0, fontSize: 11, fontWeight: 600 }}>
                          <Trash2 size={14} /> Remove day
                        </button>
                      </div>

                      {/* CSV upload for this day */}
                      <label style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '16px 12px', border: '2px dashed #7C3AED', borderRadius: 10,
                        cursor: 'pointer', background: '#FAFAFF', transition: 'all 0.15s',
                      }}>
                        <Upload size={18} color="#7C3AED" style={{ marginBottom: 4 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>Upload CSV for {activeDay.label || `Day ${dayIdx + 1}`}</span>
                        <span style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Format: <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>09:00, Registration &amp; Coffee</code></span>
                        <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = (ev) => {
                            const text = ev.target?.result as string
                            const rows = parseCSV(text)
                            if (rows.length > 0) {
                              updateDay({ entries: [...activeDay.entries, ...rows] })
                              showToast(`Imported ${rows.length} entries into ${activeDay.label || `Day ${dayIdx + 1}`}`)
                            } else {
                              showToast('No valid rows found. Format: time, title', 'error')
                            }
                          }
                          reader.readAsText(file)
                          e.target.value = ''
                        }} />
                      </label>

                      {/* Entries */}
                      {activeDay.entries.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {activeDay.entries.map((entry, ei) => (
                            <div key={ei} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input style={{ ...S.input, maxWidth: 90, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={entry.time}
                                onChange={(e) => updateEntry(ei, 'time', e.target.value)} placeholder="09:00" />
                              <input style={{ ...S.input, flex: 1 }} value={entry.title}
                                onChange={(e) => updateEntry(ei, 'title', e.target.value)} placeholder="Session title" />
                              <button type="button" onClick={() => removeEntry(ei)}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, flexShrink: 0 }}><X size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add row */}
                      <button type="button" onClick={() => updateDay({ entries: [...activeDay.entries, { time: '', title: '' }] })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1.5px dashed #D1D1D6', borderRadius: 8, background: 'none', fontSize: 12, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>
                        <Plus size={13} /> Add row
                      </button>
                    </div>
                  )
                })()}
              </div>

              <div>
                <label style={S.label}>Tags / Subspecialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUBSPECIALTIES.map(s => {
                    const selected = form.subspecialties.includes(s)
                    return (
                      <button key={s} type="button" onClick={() => {
                        const subs = selected ? form.subspecialties.filter(x => x !== s) : [...form.subspecialties, s]
                        setForm({ ...form, subspecialties: subs })
                      }}
                        style={{ padding: '4px 12px', borderRadius: 20, border: selected ? '1.5px solid #7C3AED' : '1.5px solid #D1D1D6', background: selected ? '#F5F3FF' : '#fff', color: selected ? '#7C3AED' : '#504F58', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#181820', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} style={{ width: 18, height: 18 }} />
                Featured Event
              </label>
            </div>

            <div className="flex justify-end gap-3 px-4 py-4 sm:px-7 sm:py-4.5 border-t border-[#E4E4E8] bg-[#FAFAFA] rounded-b-[20px]">
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Create Event' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}