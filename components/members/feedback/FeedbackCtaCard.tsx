'use client'

import Link from 'next/link'
import { MessageSquareHeart, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SITE_FEEDBACK_MINUTES } from '@/lib/site-feedback-questions'

/**
 * Dashboard call-to-action for the site feedback questionnaire. Rendered only
 * while the member still has something to say — see app/members/page.tsx, which
 * gates this on a head-count against site_feedback_responses.
 */
export default function FeedbackCtaCard() {
  return (
    <Card className="border border-navy/20 bg-gradient-to-r from-navy/5 to-gold/10">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-foreground">
          <MessageSquareHeart size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Tell us what you think of the members’ area
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            We’re planning what to build next. Rate the site, score the bits you use, and tell
            us what’s missing.
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock size={11} /> About {SITE_FEEDBACK_MINUTES} minutes
          </p>
        </div>
        <Link href="/members/feedback" className="shrink-0">
          <Button variant="gold" size="sm">
            Give feedback
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
