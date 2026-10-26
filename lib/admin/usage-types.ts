/** Shape returned by GET /api/admin/usage and rendered by the Site Usage page. */

export interface TopVideo {
  id: string
  title: string
  viewers: number
  minutes: number
  completions: number
}

export interface TopWebinar {
  sessionId: string
  title: string
  attendees: number
  minutes: number
}

export interface DailyActivity {
  /** ISO date, YYYY-MM-DD */
  date: string
  videos: number
  questions: number
  webinars: number
  bookings: number
}

export interface TopMember {
  id: string
  name: string
  email: string | null
  region: string | null
  videosWatched: number
  videoMinutes: number
  questionSessions: number
  questionsAnswered: number
  webinarMinutes: number
  lastSignIn: string | null
}

export interface UsageSummary {
  generatedAt: string
  rangeDays: number
  members: {
    total: number
    approved: number
    newInRange: number
    signedInInRange: number
    activeInRange: number
    neverSignedIn: number
    unverifiedEmail: number
  }
  videos: {
    minutesAllTime: number
    minutesInRange: number
    watchedInRange: number
    startedInRange: number
    completedInRange: number
    completedAllTime: number
    uniqueViewersInRange: number
    top: TopVideo[]
  }
  questions: {
    sessionsInRange: number
    questionsAnsweredInRange: number
    uniqueUsersInRange: number
    avgPercentageInRange: number | null
    sessionsAllTime: number
    questionsAnsweredAllTime: number
  }
  webinars: {
    attendancesInRange: number
    uniqueAttendeesInRange: number
    minutesInRange: number
    chatMessagesInRange: number | null
    questionsAskedInRange: number | null
    top: TopWebinar[]
  }
  events: {
    bookingsInRange: number
    byStatus: Record<string, number>
    certificatesInRange: number | null
  }
  messaging: {
    messagesInRange: number | null
    feedbackResponsesInRange: number | null
  }
  daily: DailyActivity[]
  topMembers: TopMember[]
  /** Data sources that could not be read; the related figures are null or zero. */
  warnings: string[]
}

export const USAGE_RANGES = [7, 30, 90, 365] as const
export type UsageRange = (typeof USAGE_RANGES)[number]
