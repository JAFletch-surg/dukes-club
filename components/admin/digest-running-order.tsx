'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowUp, ArrowDown, Pin, PinOff, Loader, ListOrdered, AlertTriangle } from 'lucide-react'

// Running order for the round-up email.
//
// Every item carries a nullable `digest_rank`: pinned items lead their section
// in rank order, everything else follows by date. That keeps the ordering a
// sort key rather than a hand-built issue, which matters because the digest is
// personalised — two members opening the same send may see different subsets,
// and a single global order still applies correctly to both.

interface OrderItem {
  id: string
  title: string
  date: string | null
  digest_rank: number | null
}

type SectionKey = 'events' | 'posts' | 'videos'

interface SectionConfig {
  key: SectionKey
  table: string
  label: string
  /** How many of these the email shows at most — see MAX_* in lib/emails/digest.ts. */
  limit: number
  dateField: string
  hint: string
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'events',
    table: 'events',
    label: 'Upcoming events',
    limit: 4,
    dateField: 'starts_at',
    hint: 'Events starting in the next few months.',
  },
  {
    key: 'posts',
    table: 'posts',
    label: 'Latest news',
    limit: 5,
    dateField: 'published_at',
    hint: 'Posts published in the last 60 days.',
  },
  {
    key: 'videos',
    table: 'videos',
    label: 'New in the video library',
    limit: 3,
    dateField: 'published_at',
    hint: 'Videos published in the last 60 days.',
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Pinned items first in rank order, then everything else in date order. */
function inRunningOrder(items: OrderItem[]): OrderItem[] {
  const pinned = items
    .filter((i) => i.digest_rank != null)
    .sort((a, b) => (a.digest_rank as number) - (b.digest_rank as number))
  const rest = items.filter((i) => i.digest_rank == null)
  return [...pinned, ...rest]
}

export default function DigestRunningOrder() {
  const supabase = createClient()
  const [sections, setSections] = useState<Record<SectionKey, OrderItem[]>>({ events: [], posts: [], videos: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const now = new Date()
    const lookback = new Date(now.getTime() - 60 * DAY_MS).toISOString()
    const horizon = new Date(now.getTime() + 105 * DAY_MS).toISOString()

    const [events, posts, videos] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, starts_at, digest_rank')
        .eq('status', 'published')
        .gte('starts_at', now.toISOString())
        .lte('starts_at', horizon)
        .order('starts_at', { ascending: true })
        .limit(20),
      supabase
        .from('posts')
        .select('id, title, published_at, digest_rank')
        .eq('status', 'published')
        .gte('published_at', lookback)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false })
        .limit(20),
      supabase
        .from('videos')
        .select('id, title, published_at, digest_rank')
        .eq('status', 'published')
        .gte('published_at', lookback)
        .lte('published_at', now.toISOString())
        .order('published_at', { ascending: false })
        .limit(20),
    ])

    const firstError = events.error || posts.error || videos.error
    if (firstError) setError(`Could not load the running order: ${firstError.message}`)

    const shape = (rows: Array<Record<string, unknown>> | null, dateField: string): OrderItem[] =>
      (rows || []).map((r) => ({
        id: String(r.id),
        title: String(r.title),
        date: (r[dateField] as string | null) ?? null,
        digest_rank: (r.digest_rank as number | null) ?? null,
      }))

    setSections({
      events: shape(events.data, 'starts_at'),
      posts: shape(posts.data, 'published_at'),
      videos: shape(videos.data, 'published_at'),
    })
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  /**
   * Write a section's new pinned order. Ranks are always rewritten as a dense
   * 1..n sequence, so gaps left by unpinning never accumulate.
   */
  const persist = async (config: SectionConfig, pinnedIds: string[], unpinnedId?: string) => {
    setSaving(true)
    setError(null)

    const writes = pinnedIds.map((id, index) =>
      supabase.from(config.table).update({ digest_rank: index + 1 }).eq('id', id)
    )
    if (unpinnedId) {
      writes.push(supabase.from(config.table).update({ digest_rank: null }).eq('id', unpinnedId))
    }

    const results = await Promise.all(writes)
    const failed = results.find((r) => r.error)

    setSaving(false)
    if (failed?.error) {
      setError(`Could not save the order: ${failed.error.message}`)
      load()
    }
  }

  /** Apply a new pinned ordering to local state, then persist it. */
  const apply = (config: SectionConfig, pinnedIds: string[], unpinnedId?: string) => {
    setSections((prev) => ({
      ...prev,
      [config.key]: prev[config.key].map((item) => {
        if (item.id === unpinnedId) return { ...item, digest_rank: null }
        const index = pinnedIds.indexOf(item.id)
        return index === -1 ? item : { ...item, digest_rank: index + 1 }
      }),
    }))
    persist(config, pinnedIds, unpinnedId)
  }

  const pinnedIdsOf = (key: SectionKey) =>
    inRunningOrder(sections[key]).filter((i) => i.digest_rank != null).map((i) => i.id)

  const handlePin = (config: SectionConfig, id: string) =>
    apply(config, [...pinnedIdsOf(config.key), id])

  const handleUnpin = (config: SectionConfig, id: string) =>
    apply(config, pinnedIdsOf(config.key).filter((pinnedId) => pinnedId !== id), id)

  const handleMove = (config: SectionConfig, id: string, direction: -1 | 1) => {
    const ids = pinnedIdsOf(config.key)
    const from = ids.indexOf(id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    apply(config, ids)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E4E4E8] p-5 flex justify-center">
        <Loader className="animate-spin" size={22} color="#D1D1D6" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E4E4E8] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F1F3]">
        <div className="flex items-center gap-2">
          <ListOrdered size={16} className="text-[#504F58]" />
          <h2 className="text-[15px] font-bold text-[#0F1F3D]">Running order</h2>
          {saving && <Loader size={13} className="animate-spin text-[#8A8F98]" />}
        </div>
        <p className="text-[13px] text-[#504F58] mt-1">
          Pin the items that should lead each section. Anything unpinned follows underneath in date
          order, newest first.
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
          <span className="text-[13px] text-red-800">{error}</span>
        </div>
      )}

      <div className="p-5 space-y-6">
        {SECTIONS.map((config) => {
          const ordered = inRunningOrder(sections[config.key])
          const pinnedCount = ordered.filter((i) => i.digest_rank != null).length

          return (
            <div key={config.key}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-[13px] font-bold text-[#0F1F3D]">{config.label}</h3>
                <span className="text-[11px] text-[#8A8F98]">
                  shows up to {config.limit}
                </span>
              </div>

              {ordered.length === 0 ? (
                <p className="text-[13px] text-[#8A8F98] py-3">
                  Nothing available. {config.hint}
                </p>
              ) : (
                <div className="border border-[#F1F1F3] rounded-xl overflow-hidden">
                  {ordered.map((item, index) => {
                    const isPinned = item.digest_rank != null
                    return (
                      <div key={item.id}>
                        {index === config.limit && (
                          <div className="px-3 py-1.5 bg-[#FAFAFA] border-y border-[#F1F1F3]">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#B3B7BE]">
                              Below here usually misses the cut
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-3 px-3 py-2.5 ${
                            index > 0 && index !== config.limit ? 'border-t border-[#F5F5F7]' : ''
                          } ${isPinned ? 'bg-[#FFFDF6]' : ''}`}
                        >
                          <span className="w-5 text-[12px] font-bold text-[#B3B7BE] shrink-0">
                            {index + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-[#181820] truncate">{item.title}</p>
                            <p className="text-[11px] text-[#8A8F98]">
                              {item.date
                                ? new Date(item.date).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                  })
                                : '—'}
                              {isPinned && <span className="text-[#B7791F] font-semibold"> · pinned</span>}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isPinned ? (
                              <>
                                <button
                                  onClick={() => handleMove(config, item.id, -1)}
                                  disabled={saving || index === 0}
                                  title="Move up"
                                  className="p-1.5 rounded-md text-[#504F58] hover:bg-[#F5F5F7] disabled:opacity-30"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  onClick={() => handleMove(config, item.id, 1)}
                                  disabled={saving || index === pinnedCount - 1}
                                  title="Move down"
                                  className="p-1.5 rounded-md text-[#504F58] hover:bg-[#F5F5F7] disabled:opacity-30"
                                >
                                  <ArrowDown size={14} />
                                </button>
                                <button
                                  onClick={() => handleUnpin(config, item.id)}
                                  disabled={saving}
                                  title="Unpin"
                                  className="p-1.5 rounded-md text-[#8A8F98] hover:bg-[#F5F5F7] disabled:opacity-30"
                                >
                                  <PinOff size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handlePin(config, item.id)}
                                disabled={saving}
                                title="Pin to the top of this section"
                                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-semibold text-[#504F58] hover:bg-[#F5F5F7] disabled:opacity-30"
                              >
                                <Pin size={13} /> Pin
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#F1F1F3]">
        <p className="text-[12px] text-[#8A8F98]">
          News and videos are only sent to a member if published since their last round-up, so the
          cut-off line is a guide rather than a guarantee &mdash; a member who last heard from you a
          while ago may see further down the list.
        </p>
      </div>
    </div>
  )
}
