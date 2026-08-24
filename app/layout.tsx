import type { Metadata } from 'next'
import { Montserrat, IBM_Plex_Mono } from 'next/font/google'
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
 * Fonts are self-hosted through next/font rather than linked from
 * fonts.googleapis.com.
 *
 * The three <link rel="stylesheet"> tags that used to live in <head> were
 * render-blocking requests to two third-party origins, on every page view,
 * before anything could paint. next/font inlines the @font-face rules, serves
 * the files from this origin, and generates a size-adjusted local fallback so
 * the swap from fallback to webfont does not shift the layout.
 *
 * Cormorant Garamond is NOT loaded here. Nothing on the public site uses
 * font-serif — every usage is under /admin or /members — so it is loaded in
 * those layouts instead and never costs a marketing visitor anything.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

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
    <html lang="en" className={`${montserrat.variable} ${ibmPlexMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
