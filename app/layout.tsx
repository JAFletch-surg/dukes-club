import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-provider'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import './globals.css'

// Bump this whenever the artwork in app/favicon.ico, app/icon.png or
// app/apple-icon.png changes. It is what forces browsers off a cached icon.
const ICON_VERSION = '2'

export const metadata: Metadata = {
  title: "The Dukes' Club | Colorectal Surgery Trainee Network",
  description: "The Dukes' Club is a UK-based network for colorectal surgery trainees.",
  // Declaring icons here replaces the file convention rather than adding to it:
  // Next.js merges app/icon.png and app/apple-icon.png only while metadata.icons
  // is unset, so every icon has to be listed below or it vanishes from the head.
  //
  // We take that trade because the convention serves the .ico at a bare,
  // unversioned /favicon.ico, and that is the icon browsers refetch on their own
  // and cache hardest — a stale copy is why the old stock icon comes back. The
  // ?v= query makes each rendition a new URL. (The convention gave the two PNGs
  // a content hash automatically; ICON_VERSION above takes over that job.)
  //
  // The .ico lives in public/, not app/, for the same reason: app/favicon.ico is
  // the one file convention Next.js injects into the head even when
  // metadata.icons is set, which would put an unversioned link back alongside
  // these. From public/ it still answers the browser's automatic /favicon.ico
  // request, but the head lists only the versioned URLs below.
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: `/icon.png?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: `/apple-icon.png?v=${ICON_VERSION}`, sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch the authenticated user server-side so the client hydrates
  // immediately without a loading flash. This follows the Supabase
  // recommendation to always use getUser() on the server.
  // See: https://supabase.com/docs/guides/auth/server-side/nextjs
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If we have a user, fetch their profile so the client has it immediately
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

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
        <AuthProvider initialUser={user} initialProfile={profile}>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}