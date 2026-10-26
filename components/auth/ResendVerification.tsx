'use client'
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, ArrowRight } from "lucide-react"

/**
 * "Send me a new verification link" — shared by the login page (under the
 * "verify your email" error) and the /auth/confirm page (after an expired
 * or broken link).
 *
 * `email` is the address already known from the surrounding form. When it is
 * empty the component shows its own email field.
 */
export default function ResendVerification({ email: knownEmail = "" }: { email?: string }) {
  const [email, setEmail] = useState(knownEmail)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<"sent" | "already" | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const target = (email || knownEmail).trim()
    if (!target) {
      setError("Please enter your email address.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setResult(data.alreadyVerified ? "already" : "sent")
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setIsLoading(false)
  }

  if (result === "already") {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        This email address is already verified. You can sign in with your password.
      </div>
    )
  }

  if (result === "sent") {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-start gap-2">
        <Mail size={16} className="mt-0.5 shrink-0" />
        <span>
          A new verification link is on its way to <span className="font-medium">{(email || knownEmail).trim()}</span>.
          Please use it soon — it expires. Check your spam folder if it doesn&apos;t arrive within a few minutes.
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {!knownEmail && (
        <div className="space-y-2">
          <Label htmlFor="resend-email">Email address</Label>
          <Input
            id="resend-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-11"
            required
          />
        </div>
      )}
      <Button type="submit" variant="outline" className="w-full h-11" disabled={isLoading}>
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Sending…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Mail size={16} />
            Send me a new verification link
            <ArrowRight size={16} />
          </span>
        )}
      </Button>
    </form>
  )
}
