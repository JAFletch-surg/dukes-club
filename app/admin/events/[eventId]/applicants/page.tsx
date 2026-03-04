'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X, Clock, Users, Loader, Mail, MessageSquare, ChevronDown, AlertCircle, UserCheck, UserX, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const STATUS_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  approved: { bg: '#D1FAE5', fg: '#065F46', label: 'Approved' },
  confirmed: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Confirmed' },
  rejected: { bg: '#FEE2E2', fg: '#991B1B', label: 'Rejected' },
  cancelled: { bg: '#F3F4F6', fg: '#6B7280', label: 'Cancelled' },
  waitlisted: { bg: '#F3E8FF', fg: '#6B21A8', label: 'Waitlisted' },
}

const S = {
  badge: (bg: string, fg: string) => ({
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
    borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color: fg,
    fontFamily: 'Montserrat, sans-serif',
  } as React.CSSProperties),
  btn: (bg: string, fg: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: bg, color: fg, cursor: 'pointer',
    fontFamily: 'Montserrat, sans-serif', transition: 'opacity 0.15s',
  } as React.CSSProperties),
}

export default function ApplicantsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!eventId) return
    const load = async () => {
      const supabase = createClient()
      const [{ data: ev }, { data: bks }] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_bookings').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
      ])
      if (ev) setEvent(ev)
      if (bks) setBookings(bks)
      setLoading(false)
    }
    load()
  }, [eventId])

  const updateStatus = async (bookingId: string, status: string) => {
    setUpdating(bookingId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('event_bookings')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          ...(status === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
        })
        .eq('id', bookingId)

      if (error) throw error
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status, reviewed_at: new Date().toISOString() } : b))
      showToast(`Application ${status}`)
    } catch (e: any) {
      showToast(e.message || 'Failed to update', 'error')
    }
    setUpdating(null)
  }

  const filtered = bookings.filter(b => {
    if (filter !== 'all' && b.status !== filter) return false
    if (searchQ) {
      const q = searchQ.toLowerCase()
      return b.applicant_name?.toLowerCase().includes(q) || b.applicant_email?.toLowerCase().includes(q) || b.applicant_hospital?.toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    rejected: bookings.filter(b => b.status === 'rejected').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    waitlisted: bookings.filter(b => b.status === 'waitlisted').length,
  }

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
        <Link href="/admin/events" style={{ color: '#2563EB', fontSize: 14, marginTop: 12, display: 'inline-block' }}>← Back to events</Link>
      </div>
    )
  }

  const placesUsed = bookings.filter(b => ['approved', 'confirmed'].includes(b.status)).length
  const placesTotal = event.places_available || event.capacity || 0

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', maxWidth: 1000, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 20px', borderRadius: 10, background: toast.type === 'ok' ? '#065F46' : '#991B1B', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/admin/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563EB', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Events
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1F3D', marginBottom: 4 }}>
          Applicants — {event.title}
        </h1>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#504F58' }}>
            <Users size={15} />
            <strong>{placesUsed}</strong> / {placesTotal || '∞'} places filled
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#504F58' }}>
            <Clock size={15} />
            <strong>{counts.pending}</strong> pending review
          </div>
          {event.application_deadline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: new Date(event.application_deadline) < new Date() ? '#DC2626' : '#504F58' }}>
              <AlertCircle size={15} />
              Deadline: {new Date(event.application_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        {(['all', 'pending', 'approved', 'rejected', 'cancelled', 'waitlisted'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: filter === f ? '1.5px solid #2563EB' : '1.5px solid #D1D1D6',
              background: filter === f ? '#EFF6FF' : '#fff', color: filter === f ? '#2563EB' : '#504F58',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label} ({counts[f] || 0})
          </button>
        ))}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search applicants..."
            style={{ padding: '8px 12px 8px 30px', border: '1.5px solid #D1D1D6', borderRadius: 8, fontSize: 13, width: 220, outline: 'none', fontFamily: 'Montserrat, sans-serif' }} />
        </div>
      </div>

      {/* Bulk actions for pending */}
      {filter === 'pending' && counts.pending > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, padding: '12px 16px', background: '#FEF3C7', borderRadius: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} /> {counts.pending} applications waiting for review
          </span>
          <button onClick={async () => {
            const pending = bookings.filter(b => b.status === 'pending')
            for (const b of pending) await updateStatus(b.id, 'approved')
          }} style={S.btn('#065F46', '#fff')}>
            <UserCheck size={14} /> Approve All
          </button>
        </div>
      )}

      {/* Applicants list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Users size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p style={{ fontSize: 14 }}>{searchQ ? 'No matching applicants' : 'No applications yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(b => {
            const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending
            const isExpanded = expandedId === b.id
            const answers = b.answers || {}
            const questions = event.application_questions || []

            return (
              <div key={b.id} style={{ border: '1.5px solid #E4E4E8', borderRadius: 12, background: '#fff', overflow: 'hidden', transition: 'box-shadow 0.15s', boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.06)' : 'none' }}>
                {/* Summary row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#504F58' }}>
                    {b.applicant_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#181820' }}>{b.applicant_name}</span>
                      <span style={S.badge(sc.bg, sc.fg)}>{sc.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888', marginTop: 2 }}>
                      <span>{b.applicant_email}</span>
                      {b.applicant_training_level && <span>· {b.applicant_training_level}</span>}
                      {b.applicant_hospital && <span>· {b.applicant_hospital}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
                    {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <ChevronDown size={16} color="#999" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #F1F1F3', padding: '16px 18px', background: '#FAFAFA' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Training Level</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 2 }}>{b.applicant_training_level || '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Hospital</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 2 }}>{b.applicant_hospital || '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Deanery</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 2 }}>{b.applicant_deanery || '—'}</p>
                      </div>
                    </div>

                    {b.motivation && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Motivation</p>
                        <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #eee' }}>{b.motivation}</p>
                      </div>
                    )}

                    {questions.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Application Answers</p>
                        {questions.map((q: any, i: number) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#504F58' }}>{q.question}</p>
                            <p style={{ fontSize: 13, color: '#333', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #eee', marginTop: 4 }}>{answers[`q${i}`] || <em style={{ color: '#ccc' }}>No answer</em>}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Admin notes */}
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Admin Notes</p>
                      <textarea
                        defaultValue={b.admin_notes || ''}
                        onBlur={async (e) => {
                          const supabase = createClient()
                          await supabase.from('event_bookings').update({ admin_notes: e.target.value }).eq('id', b.id)
                        }}
                        placeholder="Internal notes about this applicant..."
                        style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #D1D1D6', borderRadius: 8, fontSize: 13, fontFamily: 'Montserrat, sans-serif', minHeight: 50, resize: 'vertical', outline: 'none' }}
                      />
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {b.status === 'pending' && (
                        <>
                          <button disabled={updating === b.id} onClick={() => updateStatus(b.id, 'approved')} style={{ ...S.btn('#065F46', '#fff'), opacity: updating === b.id ? 0.5 : 1 }}>
                            <UserCheck size={14} /> Approve
                          </button>
                          <button disabled={updating === b.id} onClick={() => updateStatus(b.id, 'rejected')} style={{ ...S.btn('#991B1B', '#fff'), opacity: updating === b.id ? 0.5 : 1 }}>
                            <UserX size={14} /> Reject
                          </button>
                          <button disabled={updating === b.id} onClick={() => updateStatus(b.id, 'waitlisted')} style={{ ...S.btn('#6B21A8', '#fff'), opacity: updating === b.id ? 0.5 : 1 }}>
                            <Clock size={14} /> Waitlist
                          </button>
                        </>
                      )}
                      {b.status === 'approved' && (
                        <button disabled={updating === b.id} onClick={() => updateStatus(b.id, 'rejected')} style={{ ...S.btn('#991B1B', '#fff'), opacity: updating === b.id ? 0.5 : 1 }}>
                          <UserX size={14} /> Revoke Approval
                        </button>
                      )}
                      {b.status === 'waitlisted' && (
                        <button disabled={updating === b.id} onClick={() => updateStatus(b.id, 'approved')} style={{ ...S.btn('#065F46', '#fff'), opacity: updating === b.id ? 0.5 : 1 }}>
                          <UserCheck size={14} /> Approve from Waitlist
                        </button>
                      )}
                      {b.status === 'rejected' && (
                        <button disabled={updating === b.id} onClick={() => updateStatus(b.id, 'approved')} style={{ ...S.btn('#065F46', '#fff'), opacity: updating === b.id ? 0.5 : 1 }}>
                          <UserCheck size={14} /> Approve Instead
                        </button>
                      )}
                      <a href={`mailto:${b.applicant_email}`} style={{ ...S.btn('#EFF6FF', '#1E40AF'), textDecoration: 'none' }}>
                        <Mail size={14} /> Email
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}