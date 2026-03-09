'use client'
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Mail } from "lucide-react"
import AuthLayout from "@/components/auth/AuthLayout"

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email) {
      setError("Please enter your email address.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Something went wrong. Please try again.')
        setIsLoading(false)
        return
      }

      setSent(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }

    setIsLoading(false)
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
            <Mail className="h-8 w-8 text-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Check your inbox</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </p>
          </div>
          <Link href="/login">
            <Button variant="gold" className="h-11">
              <ArrowLeft size={16} className="mr-1" />
              Back to Login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the email address associated with your account and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-11"
              required
            />
          </div>

          <Button
            type="submit"
            variant="gold"
            className="w-full h-11"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Sending…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Send Reset Link
                <ArrowRight size={16} />
              </span>
            )}
          </Button>
        </form>

        <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </AuthLayout>
  )
}

export default ForgotPasswordPage