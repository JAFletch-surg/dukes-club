'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Mail, AlertTriangle } from 'lucide-react'
import {
  DigestPreferenceFields,
  DEFAULT_DIGEST_PREFERENCES,
  type DigestPreferenceValue,
} from '@/components/digest/digest-preference-fields'

// Preference centre reached from the footer of every round-up email. Works
// without a login: the token in the link identifies the subscription, and the
// service-role API behind it can only touch that one row.

function PreferenceCentre() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const wantsUnsubscribe = searchParams.get('unsubscribe') === '1'

  const [value, setValue] = useState<DigestPreferenceValue>(DEFAULT_DIGEST_PREFERENCES)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unsubscribed, setUnsubscribed] = useState(false)

  // Guards against the unsubscribe running twice under React strict mode.
  const optOutApplied = useRef(false)

  useEffect(() => {
    if (!token) {
      setError('This link is missing its access code. Please use the link from your email.')
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        // Following an unsubscribe link opts the member out immediately — no
        // "click here to confirm" step — and the form below then lets them
        // choose a lighter cadence instead of leaving, if they'd rather.
        if (wantsUnsubscribe && !optOutApplied.current) {
          optOutApplied.current = true
          const optOut = await fetch('/api/digest/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, frequency: 'never' }),
          })
          if (optOut.ok && !cancelled) setUnsubscribed(true)
        }

        const response = await fetch(`/api/digest/preferences?token=${encodeURIComponent(token)}`)
        const data = await response.json()
        if (cancelled) return

        if (!response.ok) {
          setError(data.error || 'This link is no longer valid.')
          return
        }

        setEmail(data.email)
        setValue({
          frequency: data.frequency,
          includeEvents: data.includeEvents,
          includeNews: data.includeNews,
          includeVideos: data.includeVideos,
          newsCategories: data.newsCategories || [],
        })
      } catch {
        if (!cancelled) setError('We couldn\'t load your preferences. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token, wantsUnsubscribe])

  const handleChange = useCallback((next: DigestPreferenceValue) => {
    setValue(next)
    setSaved(false)
  }, [])

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    setSaved(false)

    try {
      const response = await fetch('/api/digest/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          frequency: value.frequency,
          includeEvents: value.includeEvents,
          includeNews: value.includeNews,
          includeVideos: value.includeVideos,
          newsCategories: value.newsCategories,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'We couldn\'t save your preferences.')
        return
      }

      setSaved(true)
      setUnsubscribed(value.frequency === 'never')
      setTimeout(() => setSaved(false), 4000)
    } catch {
      setError('We couldn\'t save your preferences. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !email) {
    return (
      <Card className="border">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 text-amber-500" size={28} />
          <h2 className="text-lg font-semibold text-foreground mb-2">We couldn&rsquo;t open that link</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <p className="text-sm text-muted-foreground">
            You can manage everything from{' '}
            <Link href="/members/profile" className="text-gold font-semibold hover:underline">
              your profile
            </Link>{' '}
            once signed in, or email{' '}
            <a href="mailto:info@thedukesclub.org.uk" className="text-gold font-semibold hover:underline">
              info@thedukesclub.org.uk
            </a>{' '}
            and we&rsquo;ll sort it out.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {unsubscribed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">You&rsquo;ve been unsubscribed</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            You won&rsquo;t receive the round-up any more. If you&rsquo;d rather just hear from us
            less often, pick a different frequency below and save.
          </p>
        </div>
      )}

      <Card className="border">
        <CardContent className="p-6 sm:p-8">
          {email && (
            <div className="flex items-center gap-2 pb-5 mb-6 border-b text-sm text-muted-foreground">
              <Mail size={15} className="shrink-0" />
              <span>Preferences for <span className="font-medium text-foreground">{email}</span></span>
            </div>
          )}

          <DigestPreferenceFields value={value} onChange={handleChange} disabled={saving} />

          {error && <p className="text-sm text-destructive mt-6">{error}</p>}

          <div className="flex items-center gap-3 mt-8 pt-6 border-t">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check size={14} className="mr-2" /> Saved</>
              ) : (
                'Save preferences'
              )}
            </Button>
            {saved && <span className="text-sm text-muted-foreground">Your preferences have been updated.</span>}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        This only controls the round-up email. Messages about your account &mdash; event bookings,
        certificates and password resets &mdash; are always sent.
      </p>
    </div>
  )
}

export default function EmailPreferencesPage() {
  return (
    <div className="min-h-[60vh] bg-muted/30 py-14 sm:py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Email preferences</h1>
          <p className="text-muted-foreground mt-2">
            Choose how often you hear from The Dukes&rsquo; Club, and what about.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <PreferenceCentre />
        </Suspense>
      </div>
    </div>
  )
}
