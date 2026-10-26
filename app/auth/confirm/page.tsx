'use client'
import Link from "next/link"
import { useEffect, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertTriangle, ArrowRight } from "lucide-react"
import AuthLayout from "@/components/auth/AuthLayout"
import ResendVerification from "@/components/auth/ResendVerification"

type Outcome = 'checking' | 'verified' | 'expired' | 'invalid'

/**
 * Read the verification result out of the current URL. Supabase puts it in
 * the fragment for implicit-flow links and, for some errors, in the query.
 * Returns a primitive so useSyncExternalStore can compare snapshots.
 */
function readOutcomeFromLocation(): `${Outcome}|${string}` {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const get = (key: string) => hash.get(key) ?? query.get(key)

  const errorCode = get('error_code')
  const error = get('error')
  const errorDescription = get('error_description')

  if (errorCode === 'otp_expired') return 'expired|'
  if (error || errorCode) return `invalid|${errorDescription?.replace(/\+/g, ' ') ?? ''}`
  if (hash.get('access_token') || get('code')) return 'verified|'
  return 'invalid|'
}

// Re-read if the fragment changes in place (a same-document navigation).
const subscribeToHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/**
 * Landing page for Supabase email links (signup confirmation, magic link).
 *
 * Supabase answers those links with an implicit-flow redirect: the result is
 * in the URL *fragment* (#access_token=… on success, #error_code=otp_expired
 * on an expired token). A server route never sees the fragment, so
 * /auth/callback forwards fragment-only redirects here and this page reads it
 * in the browser.
 *
 * On success the email is already confirmed server-side by the time we land
 * here, so the member is simply pointed at the sign-in form. We deliberately
 * don't adopt the session from the fragment — signing in with the password
 * they just chose is one click and keeps the login page's role routing as the
 * single path into the site.
 */
export default function ConfirmPage() {
  // Server render and first client paint both show 'checking'; the real
  // outcome is read from the URL once hydrated, without a hydration mismatch.
  const snapshot = useSyncExternalStore(subscribeToHash, readOutcomeFromLocation, () => 'checking|' as const)
  const separator = snapshot.indexOf('|')
  const outcome = snapshot.slice(0, separator) as Outcome
  const description = snapshot.slice(separator + 1)

  useEffect(() => {
    if (outcome === 'verified' && window.location.hash) {
      // Strip the tokens from the address bar so they are not left in history.
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [outcome])

  if (outcome === 'checking') {
    return (
      <AuthLayout>
        <div className="flex justify-center py-12">
          <span className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthLayout>
    )
  }

  if (outcome === 'verified') {
    return (
      <AuthLayout>
        <div className="text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email verified</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Thanks — your email address is confirmed. Sign in with the password you chose when you registered.
            </p>
          </div>
          <Link href="/login?verified=true">
            <Button variant="gold" className="h-11">
              Sign In
              <ArrowRight size={16} className="ml-1" />
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const expired = outcome === 'expired'

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
            {expired ? <Clock className="h-8 w-8 text-gold" /> : <AlertTriangle className="h-8 w-8 text-gold" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {expired ? 'This link has expired' : "We couldn't verify that link"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              {expired
                ? 'Verification links only work for a short time and can be used once. Enter your email below and we’ll send you a fresh one.'
                : 'The link may have already been used or was copied incompletely. Enter your email below and we’ll send you a fresh one.'}
            </p>
            {description && !expired && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </div>
        </div>

        <ResendVerification />

        <p className="text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link href="/login" className="text-gold hover:text-gold/80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
