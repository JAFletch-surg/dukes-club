import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for inserting certificates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, user_id, attendee_name, event_title, event_date, certificate_title, cpd_points } = body

    if (!event_id || !user_id || !attendee_name || !event_title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if certificate already exists
    const { data: existing } = await supabase
      .from('event_certificates')
      .select('*')
      .eq('event_id', event_id)
      .eq('user_id', user_id)
      .single()

    if (existing) {
      return NextResponse.json(existing)
    }

    // Verify feedback was submitted
    const { data: feedback } = await supabase
      .from('event_feedback_responses')
      .select('id')
      .eq('event_id', event_id)
      .eq('user_id', user_id)
      .single()

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback must be submitted before certificate issuance' }, { status: 403 })
    }

    // Issue certificate
    const { data: cert, error } = await supabase
      .from('event_certificates')
      .insert({
        event_id,
        user_id,
        feedback_id: feedback.id,
        attendee_name,
        event_title,
        event_date: event_date || new Date().toISOString().split('T')[0],
        certificate_title: certificate_title || 'Certificate of Attendance',
        cpd_points: cpd_points || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(cert)
  } catch (err: any) {
    console.error('Certificate issue error:', err)
    return NextResponse.json({ error: err.message || 'Failed to issue certificate' }, { status: 500 })
  }
}