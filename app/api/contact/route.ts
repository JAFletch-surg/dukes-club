import { NextRequest, NextResponse } from 'next/server'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { contactFormEmail, contactAutoReplyEmail } from '@/lib/emails/templates'

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'info@thedukesclub.org.uk'

const SUBJECT_LABELS: Record<string, string> = {
  membership: 'Membership',
  events: 'Events & Courses',
  'annual-weekend': 'Annual Weekend',
  research: 'Research & Collaboration',
  sponsorship: 'Sponsorship',
  website: 'Website & Technical',
  other: 'Other',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, subject, message, company } = body as {
      name?: string
      email?: string
      subject?: string
      message?: string
      company?: string // honeypot field, left blank by real users
    }

    // Bots that fill in the hidden honeypot field are silently accepted but ignored
    if (company) {
      return NextResponse.json({ success: true })
    }

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (name.length > 100 || email.length > 255 || message.length > 2000) {
      return NextResponse.json({ error: 'One or more fields exceed the allowed length' }, { status: 400 })
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const subjectLabel = SUBJECT_LABELS[subject] || subject

    const notification = contactFormEmail({ name, email, subject: subjectLabel, message })

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: notification.subject,
      html: notification.html,
    })

    if (sendError) {
      console.error('Resend error (contact form):', sendError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    const confirmation = contactAutoReplyEmail({ name })
    const { error: confirmError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: confirmation.subject,
      html: confirmation.html,
    })

    if (confirmError) {
      // The enquiry itself was delivered, so don't fail the request over the auto-reply
      console.error('Resend error (contact auto-reply):', confirmError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Contact API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
