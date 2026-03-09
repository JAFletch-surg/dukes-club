import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { passwordResetEmail } from '@/lib/emails/templates'

// Service-role client — can query profiles without RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const TOKEN_EXPIRY_HOURS = 1

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Look up user by email in auth.users via admin API
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('Error listing users:', listError)
      // Don't reveal whether the user exists
      return NextResponse.json({ success: true })
    }

    const user = users.find(u => u.email?.toLowerCase() === normalizedEmail)

    if (!user) {
      // Don't reveal whether the user exists — always return success
      return NextResponse.json({ success: true })
    }

    // Get the user's profile for their name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

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
      name: profile?.full_name || 'Member',
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
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}