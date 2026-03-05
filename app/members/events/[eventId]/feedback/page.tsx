'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, Loader, CheckCircle, Award, Download, ArrowLeft, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/use-auth'

// ── Types ────────────────────────────────────────────────────

interface FeedbackQuestion {
  id: string
  type: 'rating' | 'text' | 'multiple_choice' | 'yes_no'
  question: string
  required: boolean
  options?: string[]
}

interface FeedbackForm {
  id: string
  event_id: string
  title: string
  description: string | null
  questions: FeedbackQuestion[]
  certificate_enabled: boolean
  certificate_title: string
  cpd_points: number | null
}

// ── Component ────────────────────────────────────────────────

export default function EventFeedbackPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const { user, profile } = useAuth()

  const [event, setEvent] = useState<any>(null)
  const [form, setForm] = useState<FeedbackForm | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingCertificate, setExistingCertificate] = useState<any>(null)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId || !user) return
    const load = async () => {
      const supabase = createClient()

      // Load event
      const { data: ev } = await supabase
        .from('events')
        .select('id, title, starts_at, location, event_type')
        .eq('id', eventId)
        .single()
      if (ev) setEvent(ev)

      // Load active feedback form
      const { data: fbForm } = await supabase
        .from('event_feedback_forms')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .single()

      if (!fbForm) {
        setError('Feedback is not currently available for this event.')
        setLoading(false)
        return
      }

      // Check date window
      const now = new Date()
      if (fbForm.opens_at && new Date(fbForm.opens_at) > now) {
        setError('Feedback is not yet open for this event.')
        setLoading(false)
        return
      }
      if (fbForm.closes_at && new Date(fbForm.closes_at) < now) {
        setError('Feedback has closed for this event.')
        setLoading(false)
        return
      }

      setForm(fbForm)

      // Check if already submitted
      const { data: existing } = await supabase
        .from('event_feedback_responses')
        .select('id')
        .eq('form_id', fbForm.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        setAlreadySubmitted(true)
        // Check for certificate
        const { data: cert } = await supabase
          .from('event_certificates')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .single()
        if (cert) setExistingCertificate(cert)
      }

      setLoading(false)
    }
    load()
  }, [eventId, user])

  // ── Submit feedback ────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form || !user || !profile) return

    // Validate required questions
    const missing = form.questions
      .filter(q => q.required)
      .filter(q => !answers[q.id] && answers[q.id] !== 0)
    if (missing.length > 0) {
      setError(`Please answer all required questions (${missing.length} remaining)`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // Find the overall rating question (first rating question)
      const overallRatingQ = form.questions.find(q => q.type === 'rating')
      const overallRating = overallRatingQ ? answers[overallRatingQ.id] : null

      // Get the user's booking for this event
      const { data: booking } = await supabase
        .from('event_bookings')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .in('status', ['approved', 'confirmed'])
        .single()

      // Submit feedback response
      const { error: insertErr } = await supabase
        .from('event_feedback_responses')
        .insert({
          form_id: form.id,
          event_id: eventId,
          user_id: user.id,
          booking_id: booking?.id || null,
          answers,
          overall_rating: overallRating,
        })

      if (insertErr) throw insertErr

      // Mark booking feedback as completed
      if (booking) {
        await supabase
          .from('event_bookings')
          .update({ feedback_completed_at: new Date().toISOString() })
          .eq('id', booking.id)
      }

      // Issue certificate if enabled
      if (form.certificate_enabled) {
        const certRes = await fetch('/api/certificates/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            user_id: user.id,
            attendee_name: profile.full_name,
            event_title: event?.title,
            event_date: event?.starts_at?.split('T')[0],
            certificate_title: form.certificate_title,
            cpd_points: form.cpd_points,
          }),
        })
        if (certRes.ok) {
          const cert = await certRes.json()
          setExistingCertificate(cert)
        }
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback')
    }
    setSubmitting(false)
  }

  // ── Rating component ───────────────────────────────────────

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, transition: 'transform 0.1s' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Star size={28} fill={i <= value ? '#E5A718' : 'none'} color={i <= value ? '#E5A718' : '#D1D1D6'} strokeWidth={1.5} />
        </button>
      ))}
      {value > 0 && <span style={{ fontSize: 13, color: '#888', alignSelf: 'center', marginLeft: 4 }}>{value}/5</span>}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="animate-spin" size={28} color="#999" />
      </div>
    )
  }

  // Already submitted — show certificate if available
  if (alreadySubmitted || submitted) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="text-center bg-card border rounded-xl p-10">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            {submitted ? 'Thank You for Your Feedback!' : 'Feedback Already Submitted'}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {submitted
              ? 'Your feedback helps us improve future events.'
              : 'You have already submitted feedback for this event.'}
          </p>

          {existingCertificate && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-6 mb-6">
              <Award size={32} className="text-gold mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-1">
                Your Certificate is Ready
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {existingCertificate.certificate_title}
                {existingCertificate.cpd_points && ` · ${existingCertificate.cpd_points} CPD points`}
              </p>
              <a
                href={`/api/certificates/download?id=${existingCertificate.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-navy text-navy-foreground rounded-lg font-semibold text-sm hover:bg-navy/90 transition-colors"
              >
                <Download size={16} /> Download Certificate (PDF)
              </a>
              <p className="text-xs text-muted-foreground mt-3">
                Verification code: {existingCertificate.verification_code}
              </p>
            </div>
          )}

          <Link
            href="/members"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !form) {
    return (
      <div className="max-w-xl mx-auto py-8 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Link href="/members" className="text-primary text-sm hover:underline">
          <ArrowLeft size={14} className="inline mr-1" /> Back to Dashboard
        </Link>
      </div>
    )
  }

  if (!form) return null

  return (
    <div className="max-w-2xl mx-auto py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/members" className="text-primary text-sm hover:underline inline-flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{form.title}</h1>
        {event && (
          <p className="text-muted-foreground text-sm mt-1">{event.title}</p>
        )}
        {form.description && (
          <p className="text-muted-foreground text-sm mt-2">{form.description}</p>
        )}
        {form.certificate_enabled && (
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-gold-foreground bg-gold/10 px-3 py-1.5 rounded-full border border-gold/30">
            <Award size={14} />
            Complete this form to receive your certificate of attendance
            {form.cpd_points && ` (${form.cpd_points} CPD points)`}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {form.questions.map((q, idx) => (
          <div key={q.id} className="bg-card border rounded-xl p-5">
            <label className="block text-sm font-semibold text-foreground mb-3">
              {idx + 1}. {q.question}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* Rating */}
            {q.type === 'rating' && (
              <StarRating
                value={answers[q.id] || 0}
                onChange={v => setAnswers({ ...answers, [q.id]: v })}
              />
            )}

            {/* Text */}
            {q.type === 'text' && (
              <textarea
                className="w-full p-3 border rounded-lg text-sm resize-y min-h-[80px] bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={answers[q.id] || ''}
                onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                placeholder="Type your answer..."
              />
            )}

            {/* Multiple choice */}
            {q.type === 'multiple_choice' && q.options && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Yes / No */}
            {q.type === 'yes_no' && (
              <div className="flex gap-3">
                {['Yes', 'No'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      answers[q.id] === opt
                        ? opt === 'Yes'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                        : 'border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-8 py-3 bg-navy text-navy-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ background: '#0F1F3D', color: '#F5F8FC' }}
        >
          {submitting ? <Loader className="animate-spin" size={16} /> : <Send size={16} />}
          Submit Feedback
        </button>
      </div>
    </div>
  )
}