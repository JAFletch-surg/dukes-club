---
title: Site Feedback
parent: Admin Guide
nav_order: 8
---

# Site Feedback

A standing questionnaire that asks members what they think of the portal — the look and feel,
how useful each feature is, and what they want built next. Results are at
**Admin → Site Feedback**.

This is separate from **event** feedback, which asks about a single course or meeting and is
managed from that event's page. Site feedback is about the website itself.

## How members reach it

A gold call-to-action card appears near the top of the member dashboard, linking to
`/members/feedback`. The card disappears for a member as soon as they have answered the current
round, so nobody is nagged twice.

The questionnaire is four short sections — first impressions, look and feel, what they use, and
what's missing — and takes about three minutes. Answers are saved to the member's browser as
they go, so a half-finished response survives a reload.

## Reading the results

**Response rate** is measured against every approved member, so it will look low early on. Ten
thoughtful responses are worth more than a high percentage.

The tabs:

- **Overview** — how members rate the experience (the agreement statements, as 100%-stacked
  bars), the spread of recommendation scores, and which devices people use.
- **Features** — the two charts that matter most. *How valuable each part is* ranks features by
  their mean score among members who actually use them. *How many members use each part* shows
  reach. A feature that scores highly but reaches few people is a promotion problem; one that
  reaches everyone but scores poorly is a quality problem.
- **Ideas** — demand for each candidate feature, and every answer to "if we could build one
  thing…".
- **Responses** — the full text of each response, searchable.

Two controls sit above the tabs: a round selector (once more than one round exists), and
**Exclude committee**, which drops responses from admins, super admins and editors so you can
see what the membership thinks rather than what you think.

Every average shows its own `n`, and anything with no data shows `–` rather than a zero. Don't
read a 5.0 from two responses as a mandate.

## Anonymous responses

Members can tick "don't show my name against my answers". For those responses you will see
"Anonymous member", no name, no email, no role, and only a month-level date.

This is enforced in the database, not just hidden in the page: admins read through a
`site_feedback_admin` view that never returns the member's id at all. There is deliberately no
admin read policy on the underlying table, so there is no way to work backwards from the results
page to a name. The view itself holds no special privileges — the one privileged read is a
`SECURITY DEFINER` function, `site_feedback_admin_rows()`, which checks `is_admin()` before it
returns anything.

What anonymity does **not** hide: the response is still tagged with training grade and region,
because that is what makes the results useful to segment. On a club this size that can narrow a
response to a small group, and the questionnaire tells members so in plain terms. Bear it in
mind before quoting an anonymous comment in a meeting.

## Changing the questions

The questionnaire lives in code, at `lib/site-feedback-questions.ts` — not in the database and
not in an admin form builder. Editing it is a code change and needs a deploy.

Two rules:

1. **Never reuse a question id for a different question.** Answers are stored keyed by these
   ids, so reusing `q_ux_speed` for something else silently corrupts every historic response.
   Retire the id and add a new one.
2. **Bump `SITE_FEEDBACK_VERSION` to open a new round.** Every member is then invited again, the
   dashboard card reappears, and the previous round is preserved for comparison in the round
   selector. Fixing a typo does not need a bump; materially changing what you're asking does.

## Where the data lives

Responses are in the `site_feedback_responses` table, created by
`supabase/create-site-feedback.sql`. Responses are **write-once**: there are no update or delete
policies, so a member cannot revise an answer and the results cannot be edited from the browser.
Removing a spam response is a deliberate job for the Supabase SQL Editor.

> **Note for developers:** this page is built with Tailwind and the shared UI primitives, rather
> than the inline `S` style object used by most other admin pages. The theme has no dark mode, so
> the semantic tokens are safe here, and the chart colours come from the `--color-chart-*` tokens
> in `app/globals.css`.
