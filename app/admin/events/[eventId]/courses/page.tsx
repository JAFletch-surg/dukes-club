'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Save, Loader, X, Clock, Users, Star,
  MessageSquare, Pencil, GripVertical,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FacultyPicker } from '@/components/admin/faculty-picker'
import { EditFacultyDialog } from '@/components/admin/edit-faculty-dialog'
import { RichTextField } from '@/components/admin/rich-text-field'
import { richTextToHtml, htmlToPlainText } from '@/lib/rich-text'
import { coursesOverlap } from '@/lib/events'

// Friday and Sunday courses for a Dukes Weekend.
//
// Saturday is the main programme and does not use the course model — its
// schedule lives in the event's own timetable_data, like every other event.

const S = {
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 16, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 16, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  section: { background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E4E4E8', display: 'flex', flexDirection: 'column' as const, gap: 14 } as React.CSSProperties,
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#0F1F3D' } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  dashed: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1.5px dashed #D1D1D6', borderRadius: 8, background: 'none', fontSize: 12, fontWeight: 600, color: '#504F58', cursor: 'pointer' } as React.CSSProperties,
}

interface TimetableItem { time: string; title: string; description: string; faculty_id: string }

interface WeekendEvent {
  id: string
  title: string
  slug: string
  starts_at: string
}

interface AvailabilityRow {
  course_id: string
  booked: number
  waitlisted: number
}

interface CourseRow {
  id: string
  event_id: string
  day: 'friday' | 'sunday'
  title: string
  description_html: string | null
  starts_at: string
  ends_at: string
  capacity: number
  is_revision_course: boolean
  learning_objectives: string[]
  timetable_data: TimetableItem[]
  waitlist_enabled: boolean
  sort_order: number
}

export default function WeekendCoursesAdmin() {
  const { eventId } = useParams<{ eventId: string }>()
  const supabase = createClient()

  const [event, setEvent] = useState<WeekendEvent | null>(null)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [counts, setCounts] = useState<Record<string, { booked: number; waitlisted: number }>>({})
  const [faculty, setFaculty] = useState<FacultyMember[]>([])
  const [courseFaculty, setCourseFaculty] = useState<Record<string, { faculty_id: string; role: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editFacultyId, setEditFacultyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = {
    day: 'friday' as 'friday' | 'sunday',
    title: '',
    description: '',
    starts_at: '',
    ends_at: '',
    capacity: 20,
    is_revision_course: false,
    waitlist_enabled: true,
    sort_order: 0,
    learning_objectives: [] as string[],
    timetable_data: [] as TimetableItem[],
    assigned_faculty: [] as { faculty_id: string; role: string }[],
  }
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    const [{ data: ev }, { data: courseRows }, { data: avail }, { data: people }, { data: links }] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('weekend_courses').select('*').eq('event_id', eventId).order('day').order('sort_order'),
      supabase.rpc('weekend_course_availability', { p_event_id: eventId }),
      supabase.from('faculty').select('id, full_name, position_title, hospital, photo_url').order('full_name'),
      supabase.from('weekend_course_faculty').select('course_id, faculty_id, role'),
    ])

    setEvent(ev)
    setCourses((courseRows || []) as CourseRow[])
    setFaculty(people || [])

    const c: Record<string, { booked: number; waitlisted: number }> = {}
    for (const a of (avail || []) as AvailabilityRow[]) c[a.course_id] = { booked: Number(a.booked), waitlisted: Number(a.waitlisted) }
    setCounts(c)

    const map: Record<string, { faculty_id: string; role: string }[]> = {}
    for (const l of (links || []) as { course_id: string; faculty_id: string; role: string | null }[]) {
      if (!map[l.course_id]) map[l.course_id] = []
      map[l.course_id].push({ faculty_id: l.faculty_id, role: l.role || 'Faculty' })
    }
    setCourseFaculty(map)
    setLoading(false)
  }, [supabase, eventId])

  useEffect(() => { if (eventId) load() }, [eventId, load])

  const openNew = (day: 'friday' | 'sunday') => {
    // Seed the times from the event's own dates so an admin is not typing the
    // weekend's date in by hand for every course.
    const base = event?.starts_at ? new Date(event.starts_at) : new Date()
    const offset = day === 'friday' ? 0 : 2
    const seed = new Date(base)
    seed.setDate(seed.getDate() + offset)
    const dayStr = seed.toISOString().slice(0, 10)

    setForm({
      ...emptyForm,
      day,
      starts_at: `${dayStr}T09:00`,
      ends_at: `${dayStr}T12:00`,
      sort_order: courses.filter(c => c.day === day).length,
    })
    setEditing('new')
  }

  const openEdit = (c: CourseRow) => {
    setForm({
      day: c.day,
      title: c.title,
      description: c.description_html || '',
      starts_at: c.starts_at?.slice(0, 16) || '',
      ends_at: c.ends_at?.slice(0, 16) || '',
      capacity: c.capacity,
      is_revision_course: c.is_revision_course,
      waitlist_enabled: c.waitlist_enabled,
      sort_order: c.sort_order,
      learning_objectives: Array.isArray(c.learning_objectives) ? c.learning_objectives : [],
      timetable_data: Array.isArray(c.timetable_data) ? c.timetable_data : [],
      assigned_faculty: courseFaculty[c.id] || [],
    })
    setEditing(c.id)
  }

  const handleSave = async () => {
    if (!form.title || !form.starts_at || !form.ends_at) {
      showToast('Title, start and end time are required', 'error'); return
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      showToast('End time must be after the start time', 'error'); return
    }
    if (!form.capacity || form.capacity < 1) {
      showToast('Capacity must be at least 1', 'error'); return
    }

    setSaving(true)
    try {
      const html = richTextToHtml(form.description)
      const payload = {
        event_id: eventId,
        day: form.day,
        title: form.title,
        description_html: html || null,
        description_plain: htmlToPlainText(html) || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        capacity: Number(form.capacity),
        is_revision_course: form.is_revision_course,
        waitlist_enabled: form.waitlist_enabled,
        sort_order: Number(form.sort_order) || 0,
        learning_objectives: form.learning_objectives.filter(o => o.trim()),
        timetable_data: form.timetable_data.filter(t => t.time || t.title),
      }

      let courseId: string
      if (editing === 'new') {
        const { data, error } = await supabase.from('weekend_courses').insert(payload).select('id').single()
        if (error) throw error
        courseId = data.id
      } else {
        const { error } = await supabase.from('weekend_courses').update(payload).eq('id', editing!)
        if (error) throw error
        courseId = editing!
      }

      // Same delete-then-reinsert sync as event_faculty on the events screen.
      await supabase.from('weekend_course_faculty').delete().eq('course_id', courseId)
      if (form.assigned_faculty.length > 0) {
        await supabase.from('weekend_course_faculty').insert(
          form.assigned_faculty.map(af => ({
            course_id: courseId, faculty_id: af.faculty_id, role: af.role || 'Faculty',
          }))
        )
      }

      showToast(editing === 'new' ? 'Course created' : 'Course updated')
      setEditing(null)
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the course', 'error')
    }
    setSaving(false)
  }

  const handleDelete = async (course: CourseRow) => {
    const held = counts[course.id]
    const warning = held && (held.booked > 0 || held.waitlisted > 0)
      ? `\n\n${held.booked} member(s) hold a place and ${held.waitlisted} are waitlisted. Their bookings will be deleted too.`
      : ''
    if (!confirm(`Delete "${course.title}"?${warning}`)) return

    setDeleting(course.id)
    try {
      const { error } = await supabase.from('weekend_courses').delete().eq('id', course.id)
      if (error) throw error
      showToast('Course deleted')
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete the course', 'error')
    }
    setDeleting(null)
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const renderDay = (day: 'friday' | 'sunday') => {
    const dayCourses = courses.filter(c => c.day === day)

    return (
      <div style={{ marginBottom: 32 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F1F3D', textTransform: 'capitalize' }}>
            {day}
            <span style={{ fontWeight: 400, color: '#888', fontSize: 14, marginLeft: 8 }}>
              {dayCourses.length} course{dayCourses.length === 1 ? '' : 's'}
            </span>
          </h2>
          <button onClick={() => openNew(day)} style={{ ...S.dashed, borderColor: '#7C3AED', color: '#7C3AED' }}>
            <Plus size={13} /> Add {day} course
          </button>
        </div>

        {dayCourses.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px dashed #D1D1D6', padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#888' }}>No {day} courses yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dayCourses.map(course => {
              const held = counts[course.id] || { booked: 0, waitlisted: 0 }
              // Overlaps are expected and fine — members simply cannot hold two
              // at once. Flagging them helps an admin see the shape of the day.
              const clashes = dayCourses.filter(o => o.id !== course.id && coursesOverlap(course, o))

              return (
                <div key={course.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E4E8', padding: 16 }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <GripVertical size={13} color="#D1D1D6" />
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#181820' }}>{course.title}</span>
                        {course.is_revision_course && (
                          <span style={S.badge('#FEF9E7', '#92400E')}><Star size={9} /> Revision</span>
                        )}
                        {!course.waitlist_enabled && (
                          <span style={S.badge('#F3F4F6', '#666')}>No waitlist</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap" style={{ marginTop: 6, fontSize: 12, color: '#504F58' }}>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} /> {fmtDay(course.starts_at)} · {fmtTime(course.starts_at)}–{fmtTime(course.ends_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} /> {held.booked}/{course.capacity} booked
                          {held.waitlisted > 0 && ` · ${held.waitlisted} waitlisted`}
                        </span>
                        <span>
                          {(courseFaculty[course.id] || [])
                            .map(cf => faculty.find(f => f.id === cf.faculty_id)?.full_name)
                            .filter(Boolean).join(', ') || 'No faculty assigned'}
                        </span>
                      </div>
                      {clashes.length > 0 && (
                        <p style={{ fontSize: 11, color: '#92400E', marginTop: 6 }}>
                          Runs at the same time as {clashes.map(c => c.title).join(', ')} — members can only take one.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href={`/admin/events/${eventId}/feedback?courseId=${course.id}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                        background: '#FEF9E7', color: '#92400E', border: '1px solid #FDE68A', whiteSpace: 'nowrap',
                      }}>
                        <MessageSquare size={12} /> Feedback
                      </Link>
                      <button onClick={() => openEdit(course)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: '#F3F4F6', color: '#504F58', border: '1px solid #E4E4E8', cursor: 'pointer',
                      }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => handleDelete(course)} disabled={deleting === course.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: '#fff', color: '#D1D1D6', border: '1px solid #E4E4E8', cursor: 'pointer',
                      }}>
                        {deleting === course.id ? <Loader className="animate-spin" size={12} /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
  }

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      <Link href="/admin/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7C3AED', textDecoration: 'none', fontWeight: 600, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to Events
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl md:text-[28px] font-bold text-[#0F1F3D]">Weekend Courses</h1>
        <p className="text-sm text-[#504F58] mt-1">{event?.title}</p>
      </div>

      <div style={{ background: '#F8FAFC', border: '1px solid #E4E4E8', borderRadius: 12, padding: 14, marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: '#504F58', lineHeight: 1.6, margin: 0 }}>
          Courses run on Friday and Sunday. Saturday is the main programme — edit its schedule in the
          event&apos;s own timetable. A member may hold only one course per overlapping time slot, and
          each course has its own capacity and feedback form.
        </p>
      </div>

      {renderDay('friday')}
      {renderDay('sunday')}

      {/* ── Editor ── */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto' }} className="p-3 md:p-6">
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex justify-between items-center px-4 py-4 sm:px-7 sm:py-5 border-b border-[#E4E4E8]">
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>
                {editing === 'new' ? 'Add Course' : 'Edit Course'}
              </h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>

            <div className="px-4 py-5 sm:px-7 sm:py-6" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
                <div>
                  <label style={S.label}>Day *</label>
                  <select style={S.select} value={form.day} onChange={e => setForm({ ...form, day: e.target.value as 'friday' | 'sunday' })}>
                    <option value="friday">Friday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Capacity *</label>
                  <input style={S.input} type="number" min={1} value={form.capacity}
                    onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} />
                  <p style={S.hint}>Hard limit — bookings are refused at capacity.</p>
                </div>
                <div>
                  <label style={S.label}>Sort Order</label>
                  <input style={S.input} type="number" value={form.sort_order}
                    onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <label style={S.label}>Title *</label>
                <input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Laparoscopic Skills Workshop" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div>
                  <label style={S.label}>Starts *</label>
                  <input style={S.input} type="datetime-local" value={form.starts_at}
                    onChange={e => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Ends *</label>
                  <input style={S.input} type="datetime-local" value={form.ends_at}
                    onChange={e => setForm({ ...form, ends_at: e.target.value })} />
                  <p style={S.hint}>Times decide which courses clash.</p>
                </div>
              </div>

              <RichTextField
                label="Description"
                value={form.description}
                onChange={v => setForm({ ...form, description: v })}
                placeholder="What does this course cover, and who is it for?"
                minHeight={140}
              />

              {/* Learning objectives */}
              <div style={S.section}>
                <p style={S.sectionTitle}>LEARNING OBJECTIVES</p>
                {form.learning_objectives.map((obj, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#888', width: 18 }}>{i + 1}.</span>
                    <input style={{ ...S.input, flex: 1 }} value={obj}
                      onChange={e => {
                        const next = [...form.learning_objectives]
                        next[i] = e.target.value
                        setForm({ ...form, learning_objectives: next })
                      }}
                      placeholder="e.g. Perform a safe laparoscopic entry" />
                    <button type="button" onClick={() => setForm({ ...form, learning_objectives: form.learning_objectives.filter((_, j) => j !== i) })}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><X size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setForm({ ...form, learning_objectives: [...form.learning_objectives, ''] })} style={S.dashed}>
                  <Plus size={13} /> Add objective
                </button>
              </div>

              {/* Course timetable */}
              <div style={S.section}>
                <p style={S.sectionTitle}>COURSE TIMETABLE</p>
                {form.timetable_data.map((item, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: '#fff', border: '1px solid #E4E4E8', borderRadius: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input style={{ ...S.input, maxWidth: 90, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={item.time}
                        onChange={e => {
                          const next = [...form.timetable_data]
                          next[i] = { ...next[i], time: e.target.value }
                          setForm({ ...form, timetable_data: next })
                        }} placeholder="09:00" />
                      <input style={{ ...S.input, flex: 1 }} value={item.title}
                        onChange={e => {
                          const next = [...form.timetable_data]
                          next[i] = { ...next[i], title: e.target.value }
                          setForm({ ...form, timetable_data: next })
                        }} placeholder="Session title" />
                      <button type="button" onClick={() => setForm({ ...form, timetable_data: form.timetable_data.filter((_, j) => j !== i) })}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, flexShrink: 0 }}><X size={14} /></button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...S.input, flex: 1, fontSize: 13 }} value={item.description || ''}
                        onChange={e => {
                          const next = [...form.timetable_data]
                          next[i] = { ...next[i], description: e.target.value }
                          setForm({ ...form, timetable_data: next })
                        }} placeholder="Optional description" />
                      <select style={{ ...S.select, maxWidth: 200, fontSize: 13 }} value={item.faculty_id || ''}
                        onChange={e => {
                          const next = [...form.timetable_data]
                          next[i] = { ...next[i], faculty_id: e.target.value }
                          setForm({ ...form, timetable_data: next })
                        }}>
                        <option value="">No faculty</option>
                        {faculty.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setForm({ ...form, timetable_data: [...form.timetable_data, { time: '', title: '', description: '', faculty_id: '' }] })}
                  style={S.dashed}>
                  <Plus size={13} /> Add timetable item
                </button>
              </div>

              {/* Faculty */}
              <div style={S.section}>
                <p style={S.sectionTitle}>COURSE FACULTY</p>
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
                          <select value={af.role}
                            onChange={e => {
                              const updated = [...form.assigned_faculty]
                              updated[i] = { ...updated[i], role: e.target.value }
                              setForm({ ...form, assigned_faculty: updated })
                            }}
                            style={{ padding: '4px 8px', border: '1px solid #D1D1D6', borderRadius: 6, fontSize: 12, color: '#504F58' }}>
                            <option value="Faculty">Faculty</option>
                            <option value="Course Director">Course Director</option>
                            <option value="Chair">Chair</option>
                            <option value="Speaker">Speaker</option>
                            <option value="Panellist">Panellist</option>
                          </select>
                          <button type="button" onClick={() => setEditFacultyId(af.faculty_id)} title="Edit faculty profile"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7C3AED', padding: 4 }}><Pencil size={14} /></button>
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
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#181820', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_revision_course}
                  onChange={e => setForm({ ...form, is_revision_course: e.target.checked })} style={{ width: 18, height: 18 }} />
                This is the revision course
              </label>
              <p style={{ ...S.hint, marginTop: -12 }}>
                Labelling and reporting only — it books exactly like any other course.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#181820', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.waitlist_enabled}
                  onChange={e => setForm({ ...form, waitlist_enabled: e.target.checked })} style={{ width: 18, height: 18 }} />
                Allow a waitlist when full
              </label>
              <p style={{ ...S.hint, marginTop: -12 }}>
                Members join a queue and are promoted automatically, and emailed, when a place frees up.
              </p>
            </div>

            <div className="flex justify-end gap-3 px-4 py-4 sm:px-7 sm:py-4.5 border-t border-[#E4E4E8] bg-[#FAFAFA] rounded-b-[20px]">
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Create Course' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <EditFacultyDialog
        open={!!editFacultyId}
        facultyId={editFacultyId}
        onClose={() => setEditFacultyId(null)}
        onUpdated={(updated) => {
          setFaculty(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f))
          showToast('Faculty profile updated')
        }}
      />
    </div>
  )
}
