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

A cron job runs the digest once a week. Each run only emails members whose own cadence has come
round, so fortnightly and monthly subscribers are simply skipped on the runs in between:

| Member's setting | Receives the round-up |
| --- | --- |
| Weekly | Every run |
| Fortnightly | Every other run |
| Monthly | Every fourth run (28 days) |
| Never | Not at all |

Digests go out on **Thursday mornings at 08:00 UTC** — 9am during British Summer Time, 8am in
winter. The exact minute varies: on Vercel's Hobby plan the job may be triggered at any point
within that hour, so a digest arriving at 08:47 is normal and not a fault.

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

### Running order

By default each section is ordered by date, which can bury the item that matters most. **Running
order** lists everything that could appear in the next issue and lets you **Pin** the items that
should lead their section, arranging pinned items with the ↑/↓ buttons. Anything unpinned follows
underneath, newest first.

Pinning affects the email only — the public events and news pages stay chronological, so promoting
something for one issue never reorders the website.

Each section shows a limited number of items (4 events, 5 posts, 3 videos) and the panel marks
where that cut-off falls. Treat the line as a guide rather than a guarantee: because news and videos
are windowed per member, someone who last heard from you a while ago may see further down the list
than someone who read last week's issue.

Unpin an item once it has had its moment — a pinned item keeps leading its section until you remove
it or it drops out of the section entirely (an event that has happened, or a post older than 60 days).

### Preview and sending

**Preview** renders the email exactly as it would go out right now, against live content. Switch
between the weekly, fortnightly and monthly views to see what each group would receive. If there is
nothing to send, the preview says so instead of showing an empty template.

Three actions:

* **Send a test to me** — sends one sample digest to your own address. Changes nothing; no member's
  schedule is affected.
* **Check who's due** — a dry run. Reports how many members would be emailed and what each would
  get, without sending anything.
* **Send now to everyone due** — runs the digest immediately. Members who are not due, and members
  with nothing new, are still skipped.

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
   column behind the running order.

The schedule itself lives in `vercel.json` (`0 8 * * 4` — Thursdays at 08:00 UTC). Changing that
line changes the send day; you do not need to touch anything else, because each member's cadence is
worked out from when they last received a digest rather than from the cron schedule.

Requires `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`
to be set. See the README for the full list.
