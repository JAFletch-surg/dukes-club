import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { passwordResetEmail } from '@/lib/emails/templates'
import { findUserByEmail } from '@/lib/auth/find-user-by-email'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'
const TOKEN_EXPIRY_HOURS = 1

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const user = await findUserByEmail(supabase, normalizedEmail)

    if (!user) {
      // Don't reveal whether the user exists — always return success
      console.warn('Password reset requested for unknown email')
      return NextResponse.json({ success: true })
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

    // Delete any existing tokens for this user
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)

    // Store the new token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token_hash: crypto.createHash('sha256').update(token).digest('hex'),
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('Error storing reset token:', insertError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // Build the reset URL
    const resetUrl = `${SITE_URL}/reset-password?token=${token}`

    // Send the branded email via Resend
    const emailContent = passwordResetEmail({
      name: user.fullName || 'Member',
      resetUrl,
    })

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
