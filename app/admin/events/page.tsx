'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, Plus, Edit, Trash2, Save, Loader, X, Radio, Users, Image, Upload } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'

const EVENT_TYPES = ['Webinar', 'Online Lecture', 'Practical Workshop', 'In Person Course', 'Hybrid', 'Conference']
const STATUSES = ['draft', 'published', 'archived']
const STREAM_TYPES = ['zoom', 'vimeo_live', 'hybrid']
const ACCESS_LEVELS = ['public', 'registered', 'members_only', 'invite_only']
const SUBSPECIALTIES = [
  'Cancer - Colon','Cancer - Rectal','Cancer - Anal','Cancer - Advanced',
  'Peritoneal Malignancy','IBD','Abdominal Wall','Pelvic Floor',
  'Proctology','Fistula','Intestinal Failure','Emergency','Trauma',
  'Research','Endoscopy','Training','Radiology','Robotic','Laparoscopic',
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

function parseCSV(text: string): { time: string; title: string }[] {
  const lines = text.trim().split('\n')
  const rows: { time: string; title: string }[] = []
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

const S = {
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif', minHeight: 100, resize: 'vertical' as const } as React.CSSProperties,
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

  // Ref to prevent the useEffect from overwriting our local faculty map after save
  const skipNextFacultyLoad = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('faculty').select('id, full_name, position_title, hospital').order('full_name').then(({ data }) => setFaculty(data || []))
  }, [])

  const [eventFacultyMap, setEventFacultyMap] = useState<Record<string, { faculty_id: string; role: string }[]>>({})

  // Load event_faculty junction data — but skip if we just saved
  useEffect(() => {
    if (skipNextFacultyLoad.current) {
      skipNextFacultyLoad.current = false
      return
    }
    const supabase = createClient()
    supabase.from('event_faculty').select('event_id, faculty_id, role').then(({ data }) => {
      const map: Record<string, { faculty_id: string; role: string }[]> = {}
      ;(data || []).forEach((ef: any) => {
        if (!map[ef.event_id]) map[ef.event_id] = []
        map[ef.event_id].push({ faculty_id: ef.faculty_id, role: ef.role || 'Faculty' })
      })
      setEventFacultyMap(map)
    })
  }, [events]) // re-run when events change, but skip after our own save

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
    timetable_data: [] as { time: string; title: string }[],
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
      timetable_data: Array.isArray(e.timetable_data) ? e.timetable_data : [],
    })
    setEditing(e.id)
  }

  // Helper to sync junction table
  const syncFaculty = async (supabase: any, eventId: string, assignedFaculty: { faculty_id: string; role: string }[]) => {
    const { error: delErr } = await supabase.from('event_faculty').delete().eq('event_id', eventId)
    if (delErr) console.error('DELETE event_faculty:', delErr)
    if (assignedFaculty.length > 0) {
      const { error: insErr } = await supabase.from('event_faculty').insert(
        assignedFaculty.map((af: any, i: number) => ({
          event_id: eventId,
          faculty_id: af.faculty_id,
          role: af.role || 'Faculty',
        }))
      )
      if (insErr) console.error('INSERT event_faculty:', insErr)
    }
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
        timetable_data: form.timetable_data.length > 0 ? form.timetable_data : null,
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      }
      if (isStreamingType(form.event_type)) {
        payload.stream_type = form.stream_type
        payload.zoom_url = form.zoom_url || null
        payload.zoom_meeting_id = form.zoom_meeting_id || null
        payload.zoom_passcode = form.zoom_passcode || null
        payload.vimeo_live_id = form.vimeo_live_id || null
        payload.vimeo_live_embed_url = form.vimeo_live_embed_url || null
      }

      // Tell the useEffect not to overwrite our local map on the next re-render
      skipNextFacultyLoad.current = true

      let eventId: string
      if (editing === 'new') {
        // For new events: create first to get ID, then sync faculty
        const created = await create(payload)
        eventId = created.id
        await syncFaculty(supabase, eventId, form.assigned_faculty)
        showToast('Event created')
      } else {
        // For edits: sync faculty FIRST, then update event
        // This prevents the race condition where update() triggers a refetch
        // that reads empty junction data between delete and insert
        eventId = editing!
        await syncFaculty(supabase, eventId, form.assigned_faculty)
        await update(editing!, payload)
        showToast('Event updated')
      }

      // Update local map immediately
      setEventFacultyMap(prev => ({ ...prev, [eventId]: form.assigned_faculty }))
      setEditing(null)
    } catch (err: any) {
      showToast(err.message, 'error')
      skipNextFacultyLoad.current = false
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Events</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>{events.length} events in database</p>
        </div>
        <button onClick={openNew} style={S.btn}><Plus size={16} strokeWidth={2.5} /> Add Event</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input style={{ ...S.input, maxWidth: 300 }} placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...S.select, maxWidth: 180 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '80px 20px', textAlign: 'center' }}>
          <Calendar size={40} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No events found</p>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>Create your first event to get started</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', overflow: 'auto' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => openEdit(e)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Edit size={16} /></button>
                      <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}>
                        {deleting === e.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #E4E4E8' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Create Event' : 'Edit Event'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Start Date/Time *</label><input style={S.input} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><label style={S.label}>End Date/Time</label><input style={S.input} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Location</label><input style={S.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Venue name" /></div>
                <div><label style={S.label}>Address</label><input style={S.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" /></div>
              </div>

              <div><label style={S.label}>Description</label><textarea style={S.textarea} value={form.description_plain} onChange={(e) => setForm({ ...form, description_plain: e.target.value })} placeholder="Event description..." /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
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
                  <select style={S.select} value="" onChange={(e) => {
                    if (!e.target.value) return
                    if (form.assigned_faculty.some(af => af.faculty_id === e.target.value)) { showToast('Already assigned', 'error'); return }
                    setForm({ ...form, assigned_faculty: [...form.assigned_faculty, { faculty_id: e.target.value, role: 'Faculty' }] })
                  }}>
                    <option value="">— Select faculty to add —</option>
                    {faculty.filter(f => !form.assigned_faculty.some(af => af.faculty_id === f.id)).map(f => (
                      <option key={f.id} value={f.id}>{f.full_name}{f.hospital ? ` — ${f.hospital}` : ''}</option>
                    ))}
                  </select>
                  <p style={S.hint}>Add multiple faculty members. Manage faculty via the <a href="/admin/faculty" style={{ color: '#2563EB', textDecoration: 'underline' }}>Faculty admin page</a>.</p>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div><label style={S.label}>Zoom URL</label><input style={S.input} value={form.zoom_url} onChange={(e) => setForm({ ...form, zoom_url: e.target.value })} placeholder="https://zoom.us/j/..." /></div>
                        <div><label style={S.label}>Meeting ID</label><input style={S.input} value={form.zoom_meeting_id} onChange={(e) => setForm({ ...form, zoom_meeting_id: e.target.value })} /></div>
                      </div>
                      <div style={{ maxWidth: 200 }}><label style={S.label}>Passcode</label><input style={S.input} value={form.zoom_passcode} onChange={(e) => setForm({ ...form, zoom_passcode: e.target.value })} /></div>
                    </>
                  )}
                  {(form.stream_type === 'vimeo_live' || form.stream_type === 'hybrid') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div><label style={S.label}>Vimeo Live Event ID</label><input style={S.input} value={form.vimeo_live_id} onChange={(e) => setForm({ ...form, vimeo_live_id: e.target.value })} /></div>
                      <div><label style={S.label}>Vimeo Embed URL</label><input style={S.input} value={form.vimeo_live_embed_url} onChange={(e) => setForm({ ...form, vimeo_live_embed_url: e.target.value })} placeholder="https://vimeo.com/event/..." /></div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Price (pence)</label><input style={S.input} type="number" value={form.price_pence} onChange={(e) => setForm({ ...form, price_pence: Number(e.target.value) })} /><p style={S.hint}>0 = Free</p></div>
                <div><label style={S.label}>Member Price (pence)</label><input style={S.input} type="number" value={form.member_price_pence} onChange={(e) => setForm({ ...form, member_price_pence: e.target.value })} /><p style={S.hint}>Leave blank for same as above</p></div>
                <div><label style={S.label}>Booking URL</label><input style={S.input} value={form.booking_url} onChange={(e) => setForm({ ...form, booking_url: e.target.value })} placeholder="https://..." /></div>
              </div>

              <div style={S.section}>
                <p style={S.sectionTitle}>TIMETABLE / SCHEDULE</p>
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '24px 16px', border: '2px dashed #7C3AED', borderRadius: 12,
                  cursor: 'pointer', background: '#FAFAFF', transition: 'all 0.15s',
                }}>
                  <Upload size={24} color="#7C3AED" style={{ marginBottom: 8 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED' }}>Upload CSV Timetable</span>
                  <span style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Click to select a .csv or .tsv file</span>
                  <span style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Format: <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>09:00, Registration &amp; Coffee</code></span>
                  <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const text = ev.target?.result as string
                      const rows = parseCSV(text)
                      if (rows.length > 0) {
                        setForm(prev => ({ ...prev, timetable_data: rows }))
                        showToast(`Imported ${rows.length} timetable entries`)
                      } else {
                        showToast('No valid rows found. Format: time, title', 'error')
                      }
                    }
                    reader.readAsText(file)
                    e.target.value = ''
                  }} />
                </label>
                {form.timetable_data.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.timetable_data.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input style={{ ...S.input, maxWidth: 90, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={entry.time}
                          onChange={(e) => { const u = [...form.timetable_data]; u[i] = { ...u[i], time: e.target.value }; setForm({ ...form, timetable_data: u }) }} placeholder="09:00" />
                        <input style={{ ...S.input, flex: 1 }} value={entry.title}
                          onChange={(e) => { const u = [...form.timetable_data]; u[i] = { ...u[i], title: e.target.value }; setForm({ ...form, timetable_data: u }) }} placeholder="Session title" />
                        <button type="button" onClick={() => setForm({ ...form, timetable_data: form.timetable_data.filter((_, j) => j !== i) })}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, flexShrink: 0 }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button type="button" onClick={() => setForm({ ...form, timetable_data: [...form.timetable_data, { time: '', title: '' }] })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1.5px dashed #D1D1D6', borderRadius: 8, background: 'none', fontSize: 12, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>
                    <Plus size={13} /> Add row
                  </button>
                  {form.timetable_data.length > 0 && (
                    <button type="button" onClick={() => setForm({ ...form, timetable_data: [] })}
                      style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear all</button>
                  )}
                </div>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '18px 28px', borderTop: '1px solid #E4E4E8', background: '#FAFAFA', borderRadius: '0 0 20px 20px' }}>
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