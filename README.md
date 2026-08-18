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
members' video library afterwards.

**Setting it up:**

1. Run `supabase/create-webinars.sql` in the Supabase SQL editor.
2. In the Supabase dashboard, **Database → Replication**, enable Realtime on
   `webinar_sessions`, `webinar_chat_messages`, `webinar_questions`, `webinar_polls`,
   `webinar_poll_votes` and `webinar_resources`. (Replication is not managed in SQL in this
   project — the `messages` table was enabled the same way.)
3. **Storage** → create a **private** bucket named `webinar-recordings`, and raise the
   project's global upload size limit above the size of a full-length recording (a
   90-minute 1080p webinar is roughly 1–3 GB).
4. **Storage → S3 settings** → generate an access key pair and put it in the
   `WEBINAR_S3_*` variables.
5. Create a LiveKit Cloud project, put its key/secret/URL in the `LIVEKIT_*` variables, and
   register `https://<site>/api/webinars/webhook` as a webhook in the LiveKit project
   settings.
6. Create a "Webinars" folder in Vimeo, add it under **Admin → Videos → Manage Folders**,
   and put its id in `VIMEO_RECORDINGS_FOLDER_ID`.

**Running one:** create the event as usual with an event type of Webinar, Online Lecture or
Hybrid, then go to **Admin → Live Webinars**, create a live room against it, and invite
guest speakers by email. Each speaker gets a personal link — no Dukes' Club account needed —
which opens a green room where they can test their camera, microphone and screen sharing
before anything is broadcast. Open the studio to go live.

**Recordings:** when the session ends, LiveKit finalises the recording into the
`webinar-recordings` bucket, an hourly cron (`/api/webinars/recordings/poll`) hands it to
Vimeo, and once Vimeo has finished transcoding it is inserted into the `videos` table linked
to its event and the storage copy is deleted. Vercel Hobby plans only allow daily crons, so
there is also a **Check recordings** button on the admin page that runs the same job.

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
