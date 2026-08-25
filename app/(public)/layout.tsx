import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { AuthProvider } from '@/lib/auth-provider'

/**
 * No server-side auth here on purpose — these pages are prerendered and
 * served from the CDN, which is only possible while nothing above them
 * touches cookies. Navbar resolves the session client-side after hydration.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Navbar />
        {children}
        <Footer />
      </div>
    </AuthProvider>
  )
}
