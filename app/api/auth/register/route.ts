import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { welcomeEmail, adminNewRegistrationEmail } from '@/lib/emails/templates'
import { isValidCountry } from '@/lib/constants/countries'
import {
  isApprovedDomain,
  isMemberCategory,
  isValidGmcNumber,
  normaliseGmcNumber,
  requiresGmcNumber,
} from '@/lib/registration'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thedukesclub.org.uk'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email, password, fullName, region, country, trainingStage,
      acpgbiNumber, gmcNumber, directoryVisible,
    } = body
    const memberCategory = body.memberCategory ?? 'uk'

    if (!email || !password || !fullName || !trainingStage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!isMemberCategory(memberCategory)) {
      return NextResponse.json({ error: 'Invalid member category' }, { status: 400 })
    }

    const isInternational = memberCategory === 'international'

    // International members give a country; UK members give their deanery.
    if (isInternational) {
      if (!country) {
        return NextResponse.json({ error: 'Please select the country you are based in' }, { status: 400 })
      }
      if (!isValidCountry(country)) {
        return NextResponse.json({ error: 'Unrecognised country' }, { status: 400 })
      }
    } else if (!region) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // UK trainees on an unrecognised email domain must supply a GMC number so
    // an admin has something to verify them against.
    const gmcRequired = requiresGmcNumber(memberCategory, email)
    if (gmcRequired && !gmcNumber) {
      return NextResponse.json(
        { error: 'A GMC number is required when registering with a non-NHS email' },
        { status: 400 }
      )
    }
    if (gmcNumber && !isValidGmcNumber(gmcNumber)) {
      return NextResponse.json({ error: 'Please enter a valid 7-digit GMC number' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const storedRegion = isInternational ? null : region
    const storedCountry = isInternational ? country : null
    const storedGmcNumber = gmcNumber ? normaliseGmcNumber(gmcNumber) : null

    const supabase = getSupabase()
    // Auto-approval recognises UK NHS/academic domains only — an international
    // registration always goes to an admin, whatever address it uses.
    const approved = !isInternational && isApprovedDomain(email)

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
          member_category: memberCategory,
          region: storedRegion,
          country: storedCountry,
          training_stage: trainingStage,
          acpgbi_number: acpgbiNumber || null,
          gmc_number: storedGmcNumber,
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

    // Write the registration details onto the profile row the signup trigger
    // created. The category, country and GMC number are set here rather than
    // relying on the trigger to read them out of the user metadata, and
    // approved-domain users are approved in the same write.
    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          member_category: memberCategory,
          region: storedRegion,
          country: storedCountry,
          gmc_number: storedGmcNumber,
          ...(approved ? { approval_status: 'approved', role: 'trainee' } : {}),
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
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

    // Notify admins of every new registration (auto-approved or pending review)
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
          region: storedRegion,
          country: storedCountry,
          memberCategory,
          gmcNumber: storedGmcNumber,
          trainingStage,
          siteUrl: SITE_URL,
          approved,
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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Register API error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
