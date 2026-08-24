import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  /**
   * Only the paths that genuinely need a server-side session.
   *
   * This used to be a negative lookahead matching everything that was not a
   * static asset, which meant every marketing page view, every RSC payload and
   * every /api call paid for a middleware invocation plus a Supabase round
   * trip. The public pages are prerendered and must stay off this list to be
   * served from the CDN — a static route still costs an invocation if its path
   * matches here.
   *
   * /webinar is included because the live pages read cookies server-side and
   * depend on this for token refresh.
   *
   * /login, /register and /forgot-password are deliberately absent. They used
   * to be matched only to redirect an already-signed-in visitor to /members,
   * which (a) cost an invocation on three otherwise-static pages and (b) made
   * a rejected account bounce forever: /members sent it to /login, and /login
   * sent it straight back. The login page already routes by role and approval
   * status itself once credentials are accepted.
   */
  matcher: ['/admin/:path*', '/members/:path*', '/webinar/:path*'],
}
