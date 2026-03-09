import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { welcomeEmail } from '@/lib/emails/templates'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Register API error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
