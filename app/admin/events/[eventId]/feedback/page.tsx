'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Save, Loader, GripVertical, Star, BarChart3,
  MessageSquare, CheckCircle, Award, Send, Download, ToggleLeft, ToggleRight, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendEmail } from '@/lib/emails/send-email'

// ── Types ────────────────────────────────────────────────────

type QuestionType = 'rating' | 'text' | 'multiple_choice' | 'yes_no'

interface FeedbackQuestion {
  id: string
  type: QuestionType
  question: string
  required: boolean
  options?: string[]
}

interface FeedbackForm {
  id?: string
  event_id: string
  title: string
  description: string
  questions: FeedbackQuestion[]
  is_active: boolean
  opens_at: string
  closes_at: string
  certificate_enabled: boolean
  certificate_title: string
  cpd_points: string
}

interface FeedbackResponse {
  id: string
  user_id: string
  answers: Record<string, any>
  overall_rating: number | null
  submitted_at: string
  profiles?: { full_name: string; email: string }
}

// ── Styles ───────────────────────────────────────────────────

const S = {
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  btnOutline: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'none', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#504F58', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  section: { background: '#F8FAFC', padding: 20, borderRadius: 12, border: '1px solid #E4E4E8', marginBottom: 20 } as React.CSSProperties,
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#0F1F3D', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 14 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color: fg }) as React.CSSProperties,
  card: { background: '#fff', border: '1.5px solid #E4E4E8', borderRadius: 12, padding: 16, marginBottom: 10 } as React.CSSProperties,
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: 'rating', label: 'Star Rating (1–5)', icon: '⭐' },
  { value: 'text', label: 'Free Text', icon: '✏️' },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: '☑️' },
  { value: 'yes_no', label: 'Yes / No', icon: '✅' },
]

const DEFAULT_QUESTIONS: FeedbackQuestion[] = [
  { id: 'q_overall', type: 'rating', question: 'How would you rate this event overall?', required: true },
  { id: 'q_content', type: 'rating', question: 'How would you rate the quality of the content?', required: true },
  { id: 'q_faculty', type: 'rating', question: 'How would you rate the quality of the faculty/speakers?', required: true },
  { id: 'q_relevance', type: 'rating', question: 'How relevant was the event to your training?', required: true },
  { id: 'q_recommend', type: 'yes_no', question: 'Would you recommend this event to a colleague?', required: true },
  { id: 'q_best', type: 'text', question: 'What was the best aspect of the event?', required: false },
  { id: 'q_improve', type: 'text', question: 'What could be improved?', required: false },
]

let questionCounter = 100

function generateId() {
  questionCounter++
  return `q_${Date.now()}_${questionCounter}`
}

// ── Main Component ───────────────────────────────────────────

export default function EventFeedbackAdmin() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [tab, setTab] = useState<'builder' | 'responses' | 'certificates'>('builder')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null)

  const [form, setForm] = useState<FeedbackForm>({
    event_id: eventId || '',
    title: 'Event Feedback',
    description: '',
    questions: DEFAULT_QUESTIONS,
    is_active: false,
    opens_at: '',
    closes_at: '',
    certificate_enabled: false,
    certificate_title: 'Certificate of Attendance',
    cpd_points: '',
  })

  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])

  const showToast = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load data ──────────────────────────────────────────────

  useEffect(() => {
    if (!eventId) return
    const load = async () => {
      const supabase = createClient()

      // Load event
      const { data: ev } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      if (ev) setEvent(ev)

      // Load existing feedback form
      const { data: existingForm } = await supabase
        .from('event_feedback_forms')
        .select('*')
        .eq('event_id', eventId)
        .single()

      if (existingForm) {
        setForm({
          ...existingForm,
          opens_at: existingForm.opens_at?.slice(0, 16) || '',
          closes_at: existingForm.closes_at?.slice(0, 16) || '',
          cpd_points: existingForm.cpd_points?.toString() || '',
          questions: existingForm.questions || DEFAULT_QUESTIONS,
        })
      }

      // Load responses (separate query for profiles to avoid FK join dependency)
      const { data: resps, error: respsErr } = await supabase
        .from('event_feedback_responses')
        .select('*')
        .eq('event_id', eventId)
        .order('submitted_at', { ascending: false })
      if (respsErr) console.error('[Feedback] Failed to load responses:', respsErr.message)

      if (resps && resps.length > 0) {
        const userIds = [...new Set(resps.map((r: any) => r.user_id))]
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds)
        const profileMap = new Map((profs || []).map((p: any) => [p.id, p]))
        setResponses(resps.map((r: any) => ({
          ...r,
          profiles: profileMap.get(r.user_id) || null,
        })))
      } else if (resps) {
        setResponses(resps)
      }

      // Load certificates
      const { data: certs } = await supabase
        .from('event_certificates')
        .select('*')
        .eq('event_id', eventId)
        .order('issued_at', { ascending: false })
      if (certs) setCertificates(certs)

      // Load bookings (for sending reminders)
      const { data: bks } = await supabase
        .from('event_bookings')
        .select('id, user_id, applicant_name, applicant_email, status, feedback_requested_at, feedback_completed_at')
        .eq('event_id', eventId)
        .in('status', ['approved', 'confirmed'])
      if (bks) setBookings(bks)

      setLoading(false)
    }
    load()
  }, [eventId])

  // ── Save form ──────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        event_id: eventId,
        title: form.title,
        description: form.description || null,
        questions: form.questions,
        is_active: form.is_active,
        opens_at: form.opens_at ? new Date(form.opens_at).toISOString() : null,
        closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : null,
        certificate_enabled: form.certificate_enabled,
        certificate_title: form.certificate_title || 'Certificate of Attendance',
        cpd_points: form.cpd_points ? parseFloat(form.cpd_points) : null,
      }

      if (form.id) {
        await supabase.from('event_feedback_forms').update(payload).eq('id', form.id)
      } else {
        const { data } = await supabase.from('event_feedback_forms').insert(payload).select().single()
        if (data) setForm(prev => ({ ...prev, id: data.id }))
      }
      showToast('Feedback form saved')
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error')
    }
    setSaving(false)
  }

  // ── Send feedback reminders ────────────────────────────────

  const handleSendReminders = async () => {
    const unrequested = bookings.filter(b => !b.feedback_completed_at)
    if (unrequested.length === 0) {
      showToast('All attendees have already been notified or completed feedback', 'error')
      return
    }
    if (!confirm(`Send feedback request emails to ${unrequested.length} attendees?`)) return

    setSendingReminders(true)
    const supabase = createClient()

    for (const booking of unrequested) {
      await sendEmail({
        type: 'feedback_request',
        to: booking.applicant_email,
        data: {
          name: booking.applicant_name,
          eventTitle: event?.title,
          eventId: eventId,
        },
      }).catch(err => console.error('Feedback email failed:', err))

      await supabase
        .from('event_bookings')
        .update({ feedback_requested_at: new Date().toISOString() })
        .eq('id', booking.id)
    }

    setBookings(prev => prev.map(b => ({ ...b, feedback_requested_at: new Date().toISOString() })))
    showToast(`Sent ${unrequested.length} feedback request emails`)
    setSendingReminders(false)
  }

  // ── Question management ────────────────────────────────────

  const addQuestion = (type: QuestionType) => {
    const newQ: FeedbackQuestion = {
      id: generateId(),
      type,
      question: '',
      required: false,
      ...(type === 'multiple_choice' ? { options: ['Option 1', 'Option 2'] } : {}),
    }
    setForm(prev => ({ ...prev, questions: [...prev.questions, newQ] }))
  }

  const updateQuestion = (idx: number, updates: Partial<FeedbackQuestion>) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, ...updates } : q),
    }))
  }

  const removeQuestion = (idx: number) => {
    setForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }))
  }

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= form.questions.length) return
    const qs = [...form.questions]
    ;[qs[idx], qs[newIdx]] = [qs[newIdx], qs[idx]]
    setForm(prev => ({ ...prev, questions: qs }))
  }

  // ── Aggregate stats ────────────────────────────────────────

  const getAggregateStats = () => {
    if (responses.length === 0) return null
    const ratingQuestions = form.questions.filter(q => q.type === 'rating')
    const stats: Record<string, { avg: number; count: number }> = {}

    for (const q of ratingQuestions) {
      const values = responses.map(r => r.answers[q.id]).filter(v => typeof v === 'number')
      if (values.length > 0) {
        stats[q.id] = {
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
          count: values.length,
        }
      }
    }
    return stats
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Loader className="animate-spin" size={28} color="#999" />
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#999', fontSize: 14 }}>Event not found</p>
        <Link href="/admin/events" style={{ color: '#2563EB', fontSize: 14 }}>← Back to events</Link>
      </div>
    )
  }

  const stats = getAggregateStats()
  const feedbackRate = bookings.length > 0
    ? Math.round((responses.length / bookings.length) * 100)
    : 0

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', maxWidth: 960, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 20px',
          borderRadius: 10, background: toast.type === 'ok' ? '#065F46' : '#991B1B',
          color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563EB', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Events
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1F3D', marginBottom: 4 }}>
          Feedback &amp; Certificates
        </h1>
        <p style={{ fontSize: 14, color: '#504F58' }}>{event.title}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Attendees', value: bookings.length, color: '#2563EB' },
          { label: 'Responses', value: responses.length, color: '#059669' },
          { label: 'Response Rate', value: `${feedbackRate}%`, color: '#D97706' },
          { label: 'Avg Rating', value: stats?.q_overall?.avg || '–', color: '#7C3AED' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1.5px solid #E4E4E8', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto" style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E4E4E8', marginBottom: 24 }}>
        {[
          { key: 'builder' as const, label: 'Form Builder', icon: MessageSquare },
          { key: 'responses' as const, label: `Responses (${responses.length})`, icon: BarChart3 },
          { key: 'certificates' as const, label: `Certificates (${certificates.length})`, icon: Award },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px',
              border: 'none', borderBottom: tab === t.key ? '2px solid #0F1F3D' : '2px solid transparent',
              background: 'none', fontSize: 14, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#0F1F3D' : '#888', cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif', marginBottom: -2,
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Form Builder ────────────────────────────── */}
      {tab === 'builder' && (
        <div>
          {/* Form settings */}
          <div style={S.section}>
            <p style={S.sectionTitle}>Form Settings</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label style={S.label}>Form Title</label>
                <input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Description <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                <input style={S.input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief instructions for attendees" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label style={S.label}>Opens At <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                <input type="datetime-local" style={S.input} value={form.opens_at} onChange={e => setForm({ ...form, opens_at: e.target.value })} />
                <p style={S.hint}>Leave empty to open immediately when activated</p>
              </div>
              <div>
                <label style={S.label}>Closes At <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                <input type="datetime-local" style={S.input} value={form.closes_at} onChange={e => setForm({ ...form, closes_at: e.target.value })} />
                <p style={S.hint}>Leave empty to keep open indefinitely</p>
              </div>
            </div>

            <button
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                border: `2px solid ${form.is_active ? '#059669' : '#D1D1D6'}`,
                borderRadius: 10, background: form.is_active ? '#ECFDF5' : '#fff',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                color: form.is_active ? '#065F46' : '#504F58',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {form.is_active ? <ToggleRight size={20} color="#059669" /> : <ToggleLeft size={20} color="#999" />}
              {form.is_active ? 'Form is LIVE — accepting responses' : 'Form is INACTIVE — not visible to members'}
            </button>
          </div>

          {/* Certificate settings */}
          <div style={S.section}>
            <p style={S.sectionTitle}>Certificate Configuration</p>

            <button
              onClick={() => setForm({ ...form, certificate_enabled: !form.certificate_enabled })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                border: `2px solid ${form.certificate_enabled ? '#7C3AED' : '#D1D1D6'}`,
                borderRadius: 10, background: form.certificate_enabled ? '#F5F3FF' : '#fff',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                color: form.certificate_enabled ? '#6B21A8' : '#504F58',
                fontFamily: 'Montserrat, sans-serif', marginBottom: 16,
              }}
            >
              <Award size={20} color={form.certificate_enabled ? '#7C3AED' : '#999'} />
              {form.certificate_enabled ? 'Certificate ENABLED — issued on feedback completion' : 'Certificate DISABLED'}
            </button>

            {form.certificate_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={S.label}>Certificate Title</label>
                  <input style={S.input} value={form.certificate_title} onChange={e => setForm({ ...form, certificate_title: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>CPD Points <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                  <input type="number" step="0.5" min="0" style={S.input} value={form.cpd_points} onChange={e => setForm({ ...form, cpd_points: e.target.value })} placeholder="e.g. 6" />
                  <p style={S.hint}>Displayed on the certificate if set</p>
                </div>
              </div>
            )}
          </div>

          {/* Questions */}
          <div style={S.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={S.sectionTitle}>Questions ({form.questions.length})</p>
              <button
                onClick={() => setForm({ ...form, questions: DEFAULT_QUESTIONS })}
                style={{ ...S.btnOutline, fontSize: 11 }}
              >
                Reset to defaults
              </button>
            </div>

            {form.questions.map((q, idx) => (
              <div key={q.id} style={S.card}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {/* Drag handle / reorder */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8 }}>
                    <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}
                      style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 0.6, fontSize: 11, padding: 0 }}>▲</button>
                    <button onClick={() => moveQuestion(idx, 1)} disabled={idx === form.questions.length - 1}
                      style={{ border: 'none', background: 'none', cursor: idx === form.questions.length - 1 ? 'default' : 'pointer', opacity: idx === form.questions.length - 1 ? 0.2 : 0.6, fontSize: 11, padding: 0 }}>▼</button>
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Question text */}
                    <input
                      style={{ ...S.input, fontWeight: 600, marginBottom: 8 }}
                      value={q.question}
                      onChange={e => updateQuestion(idx, { question: e.target.value })}
                      placeholder="Enter question text..."
                    />

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Type selector */}
                      <select
                        value={q.type}
                        onChange={e => {
                          const newType = e.target.value as QuestionType
                          updateQuestion(idx, {
                            type: newType,
                            ...(newType === 'multiple_choice' && !q.options ? { options: ['Option 1', 'Option 2'] } : {}),
                          })
                        }}
                        style={{ ...S.input, width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      >
                        {QUESTION_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                      </select>

                      {/* Required toggle */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', cursor: 'pointer' }}>
                        <input type="checkbox" checked={q.required} onChange={e => updateQuestion(idx, { required: e.target.checked })} />
                        Required
                      </label>
                    </div>

                    {/* Multiple choice options */}
                    {q.type === 'multiple_choice' && q.options && (
                      <div style={{ marginTop: 10 }}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: '#999', width: 20 }}>○</span>
                            <input
                              style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 13 }}
                              value={opt}
                              onChange={e => {
                                const newOpts = [...(q.options || [])]
                                newOpts[oi] = e.target.value
                                updateQuestion(idx, { options: newOpts })
                              }}
                            />
                            <button onClick={() => updateQuestion(idx, { options: q.options?.filter((_, j) => j !== oi) })}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 2 }}><X size={12} /></button>
                          </div>
                        ))}
                        <button
                          onClick={() => updateQuestion(idx, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] })}
                          style={{ fontSize: 12, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginTop: 4 }}
                        >
                          + Add option
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete question */}
                  <button onClick={() => removeQuestion(idx)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4, flexShrink: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add question buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {QUESTION_TYPES.map(t => (
                <button key={t.value} onClick={() => addQuestion(t.value)} style={S.btnOutline}>
                  <Plus size={14} /> {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save + Send Reminders */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between mt-5">
            <button onClick={handleSendReminders} disabled={sendingReminders || bookings.length === 0} style={{ ...S.btnOutline, opacity: bookings.length === 0 ? 0.4 : 1 }}>
              {sendingReminders ? <Loader className="animate-spin" size={14} /> : <Send size={14} />}
              Send Feedback Requests ({bookings.filter(b => !b.feedback_completed_at).length} pending)
            </button>
            <button onClick={handleSave} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>
              {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
              Save Form
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Responses ───────────────────────────────── */}
      {tab === 'responses' && (
        <div>
          {/* Aggregate ratings */}
          {stats && (
            <div style={S.section}>
              <p style={S.sectionTitle}>Rating Breakdown</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {form.questions.filter(q => q.type === 'rating').map(q => {
                  const s = stats[q.id]
                  if (!s) return null
                  return (
                    <div key={q.id} style={{ background: '#fff', border: '1px solid #E4E4E8', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                      <p style={{ fontSize: 32, fontWeight: 800, color: '#E5A718' }}>{s.avg}</p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2, margin: '4px 0' }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={14} fill={i <= Math.round(s.avg) ? '#E5A718' : 'none'} color={i <= Math.round(s.avg) ? '#E5A718' : '#D1D1D6'} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{q.question}</p>
                      <p style={{ fontSize: 10, color: '#999' }}>{s.count} responses</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Individual responses */}
          {responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 14 }}>No feedback responses yet</p>
            </div>
          ) : (
            <div>
              {responses.map(r => (
                <div key={r.id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#181820' }}>
                        {(r.profiles as any)?.full_name || 'Anonymous'}
                      </p>
                      <p style={{ fontSize: 12, color: '#888' }}>
                        {(r.profiles as any)?.email} · {new Date(r.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {r.overall_rating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} size={14} fill={i <= r.overall_rating! ? '#E5A718' : 'none'} color={i <= r.overall_rating! ? '#E5A718' : '#D1D1D6'} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {form.questions.map(q => {
                      const answer = r.answers[q.id]
                      if (answer === undefined || answer === null || answer === '') return null
                      return (
                        <div key={q.id}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 2 }}>{q.question}</p>
                          {q.type === 'rating' ? (
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} size={12} fill={i <= answer ? '#E5A718' : 'none'} color={i <= answer ? '#E5A718' : '#D1D1D6'} />
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: '#333' }}>{String(answer)}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Certificates ────────────────────────────── */}
      {tab === 'certificates' && (
        <div>
          {!form.certificate_enabled ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              <Award size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 14 }}>Certificates are not enabled for this event</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Enable them in the Form Builder tab</p>
            </div>
          ) : certificates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              <Award size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: 14 }}>No certificates issued yet</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Certificates are issued automatically when attendees complete feedback</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                {certificates.length} certificate{certificates.length !== 1 ? 's' : ''} issued
              </p>
              {certificates.map(cert => (
                <div key={cert.id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#181820' }}>{cert.attendee_name}</p>
                      <p style={{ fontSize: 12, color: '#888' }}>
                        Issued: {new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {cert.cpd_points && ` · ${cert.cpd_points} CPD points`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...S.badge('#F3E8FF', '#6B21A8') }}>
                        {cert.verification_code}
                      </span>
                      {cert.downloaded_at && (
                        <span style={{ ...S.badge('#D1FAE5', '#065F46') }}>
                          <Download size={10} style={{ marginRight: 4 }} /> Downloaded
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}