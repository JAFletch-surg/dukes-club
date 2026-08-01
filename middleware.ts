import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { CANONICAL_HOST, LEGACY_HOSTS } from '@/lib/site-url'

// Auth flows must finish on the origin they started on: exchangeCodeForSession
// in app/auth/callback/route.ts reads a Supabase code-verifier cookie scoped to
// that host, and a cross-host redirect would drop it. API routes are excluded
// so non-browser callers aren't bounced mid-request.
const REDIRECT_EXEMPT_PREFIXES = ['/auth/callback', '/reset-password', '/api/']

function isExemptFromHostRedirect(pathname: string): boolean {
  return REDIRECT_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  // The club moved from dukesclub.org to thedukesclub.org.uk. Emails already
  // sent carry the old host, so send that traffic to the canonical domain
  // instead of serving the site under a retired name.
  //
  // Read the host from headers rather than nextUrl: behind Vercel's proxy
  // nextUrl reports the internal origin, so the requested domain only survives
  // in x-forwarded-host / host.
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .toLowerCase()

  if (LEGACY_HOSTS.has(host) && !isExemptFromHostRedirect(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.host = CANONICAL_HOST
    url.protocol = 'https:'
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
