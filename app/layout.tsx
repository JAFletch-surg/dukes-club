import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-provider'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: "The Dukes' Club | Colorectal Surgery Trainee Network",
  description: "The Dukes' Club is a UK-based network for colorectal surgery trainees.",
  icons: { icon: '/favicon.ico' },
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
      </body>
    </html>
  )
}