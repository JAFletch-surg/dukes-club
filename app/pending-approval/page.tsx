'use client'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Clock, ArrowLeft, Mail } from "lucide-react"
import AuthLayout from "@/components/auth/AuthLayout"
import { createClient } from "@/lib/supabase/client"

const PendingApprovalPage = () => {
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthLayout>
      <div className="text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
          <Clock className="h-8 w-8 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Account Pending Approval</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Your account is waiting for admin approval. This usually takes 1–2 working days. 
            You&apos;ll receive an email notification once your account has been approved.
          </p>
          <div className="mt-4 rounded-lg bg-muted/50 border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail size={16} className="text-gold" />
              <span>We&apos;ll email you when your account is ready</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} /> Sign out and return to homepage
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}

export default PendingApprovalPage
