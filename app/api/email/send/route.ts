import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import {
  welcomeEmail,
  approvalEmail,
  rejectionEmail,
  bookingConfirmationEmail,
  bookingStatusEmail,
  passwordResetEmail,
  adminNewRegistrationEmail,
} from '@/lib/emails/templates'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

type EmailType = 'welcome' | 'approval' | 'rejection' | 'booking_confirmation' | 'booking_status' | 'password_reset' | 'admin_new_registration'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    // Verify the request is authenticated (either from server or admin)
    const authHeader = request.headers.get('authorization')
    const internalSecret = request.headers.get('x-internal-secret')

    // Allow requests with internal secret (from database webhooks/triggers)
    // or with a valid auth token from an admin user
    if (internalSecret !== process.env.INTERNAL_API_SECRET) {
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'super_admin', 'editor'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { type, to, data } = body as { type: EmailType; to: string; data: Record<string, any> }

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing type or to' }, { status: 400 })
    }

    let email: { subject: string; html: string }

    switch (type) {
      case 'welcome':
        email = welcomeEmail({
          name: data.name || 'Member',
          confirmUrl: data.confirmUrl,
          siteUrl: SITE_URL,
        })
        break

      case 'approval':
        email = approvalEmail({
          name: data.name || 'Member',
          siteUrl: SITE_URL,
        })
        break

      case 'rejection':
        email = rejectionEmail({
          name: data.name || 'Member',
          reason: data.reason,
        })
        break

      case 'booking_confirmation':
        email = bookingConfirmationEmail({
          name: data.name || 'Member',
          eventTitle: data.eventTitle,
          eventDate: data.eventDate,
          eventLocation: data.eventLocation,
          status: data.status || 'pending',
          siteUrl: SITE_URL,
        })
        break

      case 'booking_status':
        email = bookingStatusEmail({
          name: data.name || 'Member',
          eventTitle: data.eventTitle,
          newStatus: data.newStatus,
          siteUrl: SITE_URL,
        })
        break

      case 'password_reset':
        email = passwordResetEmail({
          name: data.name || 'Member',
          resetUrl: data.resetUrl,
        })
        break

      case 'admin_new_registration':
        email = adminNewRegistrationEmail({
          userName: data.userName || 'New User',
          userEmail: data.userEmail || to,
          region: data.region || 'Not specified',
          trainingStage: data.trainingStage || 'Not specified',
          siteUrl: SITE_URL,
        })
        break

      default:
        return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
    }

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: email.subject,
      html: email.html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: sendData?.id })
  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
