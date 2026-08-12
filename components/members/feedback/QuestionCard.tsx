'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  LIKERT_LABELS,
  selectedFeatures,
  type Answers,
  type SiteFeedbackQuestion,
} from '@/lib/site-feedback-questions'
import StarRating from './StarRating'
import ScaleSelect from './ScaleSelect'
import OptionChips from './OptionChips'
import FeatureRatingGrid from './FeatureRatingGrid'

interface QuestionCardProps {
  question: SiteFeedbackQuestion
  /** Position within the current step, for the "1." prefix. */
  index: number
  answers: Answers
  onChange: (questionId: string, value: unknown) => void
  /** Set when the member tried to advance without answering a required question. */
  hasError: boolean
}

/**
 * Wraps one question in a card and renders the control for its type. This is
 * the only place the question-type union is matched, so adding a type here is
 * a compile error everywhere it needs to be.
 */
export default function QuestionCard({
  question: q,
  index,
  answers,
  onChange,
  hasError,
}: QuestionCardProps) {
  const value = answers[q.id]
  const set = (v: unknown) => onChange(q.id, v)

  return (
    <Card
      id={`question-${q.id}`}
      className={cn(
        'scroll-mt-32 border transition-all',
        hasError && 'border-destructive/50 ring-2 ring-destructive/20',
      )}
    >
      <CardContent className={cn('p-5', q.type === 'text' && q.prominent && 'p-6')}>
        <label
          className={cn(
            'mb-1 block font-semibold text-foreground',
            q.type === 'text' && q.prominent ? 'text-base' : 'text-sm',
          )}
        >
          <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
          {q.question}
          {q.required && <span className="ml-1 text-destructive">*</span>}
        </label>

        {q.help && <p className="mb-3 text-xs text-muted-foreground">{q.help}</p>}
        {!q.help && <div className="mb-3" />}

        {q.type === 'rating' && (
          <StarRating
            value={typeof value === 'number' ? value : undefined}
            onChange={set}
            label={q.question}
          />
        )}

        {q.type === 'nps' && (
          <ScaleSelect
            variant="nps"
            value={typeof value === 'number' ? value : undefined}
            onChange={set}
            lowLabel={q.lowLabel}
            highLabel={q.highLabel}
            label={q.question}
          />
        )}

        {q.type === 'likert' && (
          <ScaleSelect
            variant="likert"
            value={typeof value === 'number' ? value : undefined}
            onChange={set}
            lowLabel={q.lowLabel}
            highLabel={q.highLabel}
            label={q.question}
            pointLabels={LIKERT_LABELS}
          />
        )}

        {(q.type === 'multiple_choice' || q.type === 'multi_select') && (
          <OptionChips
            options={q.options}
            multi={q.type === 'multi_select'}
            value={value as string | string[] | undefined}
            onChange={set}
            label={q.question}
            exclusiveOption={q.exclusiveOption}
          />
        )}

        {q.type === 'feature_grid' && (
          <FeatureRatingGrid
            features={selectedFeatures(answers, q.dependsOn)}
            value={value as Record<string, number> | undefined}
            onChange={set}
          />
        )}

        {q.type === 'text' && (
          <>
            <Textarea
              value={typeof value === 'string' ? value : ''}
              onChange={e => set(e.target.value)}
              placeholder={q.placeholder}
              maxLength={q.maxLength}
              className={cn('resize-y', q.prominent ? 'min-h-[130px]' : 'min-h-[90px]')}
            />
            {q.maxLength && typeof value === 'string' && value.length > q.maxLength * 0.8 && (
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {value.length} / {q.maxLength}
              </p>
            )}
          </>
        )}

        {hasError && (
          <p className="mt-3 text-xs font-medium text-destructive">
            This one’s needed before you can continue.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
