import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Where every Supabase auth redirect lands.
 *
 * PKCE flows arrive with ?code=… and are exchanged for a session here.
 *
 * The email links this app sends (signup confirmation and the re-sent
 * verification link, both minted with the admin generateLink API) use the
 * implicit flow instead: Supabase has already confirmed the address and puts
 * the outcome in the URL fragment, which a server route cannot read. Those
 * are forwarded to /auth/confirm — browsers carry the fragment across a
 * redirect — where the page reads it client-side and tells the member what
 * happened. Previously they were bounced to /login?error=auth, which the login
 * page silently ignored, so an expired link looked identical to a working one.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/members'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Implicit-flow result (or an error) lives in the fragment — let the
  // browser-side page inspect it. Supabase occasionally reports errors as
  // query params too, so pass those along.
  const confirmUrl = new URL('/auth/confirm', origin)
  for (const key of ['error', 'error_code', 'error_description']) {
    const value = searchParams.get(key)
    if (value) confirmUrl.searchParams.set(key, value)
  }
  return NextResponse.redirect(confirmUrl)
}
