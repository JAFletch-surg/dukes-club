'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Loader, MessageSquare, Users, Star, TrendingUp, EyeOff, Quote,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  SITE_FEATURES,
  SITE_FEEDBACK_STEPS,
  SITE_FEEDBACK_VERSION,
  LIKERT_LABELS,
  WANTED_FEATURE_OPTIONS,
  calculateNps,
  mean,
  npsBand,
  findQuestion,
  type Answers,
} from '@/lib/site-feedback-questions'

// ── Reading answers ──────────────────────────────────────────
// `answers` is JSONB, so every read is a narrowing. These also absorb drift:
// after the question set is edited, old rows simply have missing or
// unexpected keys, and every helper returns an empty value rather than throwing.

const answerList = (answers: Answers, id: string): string[] =>
  Array.isArray(answers?.[id]) ? (answers[id] as string[]) : []

const answerText = (answers: Answers, id: string): string =>
  typeof answers?.[id] === 'string' ? (answers[id] as string).trim() : ''

const featureScore = (answers: Answers, featureId: string): number | null => {
  const grid = answers?.['q_feature_value']
  if (!grid || typeof grid !== 'object') return null
  const value = (grid as Record<string, unknown>)[featureId]
  return typeof value === 'number' ? value : null
}

// ── Types ────────────────────────────────────────────────────
// Shape of the site_feedback_admin view. Note it has no user_id column: the
// view withholds it, and nulls full_name/email for anonymous responses.

interface FeedbackRow {
  id: string
  questionnaire_version: string
  answers: Answers
  ux_rating: number | null
  nps_score: number | null
  is_anonymous: boolean
  role_at_submission: string | null
  region_at_submission: string | null
  training_stage_at_submission: string | null
  submitted_at: string
  full_name: string | null
  email: string | null
}

const COMMITTEE_ROLES = ['admin', 'super_admin', 'editor']

/** Every free-text question, in the order we want to read them. */
const TEXT_QUESTION_IDS = [
  'q_suggestion',
  'q_ux_friction',
  'q_feature_improve',
  'q_content_gap',
  'q_anything_else',
]

const LIKERT_QUESTION_IDS = SITE_FEEDBACK_STEPS
  .flatMap(s => s.questions)
  .filter(q => q.type === 'likert')
  .map(q => q.id)

export default function AdminSiteFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [versions, setVersions] = useState<string[]>([])
  const [version, setVersion] = useState(SITE_FEEDBACK_VERSION)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [excludeCommittee, setExcludeCommittee] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data, error: err } = await supabase
        .from('site_feedback_admin')
        .select('*')
        .order('submitted_at', { ascending: false })

      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      const all = (data ?? []) as FeedbackRow[]
      const seen = Array.from(new Set(all.map(r => r.questionnaire_version))).sort().reverse()
      setVersions(seen.length > 0 ? seen : [SITE_FEEDBACK_VERSION])
      setRows(all)

      // Denominator for the response rate.
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'approved')
      setMemberCount(count ?? null)

      setLoading(false)
    }
    load()
  }, [])

  // ── Filtered set everything below is computed from ─────────

  const filtered = useMemo(() => {
    return rows
      .filter(r => r.questionnaire_version === version)
      .filter(r => !excludeCommittee || !COMMITTEE_ROLES.includes(r.role_at_submission ?? ''))
  }, [rows, version, excludeCommittee])

  // ── Aggregates ─────────────────────────────────────────────

  const stats = useMemo(() => {
    const npsScores = filtered.map(r => r.nps_score).filter((n): n is number => typeof n === 'number')
    const uxScores = filtered.map(r => r.ux_rating).filter((n): n is number => typeof n === 'number')

    // Feature usage and value. A feature nobody rated yields null, not NaN.
    const featureStats = SITE_FEATURES.map(f => {
      const usedBy = filtered.filter(r =>
        answerList(r.answers, 'q_features_used').includes(f.label),
      ).length
      const scores = filtered
        .map(r => featureScore(r.answers, f.id))
        .filter((v): v is number => v !== null)
      return { ...f, usedBy, avg: mean(scores), n: scores.length }
    })

    const likertStats = LIKERT_QUESTION_IDS.map(id => {
      const q = findQuestion(id)
      const values = filtered
        .map(r => r.answers?.[id])
        .filter((v): v is number => typeof v === 'number')
      const distribution = [1, 2, 3, 4, 5].map(
        point => values.filter(v => v === point).length,
      )
      return { id, question: q?.question ?? id, avg: mean(values), n: values.length, distribution }
    })

    const wantedStats = WANTED_FEATURE_OPTIONS.map(option => ({
      option,
      count: filtered.filter(r => answerList(r.answers, 'q_wanted').includes(option)).length,
    })).sort((a, b) => b.count - a.count)

    const deviceQuestion = findQuestion('q_device')
    const deviceStats =
      deviceQuestion && 'options' in deviceQuestion
        ? deviceQuestion.options.map(option => ({
            option,
            count: filtered.filter(r => r.answers?.q_device === option).length,
          }))
        : []

    const npsDistribution = Array.from({ length: 11 }, (_, score) => ({
      score,
      count: npsScores.filter(s => s === score).length,
    }))

    return {
      total: filtered.length,
      anonymous: filtered.filter(r => r.is_anonymous).length,
      nps: calculateNps(npsScores),
      npsCount: npsScores.length,
      npsDistribution,
      avgUx: mean(uxScores),
      promoters: npsScores.filter(s => npsBand(s) === 'promoter').length,
      passives: npsScores.filter(s => npsBand(s) === 'passive').length,
      detractors: npsScores.filter(s => npsBand(s) === 'detractor').length,
      featureStats,
      likertStats,
      wantedStats,
      deviceStats,
    }
  }, [filtered])

  const responseRate =
    memberCount && memberCount > 0 ? Math.round((stats.total / memberCount) * 100) : null

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="animate-spin text-muted-foreground" size={28} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Couldn’t load feedback: {error}
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Site Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What members think of the portal, and what they want built next.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {versions.length > 1 && (
            <select
              value={version}
              onChange={e => setVersion(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {versions.map(v => (
                <option key={v} value={v}>
                  Round {v}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setExcludeCommittee(v => !v)}
            className={cn(
              'h-9 rounded-md border px-3 text-xs font-semibold transition-colors',
              excludeCommittee
                ? 'border-navy bg-navy text-navy-foreground'
                : 'border-input bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            Exclude committee
          </button>
        </div>
      </div>

      {stats.total === 0 ? (
        <Card className="border">
          <CardContent className="p-14 text-center">
            <MessageSquare size={34} className="mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold text-foreground">No responses yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Members are invited from a card on their dashboard, which links to{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">/members/feedback</code>.
              Answers appear here as they come in.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Responses"
              value={stats.total}
              subtitle={
                responseRate !== null
                  ? `${responseRate}% of ${memberCount} approved members`
                  : undefined
              }
              icon={Users}
              tone="text-navy"
            />
            <Kpi
              label="Net promoter score"
              value={stats.nps ?? '–'}
              subtitle={`${stats.promoters} promoters · ${stats.detractors} detractors`}
              icon={TrendingUp}
              tone={
                stats.nps === null
                  ? 'text-muted-foreground'
                  : stats.nps >= 30
                    ? 'text-emerald-600'
                    : stats.nps >= 0
                      ? 'text-gold-foreground'
                      : 'text-destructive'
              }
            />
            <Kpi
              label="Look and feel"
              value={stats.avgUx !== null ? `${stats.avgUx}/5` : '–'}
              subtitle="Average star rating"
              icon={Star}
              tone="text-gold-foreground"
            />
            <Kpi
              label="Anonymous"
              value={stats.anonymous}
              subtitle={`${stats.total - stats.anonymous} named`}
              icon={EyeOff}
              tone="text-muted-foreground"
            />
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="ideas">Ideas</TabsTrigger>
              <TabsTrigger value="responses">Responses</TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <Section title="How members rate the experience" hint="Average of 1–5 agreement">
                <div className="space-y-4">
                  {stats.likertStats.map(l => (
                    <div key={l.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-4">
                        <p className="text-sm text-foreground">{l.question}</p>
                        <p className="shrink-0 text-sm font-bold text-foreground">
                          {l.avg !== null ? l.avg.toFixed(1) : '–'}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            n={l.n}
                          </span>
                        </p>
                      </div>
                      <StackedLikertBar distribution={l.distribution} total={l.n} />
                    </div>
                  ))}
                </div>
              </Section>

              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Recommendation spread" hint="0–10, coloured by NPS band">
                  <div className="flex items-end gap-1.5">
                    {stats.npsDistribution.map(({ score, count }) => {
                      const max = Math.max(...stats.npsDistribution.map(d => d.count), 1)
                      const band = npsBand(score)
                      return (
                        <div key={score} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {count > 0 ? count : ''}
                          </span>
                          <div
                            className={cn(
                              'w-full rounded-t transition-all',
                              band === 'detractor' && 'bg-destructive/70',
                              band === 'passive' && 'bg-gold',
                              band === 'promoter' && 'bg-emerald-600',
                              count === 0 && 'bg-muted',
                            )}
                            style={{ height: `${Math.max((count / max) * 90, 3)}px` }}
                          />
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {score}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Section>

                <Section title="Devices used" hint="Where members read the site">
                  <div className="space-y-2.5">
                    {stats.deviceStats.map(d => (
                      <CountBar
                        key={d.option}
                        label={d.option}
                        count={d.count}
                        total={stats.total}
                      />
                    ))}
                  </div>
                </Section>
              </div>
            </TabsContent>

            {/* ── Features ── */}
            <TabsContent value="features" className="space-y-4 pt-4">
              <Section
                title="How valuable each part is"
                hint="Mean 1–5 among members who use it, most valued first"
              >
                <div className="space-y-2.5">
                  {[...stats.featureStats]
                    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
                    .map(f => (
                      <div key={f.id} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 truncate text-xs text-foreground sm:w-44">
                          {f.label}
                        </span>
                        <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                          {f.avg !== null && (
                            <div
                              className="h-full rounded bg-[var(--color-chart-1)] transition-all"
                              // 1–5 mapped across the track, so a 1.0 is still visible.
                              style={{ width: `${((f.avg - 1) / 4) * 100}%` }}
                            />
                          )}
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs font-semibold text-foreground">
                          {f.avg !== null ? f.avg.toFixed(1) : '–'}
                          <span className="ml-1 font-normal text-muted-foreground">n={f.n}</span>
                        </span>
                      </div>
                    ))}
                </div>
              </Section>

              <Section title="How many members use each part" hint="Of everyone who responded">
                <div className="space-y-2.5">
                  {[...stats.featureStats]
                    .sort((a, b) => b.usedBy - a.usedBy)
                    .map(f => (
                      <CountBar
                        key={f.id}
                        label={f.label}
                        count={f.usedBy}
                        total={stats.total}
                        tone="bg-[var(--color-chart-3)]"
                      />
                    ))}
                </div>
              </Section>
            </TabsContent>

            {/* ── Ideas ── */}
            <TabsContent value="ideas" className="space-y-4 pt-4">
              <Section title="What members would use if we built it" hint="Ranked by demand">
                <div className="space-y-2.5">
                  {stats.wantedStats.map(w => (
                    <CountBar
                      key={w.option}
                      label={w.option}
                      count={w.count}
                      total={stats.total}
                      tone="bg-gold"
                    />
                  ))}
                </div>
              </Section>

              <Section
                title="“If we could build one thing…”"
                hint="Every answer to the headline suggestion question"
              >
                <div className="space-y-3">
                  {filtered
                    .filter(r => answerText(r.answers, 'q_suggestion'))
                    .map(r => (
                      <blockquote
                        key={r.id}
                        className="rounded-lg border-l-2 border-gold bg-muted/30 p-3.5"
                      >
                        <Quote size={13} className="mb-1.5 text-gold" />
                        <p className="text-sm text-foreground">
                          {answerText(r.answers, 'q_suggestion')}
                        </p>
                        <Attribution row={r} />
                      </blockquote>
                    ))}
                  {filtered.every(r => !answerText(r.answers, 'q_suggestion')) && (
                    <p className="text-sm text-muted-foreground">No suggestions in this round yet.</p>
                  )}
                </div>
              </Section>
            </TabsContent>

            {/* ── Responses ── */}
            <TabsContent value="responses" className="space-y-4 pt-4">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search written answers…"
                className="max-w-sm"
              />
              <div className="space-y-3">
                {filtered
                  .filter(r => {
                    if (!search.trim()) return true
                    const haystack = TEXT_QUESTION_IDS
                      .map(id => answerText(r.answers, id))
                      .join(' ')
                      .toLowerCase()
                    return haystack.includes(search.trim().toLowerCase())
                  })
                  .map(r => (
                    <Card key={r.id} className="border">
                      <CardContent className="p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <Attribution row={r} inline />
                          <div className="flex items-center gap-1.5">
                            {typeof r.nps_score === 'number' && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px]',
                                  npsBand(r.nps_score) === 'promoter' && 'border-emerald-300 text-emerald-700',
                                  npsBand(r.nps_score) === 'passive' && 'border-gold/50 text-gold-foreground',
                                  npsBand(r.nps_score) === 'detractor' && 'border-destructive/40 text-destructive',
                                )}
                              >
                                NPS {r.nps_score}
                              </Badge>
                            )}
                            {typeof r.ux_rating === 'number' && (
                              <Badge variant="outline" className="text-[10px]">
                                {r.ux_rating}/5 look &amp; feel
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {TEXT_QUESTION_IDS.map(id => {
                            const value = answerText(r.answers, id)
                            if (!value) return null
                            return (
                              <div key={id}>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {findQuestion(id)?.question ?? id}
                                </p>
                                <p className="mt-0.5 text-sm text-foreground">{value}</p>
                              </div>
                            )
                          })}
                          {TEXT_QUESTION_IDS.every(id => !answerText(r.answers, id)) && (
                            <p className="text-sm italic text-muted-foreground">
                              Scores only — no written answers.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

// ── Small presentational pieces ──────────────────────────────

function Kpi({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  subtitle?: string
  icon: typeof Users
  tone: string
}) {
  return (
    <Card className="border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className={cn('text-3xl font-bold', tone)}>{value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
          <Icon size={20} className="shrink-0 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <Card className="border">
      <CardContent className="p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

/** 100%-stacked strongly-disagree → strongly-agree bar. */
function StackedLikertBar({ distribution, total }: { distribution: number[]; total: number }) {
  const tones = [
    'bg-destructive/70',
    'bg-destructive/35',
    'bg-muted-foreground/25',
    'bg-emerald-500/50',
    'bg-emerald-600',
  ]
  if (total === 0) {
    return <div className="h-4 rounded bg-muted" />
  }
  return (
    <div className="flex h-4 overflow-hidden rounded">
      {distribution.map((count, i) => (
        <div
          key={i}
          className={tones[i]}
          style={{ width: `${(count / total) * 100}%` }}
          title={`${LIKERT_LABELS[i]}: ${count}`}
        />
      ))}
    </div>
  )
}

function CountBar({
  label,
  count,
  total,
  tone = 'bg-[var(--color-chart-1)]',
}: {
  label: string
  count: number
  total: number
  tone?: string
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-xs text-foreground sm:w-44">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
        <div className={cn('h-full rounded transition-all', tone)} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-semibold text-foreground">
        {count}
        <span className="ml-1 font-normal text-muted-foreground">{percent}%</span>
      </span>
    </div>
  )
}

/**
 * Who said it. Anonymous responses show no name, no role and only a
 * month-level date — an exact timestamp plus a grade is enough to identify
 * someone in a club this size.
 */
function Attribution({ row, inline }: { row: FeedbackRow; inline?: boolean }) {
  const date = new Date(row.submitted_at)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', !inline && 'mt-2')}>
      {row.is_anonymous ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <EyeOff size={11} /> Anonymous member
        </span>
      ) : (
        <span className="text-xs font-semibold text-foreground">{row.full_name}</span>
      )}
      {!row.is_anonymous && row.role_at_submission && (
        <Badge variant="outline" className="text-[10px] capitalize">
          {row.role_at_submission.replace('_', ' ')}
        </Badge>
      )}
      {row.training_stage_at_submission && (
        <Badge variant="outline" className="text-[10px]">
          {row.training_stage_at_submission}
        </Badge>
      )}
      {row.region_at_submission && (
        <Badge variant="outline" className="text-[10px]">
          {row.region_at_submission}
        </Badge>
      )}
      <span className="text-[11px] text-muted-foreground">
        {row.is_anonymous
          ? date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
          : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    </div>
  )
}
