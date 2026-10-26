import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/supabase/admin-request'

/**
 * Mark a member's email address as verified.
 *
 * Supabase refuses password sign-in until the address is confirmed, and the
 * confirmation link in the welcome email expires. An admin who has reviewed
 * and approved a member has vouched for them, so this lets the admin clear
 * the block from the members page instead of editing auth.users by hand.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return auth.response

  try {
    const { userId } = await request.json()
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const { data: existing, error: lookupError } = await auth.supabase.auth.admin.getUserById(userId)
    if (lookupError || !existing?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (existing.user.email_confirmed_at) {
      return NextResponse.json({ success: true, alreadyVerified: true })
    }

    const { error } = await auth.supabase.auth.admin.updateUserById(userId, { email_confirm: true })
    if (error) {
      console.error('Confirm email error:', error)
      return NextResponse.json({ error: 'Failed to mark email as verified' }, { status: 500 })
    }

    return NextResponse.json({ success: true, alreadyVerified: false })
  } catch (error) {
    console.error('Confirm email route error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
