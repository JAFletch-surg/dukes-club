import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { adminMembershipNumberEmail } from '@/lib/emails/templates'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dukesclub.org.uk'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'contact@dukesclub.org.uk'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Verify the request is from an authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { acpgbiNumber } = body as { acpgbiNumber: string }

    if (!acpgbiNumber || !acpgbiNumber.trim()) {
      return NextResponse.json({ error: 'ACPGBI number is required' }, { status: 400 })
    }

    // Update the profile with the ACPGBI number
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        acpgbi_number: acpgbiNumber.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    // Fetch the user's profile for the email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    // Send admin notification email
    if (profile) {
      const email = adminMembershipNumberEmail({
        userName: profile.full_name || 'Unknown',
        userEmail: profile.email || user.email || '',
        acpgbiNumber: acpgbiNumber.trim(),
        siteUrl: SITE_URL,
      })

      // Send to all admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .in('role', ['admin', 'super_admin'])
        .eq('approval_status', 'approved')

      const adminEmails = admins?.map((a) => a.email).filter(Boolean) || []
      const recipients = adminEmails.length > 0 ? adminEmails : [ADMIN_EMAIL]

      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipients,
        subject: email.subject,
        html: email.html,
      }).catch((err) => console.error('Admin notification email failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Membership submit error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
