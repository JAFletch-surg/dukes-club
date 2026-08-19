import { createClient } from '@/lib/supabase/client'

// Event types that stream online (Zoom / Vimeo Live), as opposed to in-person events.
export const STREAMING_EVENT_TYPES = ['Webinar', 'Online Lecture', 'Hybrid'] as const

export function isStreamingEvent(eventType: string | null | undefined): boolean {
  return !!eventType && (STREAMING_EVENT_TYPES as readonly string[]).includes(eventType)
}

// A native webinar runs on this site via LiveKit (see lib/webinars.ts) rather
// than linking out to Zoom or embedding a Vimeo Live event.
export { WEBINAR_STREAM_TYPE, isNativeWebinar } from '@/lib/webinars'

interface RegisterForEventParams {
  eventId: string
  userId: string
  status: string
  applicantName: string
  applicantEmail: string
  applicantTrainingLevel: string
  applicantHospital: string
  applicantDeanery: string
  motivation?: string
  answers?: Record<string, string>
}

// Registers a user for an event, reusing their existing event_bookings row
// (e.g. after they previously cancelled) instead of inserting a second row
// for the same (event_id, user_id) pair, which would hit the unique
// constraint that backs the "already applied" duplicate check.
export async function registerForEvent(
  supabase: ReturnType<typeof createClient>,
  params: RegisterForEventParams
): Promise<{ booking: { id: string; status: string } | null; error: any }> {
  const { eventId, userId, status, applicantName, applicantEmail, applicantTrainingLevel, applicantHospital, applicantDeanery, motivation, answers } = params

  const { data: existing } = await supabase
    .from('event_bookings')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  const fields = {
    applicant_name: applicantName,
    applicant_email: applicantEmail,
    applicant_training_level: applicantTrainingLevel,
    applicant_hospital: applicantHospital,
    applicant_deanery: applicantDeanery,
    motivation: motivation ?? null,
    answers: answers ?? null,
    status,
    cancelled_at: null,
    reviewed_at: null,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('event_bookings')
      .update(fields)
      .eq('id', existing.id)
      .select('id, status')
      .single()
    return { booking: data, error }
  }

  const { data, error } = await supabase
    .from('event_bookings')
    .insert({ event_id: eventId, user_id: userId, ...fields })
    .select('id, status')
    .single()
  return { booking: data, error }
}
