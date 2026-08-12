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
| `VIMEO_ACCESS_TOKEN` | Vimeo API token for the account hosting the videos |
| `VIMEO_FOLDER_ID` | *Legacy fallback.* See below |

### Vimeo folders

Which Vimeo folders feed the members' video library is managed in the admin panel
(**Admin → Videos → Manage Folders**) and stored in the `vimeo_folders` table — see
`supabase/add-vimeo-folders.sql`.

`VIMEO_FOLDER_ID` is only a fallback: while `vimeo_folders` has no active rows, sync uses that
single folder, which is how the site worked before folders became admin-managed. The first time an
admin opens Manage Folders, that folder is added to the table automatically so nothing is lost.
Once folders are managed in the UI the variable is ignored and can be removed.

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
