'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X, Clock, Users, Loader, Mail, MessageSquare, ChevronDown, AlertCircle, UserCheck, UserX, Search, PoundSterling, BedDouble, Radio, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendEmail } from '@/lib/emails/send-email'
import { isWeekendEvent } from '@/lib/events'

interface DepositRow {
  id: string
  booking_id: string
  amount_pence: number
  status: string
  provider: string
}

interface CourseBookingRow {
  booking_id: string
  status: string
  weekend_courses: { title: string; day: string } | { title: string; day: string }[] | null
}

const DEPOSIT_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  pending:  { bg: '#FEF3C7', fg: '#92400E', label: 'Deposit pending' },
  held:     { bg: '#DBEAFE', fg: '#1E40AF', label: 'Deposit held' },
  paid:     { bg: '#D1FAE5', fg: '#065F46', label: 'Deposit paid' },
  refunded: { bg: '#F3F4F6', fg: '#6B7280', label: 'Deposit refunded' },
  failed:   { bg: '#FEE2E2', fg: '#991B1B', label: 'Deposit failed' },
}

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
  // Weekend-only: the deposit per booking, and which courses each member holds.
  const [payments, setPayments] = useState<Record<string, DepositRow>>({})
  const [courseBookings, setCourseBookings] = useState<Record<string, { title: string; day: string; status: string }[]>>({})
  const [depositBusy, setDepositBusy] = useState(false)

  const showToast = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadWeekendExtras = async (supabase: ReturnType<typeof createClient>) => {
    const [{ data: pays }, { data: cbs }] = await Promise.all([
      supabase.from('event_payments').select('*').eq('event_id', eventId),
      supabase.from('weekend_course_bookings')
        .select('booking_id, status, weekend_courses(title, day)')
        .eq('event_id', eventId).neq('status', 'cancelled'),
    ])

    const payMap: Record<string, DepositRow> = {}
    for (const p of (pays || []) as DepositRow[]) payMap[p.booking_id] = p
    setPayments(payMap)

    const courseMap: Record<string, { title: string; day: string; status: string }[]> = {}
    for (const cb of (cbs || []) as CourseBookingRow[]) {
      const c = Array.isArray(cb.weekend_courses) ? cb.weekend_courses[0] : cb.weekend_courses
      if (!c) continue
      if (!courseMap[cb.booking_id]) courseMap[cb.booking_id] = []
      courseMap[cb.booking_id].push({ title: c.title, day: c.day, status: cb.status })
    }
    setCourseBookings(courseMap)
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
      if (ev && isWeekendEvent(ev.event_type)) await loadWeekendExtras(supabase)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  /**
   * Move deposits through the API rather than writing to event_payments
   * directly: the route asks the payment provider to act first and only then
   * records the transition, and the transition itself is audited. Writing the
   * row here would skip both.
   */
  const transitionDeposits = async (paymentIds: string[], status: string, note?: string) => {
    if (paymentIds.length === 0) return
    setDepositBusy(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/weekend/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ paymentIds, status, note }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Could not update deposits', 'error')
      } else {
        showToast(
          json.failed?.length > 0
            ? `${json.changed} updated, ${json.failed.length} failed`
            : `${json.changed} deposit${json.changed === 1 ? '' : 's'} updated`,
          json.failed?.length > 0 ? 'error' : 'ok'
        )
        await loadWeekendExtras(supabase)
      }
    } catch {
      showToast('Could not reach the server', 'error')
    }
    setDepositBusy(false)
  }

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

      // Send status update email to applicant (non-blocking)
      const booking = bookings.find(b => b.id === bookingId)
      if (booking && event && ['approved', 'rejected', 'waitlisted', 'cancelled'].includes(status)) {
        sendEmail({
          type: 'booking_status',
          to: booking.applicant_email,
          data: {
            name: booking.applicant_name,
            eventTitle: event.title,
            newStatus: status,
          },
        }).catch(err => console.error('Status email failed:', err))
      }
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

  const isWeekend = isWeekendEvent(event?.event_type)

  // Deposits that are still owed money back. Refunds are admin-triggered after
  // the event and a deposit is never forfeited, so a cancelled booking is
  // refundable too.
  const refundable = Object.values(payments).filter(p => p.status !== 'refunded')

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
        <div className="w-full sm:w-auto sm:ml-auto" style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search applicants..."
            style={{ padding: '8px 12px 8px 30px', border: '1.5px solid #D1D1D6', borderRadius: 8, fontSize: 13, width: '100%', outline: 'none', fontFamily: 'Montserrat, sans-serif' }} />
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

      {/* Bulk deposit actions — the usual shape of this job is refunding
          everyone at once once the weekend is over. */}
      {isWeekend && refundable.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#065F46', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PoundSterling size={14} />
            {refundable.length} deposit{refundable.length === 1 ? '' : 's'} not yet refunded
            {' · £'}{(refundable.reduce((sum, p) => sum + p.amount_pence, 0) / 100).toFixed(2)} held
          </span>
          <button
            disabled={depositBusy}
            onClick={() => {
              if (!confirm(`Refund all ${refundable.length} outstanding deposits? Each member will be emailed.`)) return
              transitionDeposits(refundable.map(p => p.id), 'refunded', 'Bulk refund after the event')
            }}
            style={{ ...S.btn('#065F46', '#fff'), opacity: depositBusy ? 0.5 : 1 }}
          >
            {depositBusy ? <Loader className="animate-spin" size={14} /> : <Undo2 size={14} />} Refund All
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
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span>{b.applicant_email}</span>
                      {b.applicant_training_level && <span> · {b.applicant_training_level}</span>}
                      {b.applicant_hospital && <span className="hidden sm:inline"> · {b.applicant_hospital}</span>}
                    </div>
                    {isWeekend && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                        {b.attends_friday && <span style={S.badge('#EFF6FF', '#1D4ED8')}>Fri</span>}
                        {b.attends_saturday && (
                          <span style={S.badge('#EFF6FF', '#1D4ED8')}>
                            Sat{b.saturday_mode === 'stream' ? ' (stream)' : ''}
                          </span>
                        )}
                        {b.attends_sunday && <span style={S.badge('#EFF6FF', '#1D4ED8')}>Sun</span>}
                        {(b.room_friday_requested || b.room_saturday_requested) && (
                          <span style={S.badge('#ECFDF5', '#047857')}>Room</span>
                        )}
                        {payments[b.id] && (
                          <span style={S.badge(
                            DEPOSIT_CONFIG[payments[b.id].status]?.bg || '#F3F4F6',
                            DEPOSIT_CONFIG[payments[b.id].status]?.fg || '#666'
                          )}>
                            {DEPOSIT_CONFIG[payments[b.id].status]?.label || payments[b.id].status}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
                    {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <ChevronDown size={16} color="#999" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #F1F1F3', padding: '16px 18px', background: '#FAFAFA' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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

                    {/* ── Dukes Weekend detail ── */}
                    {isWeekend && (
                      <div style={{ marginBottom: 16, background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 14 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Weekend Booking</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                          <div>
                            <p style={{ fontSize: 11, color: '#999' }}>Attending</p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 2 }}>
                              {[b.attends_friday && 'Friday', b.attends_saturday && 'Saturday', b.attends_sunday && 'Sunday']
                                .filter(Boolean).join(', ') || '—'}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: '#999' }}>Saturday</p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                              {b.saturday_mode === 'stream'
                                ? <><Radio size={12} color="#92400E" /> Streaming</>
                                : b.saturday_mode === 'in_person' ? 'In person' : '—'}
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: '#999' }}>Rooms</p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#333', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                              {b.room_friday_requested || b.room_saturday_requested
                                ? <><BedDouble size={12} color="#047857" />
                                    {[b.room_friday_requested && 'Fri', b.room_saturday_requested && 'Sat'].filter(Boolean).join(' + ')}
                                    {(b.room_friday_allocated || b.room_saturday_allocated) &&
                                      ` · ${[b.room_friday_allocated, b.room_saturday_allocated].filter(Boolean).join(', ')}`}
                                  </>
                                : 'None'}
                            </p>
                          </div>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Courses</p>
                          {(courseBookings[b.id] || []).length === 0 ? (
                            <p style={{ fontSize: 13, color: '#ccc' }}>No course places held</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {(courseBookings[b.id] || []).map((c, i) => (
                                <p key={i} style={{ fontSize: 13, color: '#333' }}>
                                  <span style={{ textTransform: 'capitalize', color: '#888' }}>{c.day}</span> · {c.title}
                                  {c.status === 'waitlisted' && (
                                    <span style={{ ...S.badge('#F3E8FF', '#6B21A8'), marginLeft: 6 }}>Waitlisted</span>
                                  )}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Deposit — one per member for the whole weekend */}
                        {payments[b.id] && (
                          <div style={{ borderTop: '1px solid #F1F1F3', paddingTop: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#181820', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <PoundSterling size={13} />
                                {(payments[b.id].amount_pence / 100).toFixed(2)}
                              </span>
                              <span style={S.badge(
                                DEPOSIT_CONFIG[payments[b.id].status]?.bg || '#F3F4F6',
                                DEPOSIT_CONFIG[payments[b.id].status]?.fg || '#666'
                              )}>
                                {DEPOSIT_CONFIG[payments[b.id].status]?.label || payments[b.id].status}
                              </span>
                              <span style={{ fontSize: 11, color: '#999' }}>via {payments[b.id].provider}</span>

                              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                                {payments[b.id].status !== 'paid' && payments[b.id].status !== 'refunded' && (
                                  <button disabled={depositBusy}
                                    onClick={() => transitionDeposits([payments[b.id].id], 'paid', 'Marked paid by admin')}
                                    style={{ ...S.btn('#065F46', '#fff'), padding: '6px 12px', fontSize: 12, opacity: depositBusy ? 0.5 : 1 }}>
                                    <Check size={12} /> Mark paid
                                  </button>
                                )}
                                {payments[b.id].status !== 'refunded' && (
                                  <button disabled={depositBusy}
                                    onClick={() => transitionDeposits([payments[b.id].id], 'refunded', 'Refunded by admin')}
                                    style={{ ...S.btn('#F3F4F6', '#504F58'), padding: '6px 12px', fontSize: 12, opacity: depositBusy ? 0.5 : 1 }}>
                                    <Undo2 size={12} /> Refund
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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