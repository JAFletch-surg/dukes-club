'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/use-auth'
import {
  Mail, Loader, Send, Eye, Users, CalendarClock, CheckCircle2,
  AlertTriangle, RefreshCw, Inbox,
} from 'lucide-react'
import type { DigestFrequency } from '@/lib/emails/digest'
import DigestRunningOrder from '@/components/admin/digest-running-order'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

const badgeStyle = (bg: string, fg: string) => ({
  display: 'inline-flex', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 600, background: bg, color: fg,
}) as React.CSSProperties

const FREQUENCY_TABS: Array<{ value: DigestFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
]

interface SubscriberCounts {
  weekly: number
  fortnightly: number
  monthly: number
  never: number
}

interface SendRow {
  id: string
  sent_at: string
  frequency: string | null
  event_count: number
  post_count: number
  video_count: number | null
  status: string
  error: string | null
}

interface Preview {
  subject: string
  html: string
  eventCount: number
  postCount: number
  videoCount: number
  isEmpty: boolean
}

interface RunResult {
  dryRun?: boolean
  subscribers: number
  due: number
  sent: number
  failed: number
  skippedEmpty: number
  skippedRecent?: number
  recipients?: Array<{ email: string; frequency: string; eventCount: number; postCount: number; videoCount: number }>
}

export default function AdminDigestPage() {
  const supabase = createClient()
  const { profile } = useAuth()

  const [counts, setCounts] = useState<SubscriberCounts>({ weekly: 0, fortnightly: 0, monthly: 0, never: 0 })
  const [recentSends, setRecentSends] = useState<SendRow[]>([])
  const [loading, setLoading] = useState(true)

  const [frequency, setFrequency] = useState<DigestFrequency>('weekly')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [busy, setBusy] = useState<null | 'test' | 'dry' | 'send'>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStats = useCallback(async () => {
    const frequencies: Array<keyof SubscriberCounts> = ['weekly', 'fortnightly', 'monthly', 'never']
    const results = await Promise.all(
      frequencies.map((f) =>
        supabase.from('digest_preferences').select('user_id', { count: 'exact', head: true }).eq('frequency', f)
      )
    )
    setCounts({
      weekly: results[0].count || 0,
      fortnightly: results[1].count || 0,
      monthly: results[2].count || 0,
      never: results[3].count || 0,
    })

    const { data } = await supabase
      .from('digest_sends')
      .select('id, sent_at, frequency, event_count, post_count, video_count, status, error')
      .order('sent_at', { ascending: false })
      .limit(15)

    setRecentSends(data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const loadPreview = useCallback(async (freq: DigestFrequency) => {
    setPreviewLoading(true)
    try {
      // Fetched rather than framed directly so the request can carry the admin
      // bearer token; the HTML is then handed to the iframe via srcDoc.
      const response = await fetch(`/api/digest/preview?frequency=${freq}`, { headers: await authHeaders() })
      const data = await response.json()
      if (!response.ok) {
        setMessage({ kind: 'error', text: data.error || 'Could not build the preview' })
        setPreview(null)
        return
      }
      setPreview(data)
    } catch {
      setMessage({ kind: 'error', text: 'Could not build the preview' })
    } finally {
      setPreviewLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { loadPreview(frequency) }, [frequency, loadPreview])

  const callSend = async (body: Record<string, unknown>, kind: 'test' | 'dry' | 'send') => {
    setBusy(kind)
    setMessage(null)
    if (kind !== 'test') setResult(null)

    try {
      const response = await fetch('/api/digest/send', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (!response.ok) {
        setMessage({ kind: 'error', text: data.error || 'The request failed' })
        return
      }

      if (kind === 'test') {
        setMessage({ kind: 'ok', text: `Test digest sent to ${body.testEmail}.` })
      } else {
        setResult(data)
        setMessage(
          kind === 'dry'
            ? { kind: 'ok', text: `${data.wouldSend ?? data.recipients?.length ?? 0} member(s) would receive a digest right now.` }
            : { kind: 'ok', text: `Sent ${data.sent} digest(s). ${data.failed ? `${data.failed} failed.` : ''}` }
        )
        if (kind === 'send') loadStats()
      }
    } catch {
      setMessage({ kind: 'error', text: 'The request failed' })
    } finally {
      setBusy(null)
    }
  }

  // Deliberately not window.confirm: browsers can suppress native dialogs (and
  // Chrome offers the user a "prevent additional dialogs" checkbox), in which
  // case confirm() returns false and the button silently does nothing at all.
  const handleSendNow = () => setConfirmOpen(true)

  const confirmSendNow = () => {
    setConfirmOpen(false)
    callSend({}, 'send')
  }

  const totalSubscribed = counts.weekly + counts.fortnightly + counts.monthly

  const statusBadge = (status: string) => badgeStyle(
    status === 'sent' ? '#f0fdf4' : status === 'failed' ? '#fef2f2' : '#f3f4f6',
    status === 'sent' ? '#16a34a' : status === 'failed' ? '#dc2626' : '#666'
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader className="animate-spin" size={28} color="#D1D1D6" />
      </div>
    )
  }

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-[#0F1F3D]">Round-Up Email</h1>
          <p className="text-sm text-[#504F58] mt-1">
            The recurring digest of upcoming events, new posts and new videos sent to members
          </p>
        </div>
        <button
          onClick={loadStats}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E4E4E8] bg-white text-[13px] font-semibold text-[#504F58] hover:bg-[#FAFAFA]"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {message.kind === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Subscriber stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-7">
        {[
          { label: 'Subscribed', count: totalSubscribed, icon: Users, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Weekly', count: counts.weekly, icon: CalendarClock, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Fortnightly / Monthly', count: counts.fortnightly + counts.monthly, icon: CalendarClock, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Opted out', count: counts.never, icon: Inbox, color: '#6B7280', bg: '#F3F4F6' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-[#E4E4E8] p-4 md:p-5">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3" style={{ background: card.bg }}>
              <card.icon size={18} color={card.color} />
            </div>
            <div className="text-2xl md:text-[28px] font-bold" style={{ color: card.color }}>{card.count}</div>
            <div className="text-[13px] text-[#504F58] mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
        {/* Preview */}
        <div className="bg-white rounded-2xl border border-[#E4E4E8] overflow-hidden order-2 lg:order-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[#F1F1F3]">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-[#504F58]" />
              <h2 className="text-[15px] font-bold text-[#0F1F3D]">Preview</h2>
            </div>
            <div className="flex gap-1 bg-[#F5F5F7] rounded-lg p-1">
              {FREQUENCY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFrequency(tab.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    frequency === tab.value ? 'bg-white text-[#0F1F3D] shadow-sm' : 'text-[#504F58]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {previewLoading ? (
            <div className="flex justify-center items-center h-[420px]">
              <Loader className="animate-spin" size={24} color="#D1D1D6" />
            </div>
          ) : preview ? (
            <>
              <div className="px-5 py-3 border-b border-[#F1F1F3] bg-[#FAFAFA]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8F98]">Subject</p>
                <p className="text-sm text-[#181820] mt-0.5">{preview.subject}</p>
                <div className="flex gap-2 mt-2">
                  <span style={badgeStyle('#EFF6FF', '#2563EB')}>{preview.eventCount} events</span>
                  <span style={badgeStyle('#FFF7ED', '#C2410C')}>{preview.postCount} posts</span>
                  <span style={badgeStyle('#F5F3FF', '#7C3AED')}>{preview.videoCount} videos</span>
                </div>
              </div>
              {preview.isEmpty ? (
                <div className="py-16 px-5 text-center">
                  <Inbox size={36} color="#D1D1D6" className="mx-auto mb-3" />
                  <p className="text-[15px] font-semibold text-[#181820]">Nothing to send right now</p>
                  <p className="text-sm text-[#504F58] mt-1 max-w-sm mx-auto">
                    There are no upcoming events, recent posts or new videos for this cadence, so
                    the run would skip everyone rather than send an empty email.
                  </p>
                </div>
              ) : (
                <iframe
                  title="Digest preview"
                  srcDoc={preview.html}
                  className="w-full h-[620px] border-0 bg-[#F5F5F0]"
                  sandbox=""
                />
              )}
            </>
          ) : (
            <div className="py-16 text-center text-sm text-[#504F58]">Preview unavailable</div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-5 order-1 lg:order-2">
          <div className="bg-white rounded-2xl border border-[#E4E4E8] p-5">
            <h2 className="text-[15px] font-bold text-[#0F1F3D] mb-1">Send</h2>
            <p className="text-[13px] text-[#504F58] mb-4">
              The digest goes out automatically on its schedule. These are for testing and for
              sending early.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => profile?.email && callSend({ testEmail: profile.email }, 'test')}
                disabled={busy !== null || !profile?.email}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E4E4E8] bg-white text-sm font-semibold text-[#0F1F3D] hover:bg-[#FAFAFA] disabled:opacity-50"
              >
                {busy === 'test' ? <Loader size={15} className="animate-spin" /> : <Mail size={15} />}
                Send a test to me
              </button>

              <button
                onClick={() => callSend({ dryRun: true }, 'dry')}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#E4E4E8] bg-white text-sm font-semibold text-[#0F1F3D] hover:bg-[#FAFAFA] disabled:opacity-50"
              >
                {busy === 'dry' ? <Loader size={15} className="animate-spin" /> : <Eye size={15} />}
                Check who&rsquo;s due (no email sent)
              </button>

              <button
                onClick={handleSendNow}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F1F3D] text-sm font-semibold text-white hover:bg-[#16294f] disabled:opacity-50"
              >
                {busy === 'send' ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                Send now to everyone due
              </button>
            </div>

            {profile?.email && (
              <p className="text-[11px] text-[#8A8F98] mt-3">Test sends go to {profile.email}</p>
            )}
          </div>

          {result && (
            <div className="bg-white rounded-2xl border border-[#E4E4E8] p-5">
              <h3 className="text-[13px] font-bold text-[#0F1F3D] mb-3">
                {result.dryRun ? 'Dry run' : 'Run complete'}
              </h3>
              <dl className="space-y-1.5 text-[13px]">
                {[
                  ['Subscribers', result.subscribers],
                  ['Due now', result.due],
                  [result.dryRun ? 'Would send' : 'Sent', result.dryRun ? (result.recipients?.length ?? 0) : result.sent],
                  ['Skipped (nothing new)', result.skippedEmpty],
                  ...(result.failed ? [['Failed', result.failed] as const] : []),
                ].map(([label, count]) => (
                  <div key={String(label)} className="flex justify-between">
                    <dt className="text-[#504F58]">{label}</dt>
                    <dd className="font-semibold text-[#181820]">{count}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E4E4E8] p-5">
            <h3 className="text-[13px] font-bold text-[#0F1F3D] mb-1">Schedule</h3>
            <p className="text-[13px] text-[#504F58]">
              A weekly cron runs the digest and sends only to members whose own cadence is up, so
              fortnightly and monthly subscribers are skipped on the runs in between. Members choose
              their frequency in their profile or from the link in the email footer.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send the round-up now?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <p>
                  This emails every member whose cadence is due
                  {result?.due ? ` — ${result.due} right now` : ''}. Members who are not due, or who
                  have nothing new to read, are skipped automatically.
                </p>
                <p className="text-[#8A6100] bg-[#FFFBEB] border border-[#F3E4BF] rounded-lg px-3 py-2">
                  Emails cannot be recalled once sent. If you have not run a test yet, cancel and use
                  &ldquo;Send a test to me&rdquo; first.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E4E4E8] bg-white text-sm font-semibold text-[#504F58] hover:bg-[#FAFAFA]"
            >
              Cancel
            </button>
            <button
              onClick={confirmSendNow}
              className="px-4 py-2 rounded-lg bg-[#0F1F3D] text-sm font-semibold text-white hover:bg-[#16294f]"
            >
              Send now
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Running order */}
      <div className="mt-8">
        <DigestRunningOrder />
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <h2 className="text-lg md:text-xl font-bold text-[#0F1F3D] mb-4">Recent Sends</h2>
        <div className="bg-white rounded-2xl border border-[#E4E4E8] overflow-hidden">
          {recentSends.length === 0 ? (
            <div className="py-14 px-5 text-center">
              <Mail size={36} color="#D1D1D6" className="mx-auto mb-3" />
              <p className="text-[15px] font-semibold text-[#181820]">No digests sent yet</p>
              <p className="text-sm text-[#504F58] mt-1">The log fills in once the first run goes out</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-[#F1F1F3]">
                    {['Sent', 'Cadence', 'Contents', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3.5 text-[11px] font-bold text-[#504F58] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSends.map((row) => (
                    <tr key={row.id} className="border-b border-[#F5F5F7] last:border-0">
                      <td className="px-4 py-3 text-[#181820] whitespace-nowrap">
                        {new Date(row.sent_at).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-[#504F58] capitalize">{row.frequency || '—'}</td>
                      <td className="px-4 py-3 text-[#504F58]">
                        {row.event_count} events · {row.post_count} posts · {row.video_count ?? 0} videos
                      </td>
                      <td className="px-4 py-3">
                        <span style={statusBadge(row.status)}>
                          {row.status === 'skipped_empty' ? 'skipped' : row.status}
                        </span>
                        {row.error && <span className="block text-[11px] text-red-600 mt-1">{row.error}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
