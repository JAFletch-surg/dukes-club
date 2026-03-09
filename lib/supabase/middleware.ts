import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // IMPORTANT: getUser() triggers token refresh when the access token is expired.
  // The refreshed tokens are written back via setAll above.
  // This MUST run on every matched route to keep the session alive.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Protected routes
  const isAdminRoute = pathname.startsWith('/admin')
  const isMembersRoute = pathname.startsWith('/members')
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')
  const isResetPassword = pathname.startsWith('/reset-password')

  // Helper: redirect while preserving refreshed auth cookies
  function redirectWithCookies(destination: string, searchParams?: Record<string, string>) {
    const url = request.nextUrl.clone()
    url.pathname = destination
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, val]) => url.searchParams.set(key, val))
    }
    const redirectResponse = NextResponse.redirect(url)
    // Copy all cookies from supabaseResponse (which has refreshed tokens) to the redirect
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Not logged in → redirect to login
  if (!user && (isAdminRoute || isMembersRoute)) {
    return redirectWithCookies('/login', { redirect: pathname })
  }

  // Already logged in → redirect away from auth pages (but not reset-password)
  if (user && isAuthRoute && !isResetPassword) {
    return redirectWithCookies('/members')
  }

  // For protected routes, fetch profile once and check both role + approval
  if (user && (isAdminRoute || isMembersRoute)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    // Admin route — check role
    if (isAdminRoute) {
      const role = profile?.role
      if (!role || !['admin', 'super_admin', 'editor'].includes(role)) {
        return redirectWithCookies('/members')
      }
    }

    // Members route — check approval status
    if (isMembersRoute) {
      if (profile?.approval_status === 'pending') {
        return redirectWithCookies('/pending-approval')
      }
      if (profile?.approval_status === 'rejected') {
        return redirectWithCookies('/login')
      }
    }
  }

  return supabaseResponse
}