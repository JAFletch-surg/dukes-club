'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowUp, ArrowDown, X, Plus, Loader, ListOrdered, AlertTriangle, Search } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

// Curation for the round-up email.
//
// Each section has two halves: the items an admin chose (ordered, always sent)
// and an auto-fill switch controlling whether the remaining slots top up by
// date. Choosing nothing and leaving auto-fill on is the default, and behaves
// exactly as the digest did before curation existed.
//
// Ordering is stored as a sort key (`digest_rank`) rather than a hand-built
// issue, because the digest is personalised: two members opening the same send
// can receive different subsets, and one global order applies to both.

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
  noun: string
  /** How many the email shows at most — mirrors MAX_* in lib/emails/digest.ts. */
  limit: number
  dateField: string
  autofillColumn: string
  autofillHint: string
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'events',
    table: 'events',
    label: 'Upcoming events',
    noun: 'event',
    limit: 4,
    dateField: 'starts_at',
    autofillColumn: 'events_autofill',
    autofillHint: 'the next events coming up',
  },
  {
    key: 'posts',
    table: 'posts',
    label: 'Latest news',
    noun: 'post',
    limit: 5,
    dateField: 'published_at',
    autofillColumn: 'posts_autofill',
    autofillHint: 'whatever has been published since each member last heard from you',
  },
  {
    key: 'videos',
    table: 'videos',
    label: 'New in the video library',
    noun: 'video',
    limit: 3,
    dateField: 'published_at',
    autofillColumn: 'videos_autofill',
    autofillHint: 'whatever has been published since each member last heard from you',
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

type AutofillState = Record<SectionKey, boolean>

const MIGRATION_HINT =
  "The auto-fill settings table hasn't been created yet. Run supabase/add-digest-curation.sql in the Supabase SQL editor, then reload this page."

/** PostgREST reports an un-migrated table as PGRST205 / "Could not find the table". */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || /could not find the table/i.test(error.message || '')
}

export default function DigestRunningOrder() {
  const supabase = createClient()
  const [sections, setSections] = useState<Record<SectionKey, OrderItem[]>>({ events: [], posts: [], videos: [] })
  const [autofill, setAutofill] = useState<AutofillState>({ events: true, posts: true, videos: true })
  const [search, setSearch] = useState<Record<SectionKey, string>>({ events: '', posts: '', videos: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The rest of the panel works without digest_settings; only the switches need it.
  const [settingsMissing, setSettingsMissing] = useState(false)

  const load = useCallback(async () => {
    const now = new Date()
    const lookback = new Date(now.getTime() - 60 * DAY_MS).toISOString()
    const horizon = new Date(now.getTime() + 105 * DAY_MS).toISOString()

    // Chosen rows are fetched regardless of the date window, matching the
    // sender — otherwise an older featured video would vanish from this list
    // while still going out in the email.
    const [events, posts, videos, settings] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, starts_at, digest_rank')
        .eq('status', 'published')
        .gte('starts_at', now.toISOString())
        .or(`starts_at.lte.${horizon},digest_rank.not.is.null`)
        .order('digest_rank', { ascending: true, nullsFirst: false })
        .order('starts_at', { ascending: true })
        .limit(40),
      supabase
        .from('posts')
        .select('id, title, published_at, digest_rank')
        .eq('status', 'published')
        .lte('published_at', now.toISOString())
        .or(`published_at.gte.${lookback},digest_rank.not.is.null`)
        .order('digest_rank', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false })
        .limit(40),
      supabase
        .from('videos')
        .select('id, title, published_at, digest_rank')
        .eq('status', 'published')
        .lte('published_at', now.toISOString())
        .or(`published_at.gte.${lookback},digest_rank.not.is.null`)
        .order('digest_rank', { ascending: true, nullsFirst: false })
        .order('published_at', { ascending: false })
        .limit(40),
      supabase.from('digest_settings').select('events_autofill, posts_autofill, videos_autofill').maybeSingle(),
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

    // Report a missing settings table up front rather than letting the first
    // switch fail mysteriously. Everything else on the panel still works.
    if (isMissingTable(settings.error)) {
      setSettingsMissing(true)
    } else if (settings.error) {
      setError(`Could not load the auto-fill settings: ${settings.error.message}`)
    } else if (settings.data) {
      setSettingsMissing(false)
      setAutofill({
        events: settings.data.events_autofill,
        posts: settings.data.posts_autofill,
        videos: settings.data.videos_autofill,
      })
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  /** Search the whole table, not just the rows already loaded. */
  const runSearch = async (config: SectionConfig, query: string) => {
    setSearch((prev) => ({ ...prev, [config.key]: query }))
    if (query.trim().length < 2) return

    const { data, error: searchError } = await supabase
      .from(config.table)
      .select(`id, title, ${config.dateField}, digest_rank`)
      .eq('status', 'published')
      .ilike('title', `%${query.trim()}%`)
      .order(config.dateField, { ascending: false })
      .limit(20)

    if (searchError) {
      setError(`Search failed: ${searchError.message}`)
      return
    }

    // The date column is picked per section, so the select string can't be a
    // literal and Supabase's type-level parser can't read it — hence the cast.
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>

    // Merge results in without dropping anything already chosen.
    setSections((prev) => {
      const existing = new Map(prev[config.key].map((i) => [i.id, i]))
      for (const row of rows) {
        const id = String(row.id)
        if (!existing.has(id)) {
          existing.set(id, {
            id,
            title: String(row.title),
            date: (row[config.dateField] as string | null) ?? null,
            digest_rank: (row.digest_rank as number | null) ?? null,
          })
        }
      }
      return { ...prev, [config.key]: [...existing.values()] }
    })
  }

  /** Rewrite a section's chosen order as a dense 1..n sequence. */
  const persistOrder = async (config: SectionConfig, chosenIds: string[], removedId?: string) => {
    setSaving(true)
    setError(null)

    const writes = chosenIds.map((id, index) =>
      supabase.from(config.table).update({ digest_rank: index + 1 }).eq('id', id)
    )
    if (removedId) {
      writes.push(supabase.from(config.table).update({ digest_rank: null }).eq('id', removedId))
    }

    const results = await Promise.all(writes)
    const failed = results.find((r) => r.error)
    setSaving(false)

    if (failed?.error) {
      setError(`Could not save: ${failed.error.message}`)
      load()
    }
  }

  const apply = (config: SectionConfig, chosenIds: string[], removedId?: string) => {
    setSections((prev) => ({
      ...prev,
      [config.key]: prev[config.key].map((item) => {
        if (item.id === removedId) return { ...item, digest_rank: null }
        const index = chosenIds.indexOf(item.id)
        return index === -1 ? item : { ...item, digest_rank: index + 1 }
      }),
    }))
    persistOrder(config, chosenIds, removedId)
  }

  const chosenOf = (key: SectionKey) =>
    sections[key]
      .filter((i) => i.digest_rank != null)
      .sort((a, b) => (a.digest_rank as number) - (b.digest_rank as number))

  const availableOf = (key: SectionKey) => {
    const query = search[key].trim().toLowerCase()
    return sections[key]
      .filter((i) => i.digest_rank == null)
      .filter((i) => !query || i.title.toLowerCase().includes(query))
  }

  const handleAdd = (config: SectionConfig, id: string) =>
    apply(config, [...chosenOf(config.key).map((i) => i.id), id])

  const handleRemove = (config: SectionConfig, id: string) =>
    apply(config, chosenOf(config.key).map((i) => i.id).filter((chosenId) => chosenId !== id), id)

  const handleMove = (config: SectionConfig, id: string, direction: -1 | 1) => {
    const ids = chosenOf(config.key).map((i) => i.id)
    const from = ids.indexOf(id)
    const to = from + direction
    if (from === -1 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    apply(config, ids)
  }

  const handleAutofill = async (config: SectionConfig, enabled: boolean) => {
    const previous = autofill[config.key]
    setAutofill((prev) => ({ ...prev, [config.key]: enabled }))
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('digest_settings')
      .update({ [config.autofillColumn]: enabled })
      .eq('id', true)

    setSaving(false)
    if (!updateError) return

    // Put the switch back where it was. Reloading can't do this when the table
    // is missing — there is nothing to read the true value from — and leaving
    // it flipped would claim a section is curated when it is still filling
    // itself, which is worse than the error itself.
    setAutofill((prev) => ({ ...prev, [config.key]: previous }))
    if (isMissingTable(updateError)) {
      setSettingsMissing(true)
    } else {
      setError(`Could not save: ${updateError.message}`)
    }
  }

  const fmtDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

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
          <h2 className="text-[15px] font-bold text-[#0F1F3D]">What goes in the next round-up</h2>
          {saving && <Loader size={13} className="animate-spin text-[#8A8F98]" />}
        </div>
        <p className="text-[13px] text-[#504F58] mt-1">
          Choose the items you want to lead each section. Leave a section empty to let it fill
          itself, exactly as it does now.
        </p>
      </div>

      {settingsMissing && (
        <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-[13px] text-amber-900">
            <p className="font-semibold">Auto-fill can&rsquo;t be changed yet</p>
            <p className="mt-0.5">{MIGRATION_HINT}</p>
            <p className="mt-1 text-amber-800">
              Choosing and ordering items still works, and every section fills automatically in the
              meantime.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
          <span className="text-[13px] text-red-800">{error}</span>
        </div>
      )}

      <div className="p-5 space-y-7">
        {SECTIONS.map((config) => {
          const chosen = chosenOf(config.key)
          const available = availableOf(config.key)
          const fills = autofill[config.key]
          const remaining = Math.max(0, config.limit - chosen.length)

          return (
            <div key={config.key} className="border border-[#EFEFF2] rounded-xl overflow-hidden">
              <div className="flex items-baseline justify-between px-4 py-3 bg-[#FAFAFA] border-b border-[#EFEFF2]">
                <h3 className="text-[13px] font-bold text-[#0F1F3D]">{config.label}</h3>
                <span className="text-[11px] text-[#8A8F98]">shows up to {config.limit}</span>
              </div>

              {/* Chosen */}
              <div className="px-4 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8F98] mb-2">
                  In the next round-up
                </p>

                {chosen.length === 0 ? (
                  <p className="text-[13px] text-[#8A8F98] pb-3">
                    Nothing chosen.{' '}
                    {fills
                      ? `The email will pick from ${config.autofillHint} automatically.`
                      : 'With auto-fill off, this section will be left out of the email entirely.'}
                  </p>
                ) : (
                  <div className="space-y-1 pb-1">
                    {chosen.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#FFFDF6] border border-[#F3E4BF]"
                      >
                        <span className="w-4 text-[12px] font-bold text-[#B7791F] shrink-0">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-[#181820] truncate">{item.title}</p>
                          <p className="text-[11px] text-[#8A8F98]">{fmtDate(item.date)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => handleMove(config, item.id, -1)}
                            disabled={saving || index === 0}
                            title="Move up"
                            className="p-1.5 rounded-md text-[#504F58] hover:bg-white disabled:opacity-25"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMove(config, item.id, 1)}
                            disabled={saving || index === chosen.length - 1}
                            title="Move down"
                            className="p-1.5 rounded-md text-[#504F58] hover:bg-white disabled:opacity-25"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            onClick={() => handleRemove(config, item.id)}
                            disabled={saving}
                            title="Remove from the round-up"
                            className="p-1.5 rounded-md text-[#8A8F98] hover:bg-white hover:text-red-600 disabled:opacity-25"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Auto-fill */}
              <div className="flex items-center justify-between gap-4 px-4 py-3 mt-2 border-t border-[#F5F5F7]">
                <div>
                  <p className="text-[13px] font-semibold text-[#181820]">
                    Fill the remaining {remaining === 1 ? 'slot' : 'slots'} automatically
                  </p>
                  <p className="text-[12px] text-[#8A8F98] mt-0.5">
                    {fills
                      ? chosen.length > 0
                        ? `${chosen.length} chosen ${chosen.length === 1 ? `${config.noun} leads` : `${config.noun}s lead`}, then up to ${remaining} more picked from ${config.autofillHint}.`
                        : `Picked from ${config.autofillHint}.`
                      : chosen.length > 0
                        ? `Off — the email sends exactly these ${chosen.length}, and nothing else.`
                        : 'Off — and nothing chosen, so this section will be left out.'}
                  </p>
                </div>
                <Switch
                  checked={fills}
                  disabled={saving || settingsMissing}
                  onCheckedChange={(checked) => handleAutofill(config, checked)}
                />
              </div>

              {chosen.length > 0 && (
                <div className="px-4 pb-3">
                  <p className="text-[12px] text-[#8A6100] bg-[#FFFBEB] border border-[#F3E4BF] rounded-lg px-3 py-2">
                    Chosen items go to <strong>every</strong> member of this section, including those
                    who have already seen them, and stay in every issue until you remove them.
                  </p>
                </div>
              )}

              {/* Add */}
              <div className="px-4 py-3 border-t border-[#F5F5F7] bg-[#FCFCFD]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8F98]">
                    Add {config.noun === 'event' ? 'an' : 'a'} {config.noun}
                  </p>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#B3B7BE]" />
                    <input
                      value={search[config.key]}
                      onChange={(e) => runSearch(config, e.target.value)}
                      placeholder="Search by title..."
                      className="w-44 sm:w-56 pl-7 pr-2 py-1.5 rounded-lg border border-[#E4E4E8] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#0F1F3D]/10 focus:border-[#0F1F3D]/30"
                    />
                  </div>
                </div>

                {available.length === 0 ? (
                  <p className="text-[13px] text-[#8A8F98] py-1">
                    {search[config.key].trim()
                      ? 'Nothing matches that search.'
                      : `No other published ${config.noun}s available.`}
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto -mx-1 px-1">
                    {available.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAdd(config, item.id)}
                        disabled={saving}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-white disabled:opacity-40"
                      >
                        <Plus size={14} className="text-[#8A8F98] shrink-0" />
                        <span className="min-w-0 flex-1 text-[13px] text-[#181820] truncate">{item.title}</span>
                        <span className="text-[11px] text-[#B3B7BE] shrink-0">{fmtDate(item.date)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
