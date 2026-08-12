import {
  Video, Play, Mic, BookOpen, FileText, Globe, Users, MessageSquare,
  Calendar, Award, Mail, Sparkles, Palette, LayoutGrid, Lightbulb,
  type LucideIcon,
} from 'lucide-react'

// =============================================================================
// THE DUKES' CLUB — Site feedback questionnaire
// =============================================================================
// The whole survey lives here. The member wizard (app/members/feedback), the
// results dashboard (app/admin/feedback) and the aggregation all read this one
// file, so revising the survey is a single-file edit reviewed like any other
// code change — there is no admin form builder and no question rows in the
// database.
//
// TWO RULES:
//
//   1. A question id, once used, NEVER changes meaning. Answers are stored as
//      JSONB keyed by these ids, so reusing `q_ux_speed` for a different
//      question silently corrupts every historic response. Retire an id and
//      add a new one instead.
//
//   2. Bump SITE_FEEDBACK_VERSION to open a NEW ROUND. The unique constraint
//      is (user_id, questionnaire_version), so a bump re-asks every member and
//      keeps the previous round intact for comparison. Fixing a typo does not
//      need a bump; materially changing what you are asking does.
//
// HOW EACH ANSWER IS STORED in the `answers` JSONB column:
//
//   rating          number 1–5
//   likert          number 1–5
//   nps             number 0–10
//   multiple_choice string (the option label, verbatim)
//   multi_select    string[] (option labels, verbatim)
//   feature_grid    Record<featureId, number>   — features left unrated are
//                                                 simply absent from the object
//   text            string
// =============================================================================

/** Bump to open a fresh round. See rule 2 above. */
export const SITE_FEEDBACK_VERSION = '2026-08'

/** Roughly how long the survey takes, shown to members up front. */
export const SITE_FEEDBACK_MINUTES = 3

// ── Features ─────────────────────────────────────────────────────────────────
// Ids are stable keys stored inside `answers`; labels are what members and
// admins read. Order matches the members' sidebar so the list feels familiar.

export interface SiteFeature {
  id: string
  label: string
  icon: LucideIcon
  blurb: string
}

export const SITE_FEATURES: SiteFeature[] = [
  { id: 'videos', label: 'Video Archive', icon: Video, blurb: 'Recorded talks and operative video' },
  { id: 'webinars', label: 'Live Webinars', icon: Play, blurb: 'Live sessions and Q&A' },
  { id: 'podcasts', label: 'Podcasts', icon: Mic, blurb: 'Audio episodes and interviews' },
  { id: 'frcs', label: 'FRCS Resources', icon: BookOpen, blurb: 'Exam revision material' },
  { id: 'questions', label: 'Question Bank', icon: FileText, blurb: 'Practice questions and mock papers' },
  { id: 'fellowships', label: 'Fellowships', icon: Globe, blurb: 'Searchable fellowship database' },
  { id: 'directory', label: 'Member Directory', icon: Users, blurb: 'Finding other members' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, blurb: 'Messaging other members' },
  { id: 'events', label: 'Events & booking', icon: Calendar, blurb: 'Courses, meetings and booking' },
  { id: 'certificates', label: 'Certificates', icon: Award, blurb: 'Attendance and CPD certificates' },
  { id: 'roundup', label: 'Round-Up email', icon: Mail, blurb: 'The regular what’s-new email' },
]

export const FEATURE_LABELS = SITE_FEATURES.map(f => f.label)

// ── Question types ───────────────────────────────────────────────────────────

export type SiteFeedbackQuestionType =
  | 'rating'
  | 'likert'
  | 'nps'
  | 'multiple_choice'
  | 'multi_select'
  | 'feature_grid'
  | 'text'

interface BaseQuestion {
  id: string
  question: string
  /** Smaller print under the question. */
  help?: string
  required: boolean
}

export interface RatingQuestion extends BaseQuestion { type: 'rating' }
export interface LikertQuestion extends BaseQuestion {
  type: 'likert'
  lowLabel: string
  highLabel: string
}
export interface NpsQuestion extends BaseQuestion {
  type: 'nps'
  lowLabel: string
  highLabel: string
}
export interface ChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice' | 'multi_select'
  options: string[]
  /** Option that clears every other selection when picked, and vice versa. */
  exclusiveOption?: string
}
export interface FeatureGridQuestion extends BaseQuestion {
  type: 'feature_grid'
  /** Id of the multi_select whose chosen feature labels become the grid rows. */
  dependsOn: string
}
export interface TextQuestion extends BaseQuestion {
  type: 'text'
  placeholder: string
  maxLength?: number
  /** Renders larger, for the questions we most want a real answer to. */
  prominent?: boolean
}

export type SiteFeedbackQuestion =
  | RatingQuestion
  | LikertQuestion
  | NpsQuestion
  | ChoiceQuestion
  | FeatureGridQuestion
  | TextQuestion

export interface SiteFeedbackStep {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  questions: SiteFeedbackQuestion[]
}

export type Answers = Record<string, unknown>

// ── Scale labels ─────────────────────────────────────────────────────────────

export const LIKERT_LABELS = [
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
] as const

export const FEATURE_VALUE_LABELS = [
  'Not useful',
  'Slightly useful',
  'Useful',
  'Very useful',
  'Essential',
] as const

/** Things members might want us to build. Kept broad on purpose. */
export const WANTED_FEATURE_OPTIONS = [
  'Operative logbook tools',
  'Mock FRCS viva booking',
  'Post-CCT and fellowship job board',
  'Research and audit collaboration board',
  'Regional or deanery sub-groups',
  'Mentorship matching',
  'Downloadable slides and handouts',
  'A discussion forum',
  'Trainee-led guideline library',
  'CPD tracker and reflective log',
  'A mobile app',
]

// ── The survey ───────────────────────────────────────────────────────────────

export const SITE_FEEDBACK_STEPS: SiteFeedbackStep[] = [
  {
    id: 'impressions',
    title: 'First impressions',
    subtitle: 'Two quick questions to set the scene.',
    icon: Sparkles,
    questions: [
      {
        id: 'q_nps',
        type: 'nps',
        question: 'How likely are you to recommend the members’ area to a colleague?',
        required: true,
        lowLabel: 'Not at all likely',
        highLabel: 'Extremely likely',
      },
      {
        id: 'q_overall',
        type: 'rating',
        question: 'Overall, how would you rate the look and feel of the members’ area?',
        required: true,
      },
    ],
  },
  {
    id: 'experience',
    title: 'Look and feel',
    subtitle: 'How well the site works for you day to day.',
    icon: Palette,
    questions: [
      {
        id: 'q_ux_navigate',
        type: 'likert',
        question: 'I can find what I’m looking for without hunting around.',
        required: true,
        lowLabel: 'Strongly disagree',
        highLabel: 'Strongly agree',
      },
      {
        id: 'q_ux_design',
        type: 'likert',
        question: 'The site looks professional and befits the Club.',
        required: true,
        lowLabel: 'Strongly disagree',
        highLabel: 'Strongly agree',
      },
      {
        id: 'q_ux_mobile',
        type: 'likert',
        question: 'It works well on my phone or tablet.',
        required: false,
        lowLabel: 'Strongly disagree',
        highLabel: 'Strongly agree',
      },
      {
        id: 'q_ux_speed',
        type: 'likert',
        question: 'Pages load quickly enough.',
        required: false,
        lowLabel: 'Strongly disagree',
        highLabel: 'Strongly agree',
      },
      {
        id: 'q_ux_clarity',
        type: 'likert',
        question: 'It’s clear what my membership gives me access to.',
        required: false,
        lowLabel: 'Strongly disagree',
        highLabel: 'Strongly agree',
      },
      {
        id: 'q_device',
        type: 'multiple_choice',
        question: 'Which device do you mostly use?',
        required: true,
        options: ['Phone', 'Tablet', 'Laptop or desktop', 'A mix'],
      },
      {
        id: 'q_ux_friction',
        type: 'text',
        question: 'Anything confusing, broken or frustrating?',
        help: 'Tell us where you were and what happened — the more specific, the more fixable.',
        required: false,
        placeholder: 'e.g. On the question bank I couldn’t work out how to resume a paused session…',
        maxLength: 1000,
      },
    ],
  },
  {
    id: 'features',
    title: 'What you use',
    subtitle: 'So we only ask you about the parts you know.',
    icon: LayoutGrid,
    questions: [
      {
        id: 'q_features_used',
        type: 'multi_select',
        question: 'Which parts of the members’ area have you used in the last six months?',
        help: 'Tick all that apply. We’ll only ask you to rate these.',
        required: true,
        options: [...FEATURE_LABELS],
        exclusiveOption: 'None of these yet',
      },
      {
        id: 'q_feature_value',
        type: 'feature_grid',
        question: 'How valuable is each one to you?',
        required: false,
        dependsOn: 'q_features_used',
      },
      {
        id: 'q_feature_improve',
        type: 'text',
        question: 'Pick one of those and tell us how we’d make it better.',
        required: false,
        placeholder: 'e.g. The video archive would be far more useful if I could filter by subspecialty…',
        maxLength: 1000,
      },
    ],
  },
  {
    id: 'ideas',
    title: 'What’s missing',
    subtitle: 'The part that actually shapes next year’s roadmap.',
    icon: Lightbulb,
    questions: [
      {
        id: 'q_suggestion',
        type: 'text',
        question: 'If we could build one thing for you in the next year, what would it be?',
        help: 'Anything at all — a feature, a resource, a change to how something works.',
        required: true,
        placeholder: 'The one thing that would make this site genuinely more useful to me is…',
        maxLength: 1000,
        prominent: true,
      },
      {
        id: 'q_wanted',
        type: 'multi_select',
        question: 'Which of these would you actually use if we built it?',
        required: false,
        options: WANTED_FEATURE_OPTIONS,
      },
      {
        id: 'q_content_gap',
        type: 'text',
        question: 'Any topics or exam areas you’d like more content on?',
        required: false,
        placeholder: 'e.g. More on pelvic floor, or IBD surgery vivas…',
        maxLength: 500,
      },
      {
        id: 'q_anything_else',
        type: 'text',
        question: 'Anything else you’d like the committee to know?',
        required: false,
        placeholder: 'Optional — the floor is yours.',
        maxLength: 1000,
      },
    ],
  },
]

// ── Derived helpers ──────────────────────────────────────────────────────────
// Pure functions with no React and no Supabase, so the admin page can import
// them without dragging the wizard in.

export const ALL_QUESTIONS: SiteFeedbackQuestion[] =
  SITE_FEEDBACK_STEPS.flatMap(s => s.questions)

export function findQuestion(id: string): SiteFeedbackQuestion | undefined {
  return ALL_QUESTIONS.find(q => q.id === id)
}

/** Has this question been given a usable answer? Note 0 is valid for NPS. */
export function isAnswered(q: SiteFeedbackQuestion, value: unknown): boolean {
  if (value === undefined || value === null) return false
  switch (q.type) {
    case 'text':
      return typeof value === 'string' && value.trim().length > 0
    case 'multi_select':
      return Array.isArray(value) && value.length > 0
    case 'feature_grid':
      return typeof value === 'object' && Object.keys(value as object).length > 0
    case 'nps':
    case 'rating':
    case 'likert':
      return typeof value === 'number'
    default:
      return value !== ''
  }
}

/**
 * Which features the member ticked on the "what do you use" question, resolved
 * back to SiteFeature objects. Drives the rows of the feature grid.
 */
export function selectedFeatures(answers: Answers, dependsOn: string): SiteFeature[] {
  const picked = answers[dependsOn]
  if (!Array.isArray(picked)) return []
  return SITE_FEATURES.filter(f => picked.includes(f.label))
}

/** Ids of required questions on this step that still need an answer. */
export function missingRequired(stepIndex: number, answers: Answers): string[] {
  const step = SITE_FEEDBACK_STEPS[stepIndex]
  if (!step) return []
  return step.questions
    .filter(q => q.required)
    .filter(q => !isAnswered(q, answers[q.id]))
    .map(q => q.id)
}

/**
 * The two headline scores, lifted out of `answers` into their own columns so
 * the results page can aggregate without unpacking JSONB per row.
 */
export function promoteScalars(answers: Answers): {
  ux_rating: number | null
  nps_score: number | null
} {
  const ux = answers['q_overall']
  const nps = answers['q_nps']
  return {
    ux_rating: typeof ux === 'number' ? ux : null,
    nps_score: typeof nps === 'number' ? nps : null,
  }
}

export type NpsBand = 'detractor' | 'passive' | 'promoter'

export function npsBand(score: number): NpsBand {
  if (score <= 6) return 'detractor'
  if (score <= 8) return 'passive'
  return 'promoter'
}

/**
 * Net Promoter Score: %promoters − %detractors, rounded. Null on an empty set
 * rather than NaN — every aggregate on the results page follows this rule.
 */
export function calculateNps(scores: number[]): number | null {
  if (scores.length === 0) return null
  const promoters = scores.filter(s => npsBand(s) === 'promoter').length
  const detractors = scores.filter(s => npsBand(s) === 'detractor').length
  return Math.round(((promoters - detractors) / scores.length) * 100)
}

/** Mean to one decimal place, or null on an empty set. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}
