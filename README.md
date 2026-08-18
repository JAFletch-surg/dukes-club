This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment Variables

Set these in `.env.local` for development and in the Vercel project settings for deployments.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only — never expose) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL, used in emails and links |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox token for maps |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `ADMIN_EMAIL` | Where admin notifications are sent |
| `CONTACT_TO_EMAIL` | Where contact form submissions are sent |
| `INTERNAL_API_SECRET` | Shared secret for internal API calls |
| `CRON_SECRET` | Bearer token Vercel Cron presents to `/api/digest/cron`. Falls back to `INTERNAL_API_SECRET` if unset |
| `VIMEO_ACCESS_TOKEN` | Vimeo API token for the account hosting the videos. **Needs `upload`, `edit`, `interact` and `private` scopes** if live webinar recordings are enabled — the read-only token that serves the video sync is not sufficient |
| `VIMEO_FOLDER_ID` | *Legacy fallback.* See below |
| `VIMEO_RECORDINGS_FOLDER_ID` | Vimeo folder that webinar recordings are uploaded into. Must also be registered as an active row in `vimeo_folders` — see below |
| `LIVEKIT_API_KEY` | LiveKit Cloud API key (live webinars) |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret |
| `LIVEKIT_HTTP_URL` | `https://<project>.livekit.cloud` — used by the server SDK |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://<project>.livekit.cloud` — used by the browser |
| `WEBINAR_S3_ENDPOINT` | S3-compatible endpoint recordings are written to, e.g. `https://<ref>.supabase.co/storage/v1/s3` |
| `WEBINAR_S3_REGION` | Region for the above, e.g. `eu-west-2` |
| `WEBINAR_S3_BUCKET` | Bucket name (default `webinar-recordings`) |
| `WEBINAR_S3_ACCESS_KEY_ID` | Access key for the recordings bucket |
| `WEBINAR_S3_SECRET_ACCESS_KEY` | Secret key for the recordings bucket |

Live webinars are optional. With the `LIVEKIT_*` variables unset, everything else works
exactly as before and the token routes return a clear 503 rather than failing obscurely.

### Vimeo folders

Which Vimeo folders feed the members' video library is managed in the admin panel
(**Admin → Videos → Manage Folders**) and stored in the `vimeo_folders` table — see
`supabase/add-vimeo-folders.sql`.

`VIMEO_FOLDER_ID` is only a fallback: while `vimeo_folders` has no active rows, sync uses that
single folder, which is how the site worked before folders became admin-managed. The first time an
admin opens Manage Folders, that folder is added to the table automatically so nothing is lost.
Once folders are managed in the UI the variable is ignored and can be removed.

### International members

Registration asks whether someone is joining from the **UK / Ireland** or is **International**.
UK registrants pick a deanery as before; international registrants pick their country, and their
account always goes to an admin for review rather than being auto-approved. A UK registrant using an
email domain we don't recognise is additionally asked for their **GMC number**, which admins check
before approving.

To enable this on a new environment, run `supabase/add-international-members.sql` in the Supabase SQL
editor. It adds `member_category`, `country` and `gmc_number` to `profiles` and backfills every
existing row to the `uk` category.

### Live webinars

Webinars can run natively on the site rather than linking out to Zoom. The host and any
guest speakers present from the browser (with screen sharing for slides), attendees watch
and take part in chat, Q&A and polls, and the session is recorded and published to the
members' video library afterwards, linked to the event that produced it.

Live webinars are **optional**. With the `LIVEKIT_*` variables unset, the rest of the site
behaves exactly as before and the webinar routes return a clear 503 rather than failing
obscurely.

Setup is a one-off job needing admin on Supabase, LiveKit Cloud, Vimeo and Vercel. Work
through the steps in order — several later ones depend on values produced earlier.

#### 1. Database

Supabase → **SQL Editor** → New Query → paste `supabase/create-webinars.sql` → Run.

It is idempotent, so re-running is safe. It creates the eight `webinar_*` tables and their
RLS policies, two `SECURITY DEFINER` functions for poll tallies, adds `videos.event_id`, and
rewrites the `events.stream_type` CHECK constraint to accept `'livekit'`.

Success looks like a final `Webinar schema OK.` notice. On failure it raises with the name
of the table that is missing.

#### 2. Realtime replication

Supabase → **Database → Replication** → `supabase_realtime` → enable these six tables:

```
webinar_sessions        webinar_chat_messages
webinar_questions       webinar_polls
webinar_poll_votes      webinar_resources
```

This is a dashboard step rather than SQL — there is no `ALTER PUBLICATION` anywhere in this
repo, and the `messages` table behind members' chat was enabled the same way.

Skipping it does not error: chat, questions and poll results simply only appear when someone
reloads the page. That is the symptom to recognise.

#### 3. Storage

1. Supabase → **Storage → New bucket** → name `webinar-recordings`, visibility **Private**.
   The name must match `WEBINAR_S3_BUCKET` below.
2. **Raise the upload size limit.** The default is 50 MB; a 90-minute 1080p recording is
   1–3 GB. Storage → Settings → global file size limit. Skipping this fails the upload at
   the *end* of the recording, i.e. after the webinar.
3. **Storage → S3 settings** → generate an access key pair. Copy the access key ID, secret,
   endpoint and region. Copy the endpoint verbatim rather than typing it — the hostname form
   differs between projects.

Recording storage is plain S3 config, so if Supabase's S3 layer ever gives trouble with
large multipart uploads, pointing the five `WEBINAR_S3_*` variables at Cloudflare R2 or any
other S3 is the whole migration — no code change.

#### 4. LiveKit

Create a project at [cloud.livekit.io](https://cloud.livekit.io). From **Settings → Keys**
take the API key, secret and project URL. The URL is needed in two forms:

| Variable | Form |
| --- | --- |
| `LIVEKIT_HTTP_URL` | `https://<project>.livekit.cloud` |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://<project>.livekit.cloud` |

Then **Settings → Webhooks** → add `https://<your-domain>/api/webinars/webhook`.

The webhook is signature-verified and carries attendance tracking plus the recording
handoff, so it is not optional. It cannot reach `localhost`, so in local development
attendance will not record and recordings will not progress past "Recording" — expected,
not a bug.

#### 5. Vimeo

**Regenerate the API token with write scopes.** Every existing Vimeo call in this codebase is
a `GET`, so the token currently in `VIMEO_ACCESS_TOKEN` is very likely read-only. Uploading
recordings needs `upload`, `edit`, `interact` and `private`. Regenerate the single token
rather than adding a second — the existing read paths keep working unchanged.

Then create a **Webinars** folder in Vimeo and register it in **both** places:

1. **Admin → Videos → Manage Folders** — so the video sync manages what is in it.
2. `VIMEO_RECORDINGS_FOLDER_ID` — so recordings are filed into it.

Both are required. A recording outside a folder registered in `vimeo_folders` never has its
metadata refreshed by the sync. It will not be archived (`/api/vimeo/sync` skips rows that
have an `event_id`), but it will go stale.

#### 6. Environment variables

Set in Vercel (Production and Preview) and in `.env.local` for development, then redeploy:

```bash
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_HTTP_URL=https://<project>.livekit.cloud
NEXT_PUBLIC_LIVEKIT_URL=wss://<project>.livekit.cloud

WEBINAR_S3_ENDPOINT=            # copied from Supabase S3 settings
WEBINAR_S3_REGION=              # e.g. eu-west-2
WEBINAR_S3_BUCKET=webinar-recordings
WEBINAR_S3_ACCESS_KEY_ID=
WEBINAR_S3_SECRET_ACCESS_KEY=

VIMEO_RECORDINGS_FOLDER_ID=     # numeric id from the Vimeo folder URL
```

`VIMEO_ACCESS_TOKEN`, `CRON_SECRET` and the Supabase keys are already configured.

#### 7. Smoke test — before the first real webinar

Roughly fifteen minutes, and it exercises each moving part in the order it would fail. Use
two browsers (or one plus a private window) so you can be admin and attendee at once.

| # | Do | Expect |
| --- | --- | --- |
| 1 | Create a draft event, type **Webinar**, starting shortly | — |
| 2 | Admin → Live Webinars → **New live room**, pick it | Room appears, status *Scheduled* |
| 3 | **Speakers** → invite yourself with a real address | Email arrives; link shown once |
| 4 | Open the speaker link in a private window | Green room; camera preview and mic meter live |
| 5 | Press **Test your slides** | Screen picker opens |
| 6 | Publish the event, register a non-admin account, open `/webinar/<slug>` as them | Countdown lobby |
| 7 | As admin, **Open studio** → **Go live** | The attendee window enters the stage with no refresh — this is the realtime check |
| 8 | Share your screen from the speaker window | Both other windows flip to slide-dominant |
| 9 | Send a chat message, ask a question, answer it with a PDF, launch a poll and vote | Everything appears in both windows within about a second |
| 10 | **End**, then leave the Live Webinars page open | Status walks *Recording* → *Uploading to Vimeo* → *Published* over the next several minutes |
| 11 | Reopen the webinar page and the video library | Recording plays, tagged to its event |

Step 10 is the one that cannot be verified any other way — it is the first real exercise of
the LiveKit → storage → Vimeo chain.

#### How recordings get published

Worth understanding, because the timing depends on the Vercel plan:

1. You press **End**. LiveKit finalises the MP4 into the `webinar-recordings` bucket.
2. LiveKit calls `/api/webinars/webhook`, which immediately hands the file to Vimeo as a
   "pull" upload — Vimeo fetches it from a 24-hour signed URL, so the bucket stays private.
3. Vimeo transcodes, which takes anywhere from a few minutes to an hour or so and gives no
   completion callback. Something has to check.
4. Once transcoding finishes, the video is filed into the Webinars folder, inserted into the
   `videos` table linked to its event, and the storage copy is deleted.

Step 3 is checked three ways, in order of usefulness:

* **The Live Webinars admin page**, automatically, once a minute while it is open and any
  recording is mid-pipeline. In practice this is what publishes your recording.
* **The "Check recordings" button** on that page, on demand.
* **A daily cron** at 03:00 as the backstop.

The cron is daily rather than hourly because **Vercel's Hobby plan rejects any schedule more
frequent than once a day, and would fail the deployment outright**. If this project moves to
Pro, changing `/api/webinars/recordings/poll` in `vercel.json` to `0 * * * *` is worthwhile,
but nothing depends on it.

#### Troubleshooting

| Symptom | Cause |
| --- | --- |
| "Live webinars are not configured" | One of the four `LIVEKIT_*` variables is missing |
| Chat and polls only update on refresh | Realtime replication not enabled (step 2) |
| Attendee sees a countdown while you are live | You joined the studio but did not press **Go live** |
| Speaker link rejected | Revoked, or expired — links last until a day after the event. Press **New link** |
| Speaker cannot share their screen | They are on a phone or tablet. Screen sharing needs a desktop browser |
| Recording stuck on *Saved — awaiting transfer* | The Vimeo handoff failed; the error is on the admin card. Press **Check recordings** to retry |
| Recording failed, Vimeo returned 401/403 | The Vimeo token lacks write scopes (step 5) |
| Recording failed after a long session | Supabase upload size limit too low (step 3) |
| Recording published but not in the Vimeo folder | `VIMEO_RECORDINGS_FOLDER_ID` wrong; shown as a warning on the admin card |
| Deployment fails: "Hobby accounts are limited to daily cron jobs" | A cron in `vercel.json` fires more than once a day |


### Round-up digest email

A recurring digest of upcoming events, newly published posts and new videos, sent to members at the
frequency each of them chooses. Each section fills itself by date unless an admin chooses specific
items for it, and can be set to send only those chosen items. Managed in the admin panel (**Admin → Round-Up Email**) — see
[docs/admin/digest.md](docs/admin/digest.md) for how it behaves and
[docs/user-guide/email-preferences.md](docs/user-guide/email-preferences.md) for the member-facing
side.

To enable it on a new environment:

1. Run `supabase/create-digest-preferences.sql` in the Supabase SQL editor. This creates
   `digest_preferences` and `digest_sends`, subscribes existing members at the default weekly
   cadence, and adds a trigger so new registrations are subscribed automatically.
2. Run `supabase/add-digest-videos-and-ranking.sql`. This adds the videos section and the
   `digest_rank` column recording which items an admin has chosen.
3. Run `supabase/add-digest-curation.sql`. This adds `digest_settings`, holding the per-section
   auto-fill switches.
4. Set `CRON_SECRET` in the Vercel project settings.

The schedule lives in `vercel.json` — currently `0 8 * * 4`, Thursday mornings at 08:00 UTC (9am
during British Summer Time, 8am in winter). It sets the *fastest* cadence any member can receive:
each run emails only the members who are due, so fortnightly and monthly subscribers are skipped in
between. Changing the day or time is a one-line edit and nothing else needs to change, because each
member's cadence is measured from when they last received a digest rather than from the cron
schedule.

Two things to know about running this on Vercel's Hobby plan, neither of them a problem here:

* Hobby rejects schedules that fire **more** than once a day (`0 * * * *`, `*/30 * * * *`).
  Anything daily or less frequent — including this weekly schedule — deploys fine.
* Hobby may invoke the job at any point **within** the scheduled hour, so `0 8 * * 4` can run at
  08:47 rather than 08:00. Harmless: the due-date check allows a 12-hour grace window, so no
  member's cadence drifts because of it.

Preview the template without a database at
`/api/email/preview?template=digest` (development only).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
