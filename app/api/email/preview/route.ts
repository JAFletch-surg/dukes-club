import { NextRequest, NextResponse } from 'next/server'
import {
  welcomeEmail,
  approvalEmail,
  rejectionEmail,
  bookingConfirmationEmail,
  bookingStatusEmail,
  passwordResetEmail,
} from '@/lib/emails/templates'
import { digestEmail } from '@/lib/emails/digest-template'

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
    // Fixture-backed so the layout can be worked on without a populated
    // database. /admin/digest previews the same template against live content.
    digest: digestEmail({
      name: 'Jordan Fletcher',
      frequency: 'weekly',
      siteUrl,
      manageUrl: `${siteUrl}/email-preferences?token=sample`,
      unsubscribeUrl: `${siteUrl}/email-preferences?token=sample&unsubscribe=1`,
      events: [
        {
          id: '1',
          title: 'Laparoscopic Skills Masterclass',
          slug: 'laparoscopic-skills-masterclass',
          startsAt: '2026-03-20T09:00:00Z',
          endsAt: '2026-03-20T17:00:00Z',
          location: 'Queen Elizabeth Hospital, Birmingham',
          eventType: 'Practical Workshop',
          imageUrl: null,
          summary: 'A full day of hands-on box and simulator work with consultant faculty.',
          isNew: true,
        },
        {
          id: '2',
          title: 'Rectal Cancer MDT: the difficult cases',
          slug: 'rectal-cancer-mdt-webinar',
          startsAt: '2026-04-08T18:30:00Z',
          endsAt: null,
          location: 'Online',
          eventType: 'Webinar',
          imageUrl: null,
          summary: null,
          isNew: false,
        },
        {
          id: '3',
          title: 'Dukes\' Club Annual Weekend 2026',
          slug: 'annual-weekend-2026',
          startsAt: '2026-05-15T09:00:00Z',
          endsAt: '2026-05-17T16:00:00Z',
          location: 'Edinburgh',
          eventType: 'Conference',
          imageUrl: null,
          summary: 'Three days of teaching, research presentations and the annual dinner.',
          isNew: false,
        },
      ],
      posts: [
        {
          id: '1',
          title: 'Applying for a colorectal fellowship: what selectors actually look for',
          slug: 'applying-for-a-colorectal-fellowship',
          category: 'Careers',
          publishedAt: '2026-03-02T10:00:00Z',
          excerpt: 'Five recent fellows on what made the difference to their applications, from logbook presentation to picking referees who will actually write something.',
          imageUrl: null,
          authorName: 'Miss Amelia Hart',
        },
        {
          id: '2',
          title: 'New national audit data on emergency laparotomy outcomes',
          slug: 'nela-2026-data',
          category: 'Research',
          publishedAt: '2026-02-27T10:00:00Z',
          excerpt: 'The latest NELA report shows a continued fall in 30-day mortality. We asked two trainees what it means for on-call practice.',
          imageUrl: null,
          authorName: null,
        },
      ],
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
