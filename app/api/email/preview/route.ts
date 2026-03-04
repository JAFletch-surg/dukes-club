import { NextRequest, NextResponse } from 'next/server'
import {
  welcomeEmail,
  approvalEmail,
  rejectionEmail,
  bookingConfirmationEmail,
  bookingStatusEmail,
  passwordResetEmail,
} from '@/lib/emails/templates'

// GET /api/email/preview?template=welcome
// Dev-only route to preview email templates in the browser
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const template = request.nextUrl.searchParams.get('template') || 'welcome'
  const siteUrl = 'http://localhost:3000'

  const templates: Record<string, { subject: string; html: string }> = {
    welcome: welcomeEmail({
      name: 'Jordan Fletcher',
      confirmUrl: `${siteUrl}/auth/confirm?token=abc123`,
      siteUrl,
    }),
    approval: approvalEmail({
      name: 'Jordan Fletcher',
      siteUrl,
    }),
    rejection: rejectionEmail({
      name: 'Jordan Fletcher',
      reason: 'We were unable to verify your NHS email address. Please re-register with your official NHS or academic email.',
    }),
    booking_confirmation: bookingConfirmationEmail({
      name: 'Jordan Fletcher',
      eventTitle: 'Laparoscopic Skills Masterclass',
      eventDate: '20 March 2026',
      eventLocation: 'Birmingham QE Hospital',
      status: 'pending',
      siteUrl,
    }),
    booking_approved: bookingStatusEmail({
      name: 'Jordan Fletcher',
      eventTitle: 'Laparoscopic Skills Masterclass',
      newStatus: 'approved',
      siteUrl,
    }),
    booking_rejected: bookingStatusEmail({
      name: 'Jordan Fletcher',
      eventTitle: 'Annual Weekend 2026',
      newStatus: 'rejected',
      siteUrl,
    }),
    booking_waitlisted: bookingStatusEmail({
      name: 'Jordan Fletcher',
      eventTitle: 'Annual Weekend 2026',
      newStatus: 'waitlisted',
      siteUrl,
    }),
    password_reset: passwordResetEmail({
      name: 'Jordan Fletcher',
      resetUrl: `${siteUrl}/reset-password?token=xyz789`,
    }),
  }

  const email = templates[template]

  if (!email) {
    const available = Object.keys(templates).join(', ')
    return NextResponse.json({ error: `Unknown template. Available: ${available}` }, { status: 400 })
  }

  // Return the HTML directly for browser preview
  return new NextResponse(email.html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
