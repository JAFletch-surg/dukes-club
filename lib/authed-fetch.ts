import { createClient } from '@/lib/supabase/client'

/**
 * fetch() with the caller's Supabase access token attached.
 *
 * For the API routes that authenticate by bearer token rather than by cookie
 * — which is all of them. Returns a 401-shaped Response rather than throwing
 * when there is no session, so callers can handle it like any other failure.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated — please log in again' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  })
}
