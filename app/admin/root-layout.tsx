import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-provider'
import './globals.css'

export const metadata: Metadata = {
  title: "Dukes' Club",
  description: 'Colorectal Surgery Trainee Network',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
