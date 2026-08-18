'use client'

import { useState } from 'react'
import { BarChart3, Loader2, Check } from 'lucide-react'
import type { WebinarPoll } from '@/lib/webinars'
import type { PollResults } from '@/lib/use-webinar-realtime'
import { cn } from '@/lib/utils'
import { PanelEmpty } from './PanelEmpty'

interface Props {
  polls: WebinarPoll[]
  results: Record<string, PollResults>
  enabled: boolean
  readOnly?: boolean
  onVote: (pollId: string, optionIds: string[]) => Promise<{ error: string | null }>
}

export function PollPanel({ polls, results, enabled, readOnly, onVote }: Props) {
  // Drafts never reach attendees (RLS blocks them), but a host viewing this
  // panel would otherwise see unlaunched polls mixed in with live ones.
  const visible = polls.filter(p => p.status !== 'draft')

  if (visible.length === 0) {
    return (
      <PanelEmpty
        icon={<BarChart3 size={22} />}
        title="No polls yet"
        body="When the host launches a poll it will appear here."
      />
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
      {visible.map(poll => (
        <PollCard
          key={poll.id}
          poll={poll}
          result={results[poll.id]}
          enabled={enabled && !readOnly}
          onVote={onVote}
        />
      ))}
    </div>
  )
}

function PollCard({
  poll,
  result,
  enabled,
  onVote,
}: {
  poll: WebinarPoll
  result?: PollResults
  enabled: boolean
  onVote: (pollId: string, optionIds: string[]) => Promise<{ error: string | null }>
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myVote = result?.myVote ?? null
  const hasVoted = !!myVote?.length
  const isOpen = poll.status === 'live'
  const voters = result?.voters ?? 0

  // Results appear once you've voted (so you can't peek and be swayed), or
  // once the host closes the poll, and only if they've made them visible.
  const showResults = poll.results_visible && (hasVoted || poll.status === 'closed')

  function toggle(optionId: string) {
    if (!isOpen || hasVoted) return
    setSelected(prev =>
      poll.allow_multiple
        ? prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
        : [optionId]
    )
  }

  async function submit() {
    if (!selected.length) { setError('Pick an option first.'); return }
    setSaving(true)
    setError(null)
    const res = await onVote(poll.id, selected)
    setSaving(false)
    if (res.error) setError(res.error)
  }

  return (
    <div className="wb-panel-enter rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] p-3.5">
      <div className="flex items-start gap-2 mb-2.5">
        <p className="font-serif text-[15px] leading-snug text-navy-foreground flex-1">
          {poll.question}
        </p>
        {isOpen && (
          <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-gold shrink-0 mt-1">
            Open
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map(option => {
          const count = result?.counts[option.id] ?? 0
          const pct = voters > 0 ? Math.round((count / voters) * 100) : 0
          const picked = myVote?.includes(option.id) || selected.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              disabled={!enabled || !isOpen || hasVoted}
              onClick={() => toggle(option.id)}
              className={cn(
                'relative w-full text-left rounded-md overflow-hidden ring-1 transition-colors',
                picked ? 'ring-gold/60' : 'ring-white/10',
                isOpen && !hasVoted && enabled && 'hover:ring-white/25 cursor-pointer',
                (!isOpen || hasVoted) && 'cursor-default'
              )}
            >
              {showResults && (
                <div
                  className={cn(
                    'wb-bar absolute inset-y-0 left-0',
                    picked ? 'bg-gold/25' : 'bg-white/[0.07]'
                  )}
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative flex items-center gap-2 px-3 py-2">
                {picked && <Check size={12} className="text-gold shrink-0" />}
                <span className="text-[13px] text-navy-foreground/90 flex-1">{option.label}</span>
                {showResults && (
                  <span className="text-[12px] font-semibold text-navy-foreground/70 shrink-0 tabular-nums">
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {error && <p className="text-[11.5px] text-red-300 mt-2">{error}</p>}

      <div className="flex items-center gap-3 mt-3">
        {isOpen && !hasVoted && enabled && (
          <button
            type="button"
            onClick={submit}
            disabled={saving || !selected.length}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gold text-gold-foreground text-[12px] font-semibold hover:bg-gold/90 disabled:opacity-40"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            Submit
          </button>
        )}

        <p className="text-[11px] text-navy-foreground/40 ml-auto">
          {voters === 0
            ? 'No responses yet'
            : `${voters} response${voters === 1 ? '' : 's'}`}
          {hasVoted && ' · you voted'}
          {poll.status === 'closed' && ' · closed'}
        </p>
      </div>

      {poll.status === 'closed' && !poll.results_visible && (
        <p className="text-[11px] text-navy-foreground/40 mt-1.5">
          The host has kept these results private.
        </p>
      )}
    </div>
  )
}
