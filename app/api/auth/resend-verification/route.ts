import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { verificationEmail } from '@/lib/emails/templates'
import { findUserByEmail } from '@/lib/auth/find-user-by-email'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'

/**
 * Send a fresh email-verification link to an account that never confirmed
 * its address.
 *
 * The link in the welcome email is a one-shot Supabase token that expires
 * after the project's "Email OTP expiration" window. Welcome emails that land
 * in spam are often found after that window has closed, which left members
 * locked out with no self-service way back in. This route issues a new token.
 *
 * A `magiclink` is used rather than a `signup` link because the account
 * already exists. Verifying a magic link marks the email confirmed in exactly
 * the same way, and lands on /auth/callback like the original link does.
 *
 * Like forgot-password, it never reveals whether an address is registered.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabase = getSupabase()

    const found = await findUserByEmail(supabase, normalizedEmail)
    if (!found) {
      console.warn('Verification resend requested for unknown email')
      return NextResponse.json({ success: true })
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(found.id)
    if (userError || !userData?.user) {
      console.error('Error loading user for verification resend:', userError)
      return NextResponse.json({ success: true })
    }

    const authEmail = userData.user.email ?? normalizedEmail

    if (userData.user.email_confirmed_at) {
      // Nothing to verify. Tell the member so they stop waiting for an email
      // that will never come and simply sign in.
      return NextResponse.json({ success: true, alreadyVerified: true })
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
      options: { redirectTo: `${SITE_URL}/auth/callback` },
    })

    const confirmUrl = linkData?.properties?.action_link
    if (linkError || !confirmUrl) {
      console.error('Generate verification link error:', linkError)
      return NextResponse.json({ error: 'Could not create a verification link' }, { status: 500 })
    }

    const emailContent = verificationEmail({
      name: found.fullName || 'Member',
      confirmUrl,
    })

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: authEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
