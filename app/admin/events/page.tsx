'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Edit, Trash2, Save, Loader, X, Radio, Users } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'

const EVENT_TYPES = ['Webinar', 'Online Lecture', 'Practical Workshop', 'In Person Course', 'Hybrid', 'Conference']
const STATUSES = ['draft', 'published', 'archived']
const STREAM_TYPES = ['zoom', 'vimeo_live', 'hybrid']
const ACCESS_LEVELS = ['public', 'registered', 'members_only', 'invite_only']
const SUBSPECIALTIES = [
  'Cancer','Rectal Cancer','IBD','Pelvic Floor','Robotic','Laparoscopic',
  'Intestinal Failure','Proctology','Fistula','Emergency','Upper GI','HPB',
  'Endocrine','Breast','Trauma','Abdominal Wall','Endoscopy','Research',
]

const isStreamingType = (t: string) => ['Webinar', 'Online Lecture', 'Hybrid'].includes(t)

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/* ── Styles ──────────────────────────────────────── */
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

  // Load faculty
  useEffect(() => {
    const supabase = createClient()
    supabase.from('faculty').select('id, name, title, institution').order('name').then(({ data }) => setFaculty(data || []))
  }, [])

  const emptyForm = {
    title: '', slug: '', starts_at: '', ends_at: '', location: '', address: '',
    description_plain: '', event_type: 'In Person Course', capacity: 30,
    price_pence: 0, member_price_pence: '', status: 'draft',
    is_featured: false, booking_url: '', access_level: 'public',
    // Faculty
    faculty_id: '',
    // Streaming (shown when event type is Webinar/Online Lecture/Hybrid)
    stream_type: 'zoom', zoom_url: '', zoom_meeting_id: '', zoom_passcode: '',
    vimeo_live_id: '', vimeo_live_embed_url: '',
    // Tags
    subspecialties: [] as string[],
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
      faculty_id: e.faculty_id || '',
      stream_type: e.stream_type || 'zoom',
      zoom_url: e.zoom_url || '', zoom_meeting_id: e.zoom_meeting_id || '',
      zoom_passcode: e.zoom_passcode || '',
      vimeo_live_id: e.vimeo_live_id || '', vimeo_live_embed_url: e.vimeo_live_embed_url || '',
      subspecialties: Array.isArray(e.subspecialties) ? e.subspecialties : [],
    })
    setEditing(e.id)
  }

  const handleSave = async () => {
    if (!form.title || !form.starts_at) { showToast('Title and start date are required', 'error'); return }
    setSaving(true)
    try {
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
        faculty_id: form.faculty_id || null,
        subspecialties: form.subspecialties,
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      }
      // Only include streaming fields if it's a streaming event type
      if (isStreamingType(form.event_type)) {
        payload.stream_type = form.stream_type
        payload.zoom_url = form.zoom_url || null
        payload.zoom_meeting_id = form.zoom_meeting_id || null
        payload.zoom_passcode = form.zoom_passcode || null
        payload.vimeo_live_id = form.vimeo_live_id || null
        payload.vimeo_live_embed_url = form.vimeo_live_embed_url || null
      }
      if (editing === 'new') { await create(payload); showToast('Event created') }
      else { await update(editing!, payload); showToast('Event updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return
    setDeleting(id)
    try { await remove(id); showToast('Event deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const getFacultyName = (id: string) => faculty.find(f => f.id === id)?.name || ''
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const filtered = events.filter((e: any) => {
    if (search && !e.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && e.event_type !== filterType) return false
    return true
  })

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Events</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>{events.length} events in database</p>
        </div>
        <button onClick={openNew} style={S.btn}><Plus size={16} strokeWidth={2.5} /> Add Event</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input style={{ ...S.input, maxWidth: 300 }} placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={{ ...S.select, maxWidth: 180 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
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
                {['Title', 'Date', 'Type', 'Faculty', 'Price', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e: any) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #F1F1F3' }}>
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
                  <td style={{ padding: '14px 16px', color: '#504F58', fontSize: 13 }}>{e.faculty_id ? getFacultyName(e.faculty_id) : '—'}</td>
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

      {/* ── Edit Modal ─────────────────────────────── */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #E4E4E8' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Create Event' : 'Edit Event'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Title & Slug */}
              <div><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugify(e.target.value) })} placeholder="Event title" /></div>
              <div><label style={S.label}>Slug</label><input style={{ ...S.input, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Start Date/Time *</label><input style={S.input} type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><label style={S.label}>End Date/Time</label><input style={S.input} type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>

              {/* Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Location</label><input style={S.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Venue name" /></div>
                <div><label style={S.label}>Address</label><input style={S.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Full address" /></div>
              </div>

              {/* Description */}
              <div><label style={S.label}>Description</label><textarea style={S.textarea} value={form.description_plain} onChange={(e) => setForm({ ...form, description_plain: e.target.value })} placeholder="Event description..." /></div>

              {/* Type, Capacity, Status, Access */}
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

              {/* Faculty */}
              <div style={S.section}>
                <p style={S.sectionTitle}>SPEAKER / FACULTY</p>
                <div>
                  <label style={S.label}>Select from Faculty Database</label>
                  <select style={S.select} value={form.faculty_id} onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}>
                    <option value="">— No faculty assigned —</option>
                    {faculty.map(f => (
                      <option key={f.id} value={f.id}>{f.name}{f.institution ? ` — ${f.institution}` : ''}</option>
                    ))}
                  </select>
                  <p style={S.hint}>Select a faculty member from the database. Add new faculty via the Faculty admin page.</p>
                </div>
              </div>

              {/* Streaming section - only for webinar/online/hybrid */}
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

              {/* Pricing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Price (pence)</label><input style={S.input} type="number" value={form.price_pence} onChange={(e) => setForm({ ...form, price_pence: Number(e.target.value) })} /><p style={S.hint}>0 = Free</p></div>
                <div><label style={S.label}>Member Price (pence)</label><input style={S.input} type="number" value={form.member_price_pence} onChange={(e) => setForm({ ...form, member_price_pence: e.target.value })} /><p style={S.hint}>Leave blank for same as above</p></div>
                <div><label style={S.label}>Booking URL</label><input style={S.input} value={form.booking_url} onChange={(e) => setForm({ ...form, booking_url: e.target.value })} placeholder="https://..." /></div>
              </div>

              {/* Subspecialties / Tags */}
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

              {/* Featured */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#181820', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} style={{ width: 18, height: 18 }} />
                Featured Event
              </label>
            </div>

            {/* Footer */}
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
