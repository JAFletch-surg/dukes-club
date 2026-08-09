import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { passwordResetEmail } from '@/lib/emails/templates'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'
const TOKEN_EXPIRY_HOURS = 1

// listUsers() is paginated — the default page size only covers the first
// handful of members, so it must never be called without paging through
// every page (see findUserByEmail below).
const USERS_PER_PAGE = 1000
const MAX_USER_PAGES = 50

type FoundUser = { id: string; fullName: string | null }

/** Escape LIKE/ILIKE wildcards so an address containing `_` or `%` matches literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * Resolve an email address to a user.
 *
 * Prefers a direct, case-insensitive lookup against `profiles` (one indexed
 * query, no pagination). Falls back to paging through auth.users for accounts
 * that have no profile row yet, or whose auth email differs from their profile
 * email.
 */
async function findUserByEmail(
  supabase: SupabaseClient,
  normalizedEmail: string
): Promise<FoundUser | null> {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('email', escapeLikePattern(normalizedEmail))
    .limit(1)

  if (profileError) {
    console.error('Error looking up profile by email:', profileError)
  } else if (profiles && profiles.length > 0) {
    return { id: profiles[0].id, fullName: profiles[0].full_name ?? null }
  }

  // Fallback: page through auth.users rather than relying on the first page.
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    })

    if (error) {
      console.error('Error listing users:', error)
      return null
    }

    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === normalizedEmail)

    if (match) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', match.id)
        .maybeSingle()

      return { id: match.id, fullName: profile?.full_name ?? null }
    }

    if (users.length < USERS_PER_PAGE) break
  }

  return null
}

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
