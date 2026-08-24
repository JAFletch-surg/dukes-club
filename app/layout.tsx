import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: "The Dukes' Club | Colorectal Surgery Trainee Network",
  description: "The Dukes' Club is a UK-based network for colorectal surgery trainees.",
  // Icons are deliberately NOT declared here. Next.js only merges the
  // file-convention icons (app/icon.png, app/apple-icon.png) when metadata.icons
  // is unset — setting it makes them silently disappear from the output.
}

/**
 * Deliberately static: no cookies(), no headers(), nothing async.
 *
 * Reading auth here would opt EVERY route in the app out of static generation
 * — including the marketing pages, which have no server data at all and were
 * being server-rendered on every visit as a result. <AuthProvider> now lives
 * in the route-group layouts that actually consume it: (public), members and
 * admin. See lib/supabase/auth.ts.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}