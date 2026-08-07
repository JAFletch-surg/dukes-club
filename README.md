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
| `VIMEO_ACCESS_TOKEN` | Vimeo API token for the account hosting the videos |
| `VIMEO_FOLDER_ID` | *Legacy fallback.* See below |
| `PAYMENT_PROVIDER` | Which provider handles Dukes Weekend deposits. See below |

### Payments

Dukes Weekend deposits go through a provider abstraction in `lib/payments/`. `PAYMENT_PROVIDER`
selects the implementation — anything other than `stripe` (including unset) uses `manual`, so a
missing or misspelled value can never quietly route real money somewhere unexpected.

`manual` is the only live provider today: deposits are recorded against a booking and an admin
marks them paid and refunded from **Admin → Event → Attendees**. Bookings work end to end with no
payment processing.

`stripe` is a stub. `lib/payments/stripe.ts` conforms to the same interface and throws until it is
implemented; the data model already carries the payment intent and charge references it will need,
so switching over is that file plus `STRIPE_SECRET_KEY`, not a rebuild of the booking flow.

### Vimeo folders

Which Vimeo folders feed the members' video library is managed in the admin panel
(**Admin → Videos → Manage Folders**) and stored in the `vimeo_folders` table — see
`supabase/add-vimeo-folders.sql`.

`VIMEO_FOLDER_ID` is only a fallback: while `vimeo_folders` has no active rows, sync uses that
single folder, which is how the site worked before folders became admin-managed. The first time an
admin opens Manage Folders, that folder is added to the table automatically so nothing is lost.
Once folders are managed in the UI the variable is ignored and can be removed.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
