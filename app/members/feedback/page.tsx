'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Loader, CheckCircle2, Send, Clock, EyeOff,
  MessageSquareHeart, Video, Calendar,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/use-auth'
import {
  SITE_FEEDBACK_STEPS,
  SITE_FEEDBACK_VERSION,
  SITE_FEEDBACK_MINUTES,
  SITE_FEATURES,
  missingRequired,
  promoteScalars,
  type Answers,
} from '@/lib/site-feedback-questions'
import StepProgress from '@/components/members/feedback/StepProgress'
import QuestionCard from '@/components/members/feedback/QuestionCard'

/** Namespaced by member so a shared machine can't cross-contaminate drafts. */
const draftKey = (userId: string) => `dukes:site-feedback:${SITE_FEEDBACK_VERSION}:${userId}`

const clearDraft = (userId: string) => {
  try {
    window.localStorage.removeItem(draftKey(userId))
  } catch {
    // Nothing to do — the response is safely stored either way.
  }
}

export default function SiteFeedbackPage() {
  const { user, profile, loading: authLoading } = useAuth()

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [errorIds, setErrorIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const isLastStep = step === SITE_FEEDBACK_STEPS.length - 1

  // ── Load: has this member already answered this round? ─────────────────────

  useEffect(() => {
    if (authLoading) return

    const load = async () => {
      if (!user) {
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('site_feedback_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('questionnaire_version', SITE_FEEDBACK_VERSION)
        .maybeSingle()

      if (existing) {
        setAlreadySubmitted(true)
        setLoading(false)
        return
      }

      // Restore an unfinished draft so a mid-survey reload isn't punished.
      try {
        const draft = window.localStorage.getItem(draftKey(user.id))
        if (draft) {
          const parsed = JSON.parse(draft)
          if (parsed && typeof parsed === 'object') {
            setAnswers(parsed.answers ?? {})
            setIsAnonymous(Boolean(parsed.isAnonymous))
          }
        }
      } catch {
        // A corrupt draft is not worth showing anyone an error over.
      }

      setLoading(false)
    }
    load()
  }, [authLoading, user])

  // ── Persist the draft on every change ──────────────────────────────────────

  useEffect(() => {
    if (!user || loading || submitted || alreadySubmitted) return
    try {
      window.localStorage.setItem(
        draftKey(user.id),
        JSON.stringify({ answers, isAnonymous }),
      )
    } catch {
      // Private browsing / quota. The survey still works, it just won't resume.
    }
  }, [answers, isAnonymous, user, loading, submitted, alreadySubmitted])

  // ── Answering ──────────────────────────────────────────────────────────────

  const handleAnswerChange = useCallback((questionId: string, value: unknown) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: value }

      // Un-ticking a feature in step 3 should drop any rating it picked up in
      // the grid, otherwise we'd submit scores for features they don't use.
      if (questionId === 'q_features_used' && Array.isArray(value)) {
        const liveIds = SITE_FEATURES.filter(f => value.includes(f.label)).map(f => f.id)
        const ratings = next['q_feature_value']
        if (ratings && typeof ratings === 'object') {
          const pruned: Record<string, number> = {}
          for (const [id, score] of Object.entries(ratings as Record<string, number>)) {
            if (liveIds.includes(id)) pruned[id] = score
          }
          next['q_feature_value'] = pruned
        }
      }

      return next
    })
    setErrorIds(prev => prev.filter(id => id !== questionId))
  }, [])

  /**
   * The members layout scrolls <main>, not the window, so window.scrollTo()
   * would silently do nothing here. Scrolling the top of the wizard into view
   * works whichever ancestor happens to be the scroll container.
   */
  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goToStep = (nextStep: number) => {
    setStep(nextStep)
    setErrorIds([])
    scrollToTop()
  }

  const handleNext = () => {
    const missing = missingRequired(step, answers)
    if (missing.length > 0) {
      setErrorIds(missing)
      document
        .getElementById(`question-${missing[0]}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (isLastStep) handleSubmit()
    else goToStep(step + 1)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!user) return

    setSubmitting(true)
    setError(null)

    const { ux_rating, nps_score } = promoteScalars(answers)

    const { error: insertErr } = await createClient()
      .from('site_feedback_responses')
      .insert({
        user_id: user.id,
        questionnaire_version: SITE_FEEDBACK_VERSION,
        answers,
        ux_rating,
        nps_score,
        is_anonymous: isAnonymous,
        role_at_submission: profile?.role ?? null,
        region_at_submission: profile?.region ?? null,
        training_stage_at_submission: profile?.training_stage ?? null,
      })

    if (insertErr) {
      // Two tabs, a double-click, or a stale tab: they've already answered.
      // That's not an error worth showing them a constraint violation over —
      // and their response is safely stored, so the draft can go.
      if (insertErr.code === '23505') {
        clearDraft(user.id)
        setAlreadySubmitted(true)
      } else if (insertErr.code === '42501') {
        setError('Your membership needs to be approved before you can send feedback.')
      } else {
        setError(insertErr.message || 'Something went wrong sending your feedback.')
      }
      setSubmitting(false)
      return
    }

    clearDraft(user.id)
    setSubmitted(true)
    setSubmitting(false)
    scrollToTop()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="animate-spin text-muted-foreground" size={28} />
      </div>
    )
  }

  if (submitted || alreadySubmitted) {
    return <ThankYou justSubmitted={submitted} answers={answers} />
  }

  const currentStep = SITE_FEEDBACK_STEPS[step]
  const StepIcon = currentStep.icon

  return (
    // Extra bottom padding below lg clears both the wizard's pinned controls
    // and the layout's mobile bottom nav underneath them.
    <div ref={topRef} className="mx-auto w-full max-w-2xl scroll-mt-4 pb-24 lg:pb-0">
      {/* Header */}
      <div className="mb-5 overflow-hidden rounded-xl bg-navy text-navy-foreground">
        <div className="h-1 bg-gold" />
        <div className="p-6">
          <Link
            href="/members"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-navy-foreground/70 transition-colors hover:text-navy-foreground"
          >
            <ArrowLeft size={13} /> Back to dashboard
          </Link>
          <h1 className="font-serif text-3xl font-bold leading-tight">
            Help us shape the members’ area
          </h1>
          <p className="mt-2 max-w-lg text-sm text-navy-foreground/80">
            We’re planning what to build next, and we’d rather hear it from you than guess.
            Your answers go to the Dukes’ Club committee.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy-foreground/10 px-3 py-1.5 text-xs font-medium">
            <Clock size={13} />
            About {SITE_FEEDBACK_MINUTES} minutes · {SITE_FEEDBACK_STEPS.length} short sections
          </div>
        </div>
      </div>

      <StepProgress current={step} />

      {/* Step heading */}
      <div key={currentStep.id} className="sf-step-enter">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground">
            <StepIcon size={19} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{currentStep.title}</h2>
            <p className="text-sm text-muted-foreground">{currentStep.subtitle}</p>
          </div>
        </div>

        <div className="space-y-4">
          {currentStep.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              answers={answers}
              onChange={handleAnswerChange}
              hasError={errorIds.includes(q.id)}
            />
          ))}
        </div>

        {/* Anonymity — a property of the whole response, not a question */}
        {isLastStep && (
          <Card className="mt-4 border-navy/20 bg-navy/5">
            <CardContent className="flex items-start gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-navy">
                <EyeOff size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    Don’t show my name against my answers
                  </h3>
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {isAnonymous
                    ? 'Your name and email won’t be shown to the committee alongside your answers. We still record that you’ve responded so we don’t ask you twice, and your answers are still tagged with your training grade and region — on a club this size, that may still narrow things down.'
                    : 'Leave this off and the committee can see it was you, and follow up if you’ve raised something they can help with.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {errorIds.length > 0 && (
        <p className="mt-4 text-right text-xs font-medium text-destructive">
          {errorIds.length} question{errorIds.length > 1 ? 's' : ''} left in this section
        </p>
      )}

      {/* Footer controls — pinned below lg so they're always thumb-reachable.
          bottom-16 clears the layout's mobile bottom nav (h-16, z-40), which
          would otherwise sit on top of the submit button. */}
      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button
          variant="ghost"
          onClick={() => goToStep(step - 1)}
          disabled={step === 0 || submitting}
          className={step === 0 ? 'invisible' : ''}
        >
          <ArrowLeft size={15} className="mr-1.5" /> Back
        </Button>

        <Button
          variant={isLastStep ? 'gold' : 'navy'}
          onClick={handleNext}
          disabled={submitting}
          size="lg"
        >
          {submitting ? (
            <Loader size={15} className="mr-1.5 animate-spin" />
          ) : isLastStep ? (
            <Send size={15} className="mr-1.5" />
          ) : null}
          {isLastStep ? 'Send feedback' : 'Continue'}
          {!isLastStep && <ArrowRight size={15} className="ml-1.5" />}
        </Button>
      </div>
    </div>
  )
}

// ── Thank-you / already-answered panel ───────────────────────────────────────

function ThankYou({ justSubmitted, answers }: { justSubmitted: boolean; answers: Answers }) {
  const nps = answers['q_nps']
  const suggestion = answers['q_suggestion']

  return (
    <div className="mx-auto w-full max-w-xl py-8">
      <Card className="border">
        <CardContent className="p-10 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 ring-8 ring-gold/5">
            <CheckCircle2 size={30} className="text-gold-foreground" />
          </span>

          <h1 className="font-serif text-3xl font-bold text-foreground">
            {justSubmitted ? 'Thank you' : 'You’ve already had your say'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {justSubmitted
              ? 'This genuinely shapes what we build next. We’ll report back on what changes in the Round-Up email.'
              : 'Your feedback for this round is already with the committee — thank you. We’ll open the questionnaire again next time we’re planning.'}
          </p>

          {justSubmitted && typeof nps === 'number' && (
            <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-5 text-left">
              <p className="text-sm font-semibold text-foreground">
                You rated us {nps}/10 — noted, and thank you.
              </p>
              {typeof suggestion === 'string' && suggestion.trim() && (
                <p className="mt-2 border-l-2 border-gold/40 pl-3 text-xs italic text-muted-foreground">
                  “{suggestion.trim().slice(0, 180)}
                  {suggestion.trim().length > 180 ? '…' : ''}”
                </p>
              )}
            </div>
          )}

          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            <OnwardTile href="/members/videos" icon={Video} label="Video archive" />
            <OnwardTile href="/events" icon={Calendar} label="Upcoming events" />
            <OnwardTile href="/members" icon={MessageSquareHeart} label="Dashboard" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OnwardTile({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof Video
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-xs font-medium text-muted-foreground transition-all hover:border-navy/30 hover:bg-muted/40 hover:text-foreground"
    >
      <Icon size={18} />
      {label}
    </Link>
  )
}
