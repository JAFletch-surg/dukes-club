'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to reset password.')
        setIsLoading(false)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }

    setIsLoading(false)
  }

  // No token — invalid link
  if (!token) {
    return (
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
        </div>
        <Link href="/forgot-password">
          <Button variant="gold" className="h-11">
            Request New Link
            <ArrowRight size={16} className="ml-1" />
          </Button>
        </Link>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-gold" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Password Updated</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
        </div>
        <Link href="/login">
          <Button variant="gold" className="h-11">
            Go to Login
            <ArrowRight size={16} className="ml-1" />
          </Button>
        </Link>
      </div>
    )
  }

  // Reset form
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your new password below. It must be at least 8 characters long.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-10"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11"
            required
            minLength={8}
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
              Resetting…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Reset Password
              <ArrowRight size={16} />
            </span>
          )}
        </Button>
      </form>

      <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={14} /> Back to login
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <span className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  )
}