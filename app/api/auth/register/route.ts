import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { welcomeEmail, adminNewRegistrationEmail } from '@/lib/emails/templates'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dukesclub.org'

const APPROVED_DOMAINS = ['nhs.net', 'nhs.uk', 'doctors.org.uk']
const APPROVED_SUFFIX = '.ac.uk'

function isApprovedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return APPROVED_DOMAINS.includes(domain) || domain.endsWith(APPROVED_SUFFIX)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, fullName, region, trainingStage, acpgbiNumber, directoryVisible } = body

    if (!email || !password || !fullName || !trainingStage || !region) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const supabase = getSupabase()
    const approved = isApprovedDomain(email)

    // Generate a signup confirmation link using the admin API.
    // This creates the user AND returns a confirmation URL without
    // Supabase sending its default email.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          region,
          training_stage: trainingStage,
          acpgbi_number: acpgbiNumber || null,
          directory_visible: directoryVisible ?? true,
        },
        redirectTo: `${SITE_URL}/auth/callback?next=/login?verified=true`,
      },
    })

    if (linkError) {
      if (linkError.message.includes('already been registered') || linkError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Try signing in instead.' },
          { status: 409 }
        )
      }
      console.error('Generate link error:', linkError)
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    const userId = linkData?.user?.id

    // Auto-approve NHS/approved-domain users server-side
    if (approved && userId) {
      const { error: approveError } = await supabase
        .from('profiles')
        .update({ approval_status: 'approved', role: 'trainee' })
        .eq('id', userId)

      if (approveError) {
        console.error('Auto-approve error:', approveError)
      }
    }

    // The action_link from generateLink contains the confirmation token.
    // We need to transform it so it routes through our auth callback.
    const confirmUrl = linkData?.properties?.action_link

    // Send branded welcome email with verification link via Resend
    const emailContent = welcomeEmail({
      name: fullName,
      confirmUrl: confirmUrl || undefined,
      siteUrl: SITE_URL,
    })

    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      // User was created but email failed — log but don't fail the request
    }

    // For non-approved domains, notify admins that a new registration needs review
    if (!approved) {
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('email')
          .in('role', ['admin', 'super_admin'])

        const adminEmails = (admins || [])
          .map((a: { email: string | null }) => a.email)
          .filter(Boolean) as string[]

        if (adminEmails.length > 0) {
          const adminEmail = adminNewRegistrationEmail({
            userName: fullName,
            userEmail: email,
            region,
            trainingStage,
            siteUrl: SITE_URL,
          })

          await resend.emails.send({
            from: FROM_EMAIL,
            to: adminEmails,
            subject: adminEmail.subject,
            html: adminEmail.html,
          })
        }
      } catch (adminNotifyError) {
        console.error('Admin notification error:', adminNotifyError)
        // Don't fail registration if admin notification fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Register API error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
