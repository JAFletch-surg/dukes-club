---
title: Round-Up Email
parent: Admin Guide
nav_order: 7
---

# Round-Up Email

The round-up is a recurring digest sent to members, highlighting **upcoming events**, **newly
published news and blog posts** and **new videos**, with links straight to each item. It is managed
from **Admin → Round-Up Email**.

Members choose their own frequency and what the email covers, so a single run sends different
content to different people.

## How the schedule works

A cron job runs the digest every day. Each run only emails members whose own cadence has come
round, so fortnightly and monthly subscribers are simply skipped on the runs in between:

| Member's setting | Receives the round-up |
| --- | --- |
| Weekly | Every run |
| Fortnightly | Every other run |
| Monthly | Every fourth run (28 days) |
| Never | Not at all |

Runs happen **every morning at 08:00 UTC** — 9am during British Summer Time, 8am in
winter. The exact minute varies: on Vercel's Hobby plan the job may be triggered at any point
within that hour, so a digest arriving at 08:47 is normal and not a fault.

### The daily limit

Resend's free tier allows 100 emails a day across everything the site sends, so the round-up takes
at most **80 per day** (UTC), leaving room for booking confirmations, password resets and the like.
When more members are due than that, the 80 who have waited longest go first and the rest are held
over to the next day's run. A large list therefore goes out in groups of 80 over consecutive days.

Nobody receives the round-up twice: a member only becomes due again a full cadence after their
last successful send, and anyone sent a digest in the last 20 hours is skipped regardless. A
held-over member's news and videos are still counted from their own last digest, so arriving a day
later loses nothing. After the first week each member settles on their own send day, so roughly the
same group goes out each day of the week.

The limit counts every round-up sent that day, including **Send now** from the admin page, so
pressing it after the morning run only sends whatever allowance is left. Set
`DIGEST_DAILY_LIMIT` to change the figure (for example after upgrading the Resend plan). If more
than 7 × 80 = 560 weekly subscribers are due, the backlog will grow; raise the limit or the plan
before that point.

Two rules keep the email from becoming noise:

* **Nobody is sent an empty digest.** If a member has no upcoming events and nothing published
  since their last round-up, the run skips them and their window stays open, so that content still
  reaches them next time rather than being lost.
* **News and videos are windowed, events are forward-looking.** The news and video sections only
  contain items published
  since that member's last digest. The events section shows the next few events coming up — further
  ahead for less frequent subscribers, so a monthly reader still sees things in time to book.

A member who has never received a digest (or who has been dormant for months) gets at most the last
60 days of news, not the whole archive.

## The admin page

### What goes in the next round-up

By default each section fills itself: upcoming events by date, and news and videos by whatever has
been published since each member last heard from you. That is fine most weeks, but it makes the
choice arbitrary when a batch of content lands at once — syncing twenty videos means the "newest
three" are whichever three happen to be newest, not the three worth watching.

The **What goes in the next round-up** panel gives you the final say. Each section has two parts:

**In the next round-up** — the items you have chosen, in the order you want them. Use **Add** to
pick one (with a search box for when the library is large), the arrows to order them, and **✕** to
remove one. Leave it empty and the section behaves exactly as it always has.

**Fill the remaining slots automatically** — whether the leftover slots top up by date beneath your
choices.

Between them these cover the three cases you will actually want:

| Chosen | Auto-fill | What is sent |
| --- | --- | --- |
| Nothing | On | Fully automatic — the default |
| A few items | On | Your items lead, the rest fills by date |
| A few items | Off | Exactly your items, nothing else |

That last row is the override: choose three videos, switch auto-fill off, and those three are what
goes out.

#### Two things worth knowing

**Chosen items ignore the "already seen" rule.** Normally a member is only sent news and videos
published since their last round-up, so nobody receives the same thing twice. An item you choose is
sent to *every* member of that section regardless — that is what makes it an override rather than a
hint. It also means a choice you forget to remove keeps going out in every issue, so clear the list
once an item has had its moment. The panel shows a reminder whenever a section has chosen items.

**A member's own preferences still win.** Someone who has switched a section off will not receive
it, however you have curated it, and a member who has narrowed news to particular categories will
only see chosen posts in those categories. Overriding those would break a promise made to the
member.

Choosing an item also lifts it out of the usual date limits — you can feature a video from six
months ago, or an event further ahead than the section would normally reach.

### Preview and sending

**Preview** renders the email exactly as it would go out right now, against live content. Switch
between the weekly, fortnightly and monthly views to see what each group would receive. If there is
nothing to send, the preview says so instead of showing an empty template.

Three actions:

* **Send a test to me** — sends one sample digest to your own address. Changes nothing; no member's
  schedule is affected.
* **Check who's due** — a dry run. Reports how many members would be emailed and what each would
  get, without sending anything.
* **Send now to everyone due** — runs the digest immediately, up to whatever is left of today's
  daily limit. Members who are not due, and members with nothing new, are still skipped; anyone
  over the limit goes out on the next day's run.

**Recent Sends** logs every attempt, including failures and skips, so you can confirm a run went out
and see anything that bounced.

## What members control

Members set their own preferences in two places, both of which write to the same settings:

* **Members' area → My Profile → Email Updates**
* The **Choose what you hear about** link in the footer of every round-up, which works without
  signing in

They can pick a frequency (including *Never*), switch the events, news and video sections on or off
individually, and narrow the news section to particular categories. Every email also carries a
one-click unsubscribe that Gmail and Outlook surface as a native button.

Account emails — booking confirmations, certificates, password resets — are not affected by any of
these settings and are always sent.

## Setup

Run these in the Supabase SQL editor, in order:

1. `supabase/create-digest-preferences.sql` — creates the `digest_preferences` and `digest_sends`
   tables, subscribes every existing member at the default weekly cadence, and adds a trigger so new
   registrations are subscribed automatically.
2. `supabase/add-digest-videos-and-ranking.sql` — adds the videos section and the `digest_rank`
   column that records which items you have chosen.
3. `supabase/add-digest-curation.sql` — adds `digest_settings`, which holds the per-section
   auto-fill switches.

The schedule itself lives in `vercel.json` (`0 8 * * *` — daily at 08:00 UTC). It needs to run
daily for held-over members to go out the next day; each member's cadence is worked out from when
they last received a digest rather than from the cron schedule.

Requires `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`
to be set. See the README for the full list.
