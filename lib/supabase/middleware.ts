import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Two jobs, and only two:
 *   1. Keep the session alive — refresh an expired access token and write the
 *      new cookies back, so the server components below can read it.
 *   2. Bounce anonymous visitors off the protected trees before anything renders.
 *
 * Role and approval checks used to live here too, at the cost of a profiles
 * query on every single protected request — and the layout underneath then
 * ran the identical query again, since middleware and the render pass are
 * separate execution contexts that cannot share a cache. Those checks now
 * live in app/members/layout.tsx and app/admin/layout.tsx, which already load
 * the profile to seed the auth provider, so the gate costs nothing there.
 *
 * The matcher (see middleware.ts) is deliberately tiny. Every route handler
 * under /api authenticates its own caller — bearer token, cron secret, LiveKit
 * signature or hashed magic link — so none of them needs a session refresh
 * here, and the public pages are static.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() refreshes an expired token the same way getUser() did — the
  // refreshed cookies come back through setAll above — but verifies the JWT
  // locally against a cached JWKS instead of calling the Auth service, on a
  // project using asymmetric signing keys.
  const { data } = await supabase.auth.getClaims()
  const signedIn = !!data?.claims?.sub

  const pathname = request.nextUrl.pathname
  const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/members')

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(url)
    // Carry the refreshed cookies onto the redirect, or the next request
    // starts from the stale ones.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  return supabaseResponse
}
