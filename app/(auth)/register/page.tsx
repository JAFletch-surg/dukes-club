'use client'
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, ArrowRight, CheckCircle, Clock, ShieldCheck } from "lucide-react"
import AuthLayout from "@/components/auth/AuthLayout"

const APPROVED_DOMAINS = ["nhs.net", "nhs.uk", "doctors.org.uk"]
const APPROVED_SUFFIX = ".ac.uk"

const isApprovedDomain = (email: string): boolean => {
  const domain = email.split("@")[1]?.toLowerCase() || ""
  return APPROVED_DOMAINS.includes(domain) || domain.endsWith(APPROVED_SUFFIX)
}

const trainingStages = [
  "FY1", "FY2", "CT1", "CT2",
  "ST3", "ST4", "ST5", "ST6", "ST7", "ST8",
  "Post-CCT", "Consultant", "SAS", "Academic", "Other",
]

const regions = [
  "North East", "North West (Mersey)", "North West (North Western)",
  "Yorkshire and the Humber", "East Midlands", "West Midlands",
  "East of England", "London", "Kent, Surrey and Sussex", "Thames Valley",
  "Wessex", "South West (Peninsula)", "South West (Severn)",
  "Scotland", "Wales", "Northern Ireland", "Republic of Ireland",
]

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    acpgbiNumber: "", region: "", trainingStage: "",
  })
  const [directoryVisible, setDirectoryVisible] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [approvalType, setApprovalType] = useState<"auto" | "pending" | null>(null)

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.email || !formData.password || !formData.fullName) {
      setError("Please fill in all required fields.")
      return
    }
    if (!formData.trainingStage) {
      setError("Please select your training stage.")
      return
    }
    if (!formData.region) {
      setError("Please select your deanery/region.")
      return
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          region: formData.region,
          trainingStage: formData.trainingStage,
          acpgbiNumber: formData.acpgbiNumber || null,
          directoryVisible,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Registration failed. Please try again.')
        setIsLoading(false)
        return
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
      setIsLoading(false)
      return
    }

    setIsLoading(false)

    const approved = isApprovedDomain(formData.email)
    setApprovalType(approved ? "auto" : "pending")
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthLayout>
        <div className="text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center">
            {approvalType === "auto" ? (
              <CheckCircle className="h-8 w-8 text-gold" />
            ) : (
              <Clock className="h-8 w-8 text-gold" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {approvalType === "auto" ? "Account Created!" : "Registration Received"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              {approvalType === "auto"
                ? "Your NHS/academic email has been recognised. Please check your inbox and click the verification link to activate your Trainee account."
                : "Your account is pending approval by an administrator. You'll receive an email once your account has been reviewed. This usually takes 1–2 working days."}
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Verification email sent to{" "}
              <span className="font-medium text-foreground">{formData.email}</span>
            </p>
          </div>
          <Link href="/login">
            <Button variant="gold" className="h-11">
              Go to Login
              <ArrowRight size={16} className="ml-1" />
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            NHS, academic &amp; doctors.org.uk emails are auto-approved
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName">Full name <span className="text-destructive">*</span></Label>
            <Input
              id="fullName"
              placeholder="Dr. Jane Smith"
              value={formData.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">Email address <span className="text-destructive">*</span></Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@nhs.net"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              autoComplete="email"
              className="h-11"
              required
            />
            {formData.email && formData.email.includes("@") && (
              <p className={`text-xs flex items-center gap-1 ${isApprovedDomain(formData.email) ? "text-gold" : "text-muted-foreground"}`}>
                {isApprovedDomain(formData.email)
                  ? "✓ Recognised domain — auto-approved as Trainee"
                  : "Account will require admin approval"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reg-password">Password <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  autoComplete="new-password"
                  className="h-11 pr-10"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm <span className="text-destructive">*</span></Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter"
                value={formData.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                autoComplete="new-password"
                className="h-11"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Training stage <span className="text-destructive">*</span></Label>
              <Select value={formData.trainingStage} onValueChange={(v) => updateField("trainingStage", v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {trainingStages.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deanery / Region <span className="text-destructive">*</span></Label>
              <Select value={formData.region} onValueChange={(v) => updateField("region", v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg bg-navy/5 border border-navy/10 px-4 py-3 flex items-start gap-3">
              <ShieldCheck size={18} className="text-navy shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-foreground font-medium">ACPGBI members get full access</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  In-person courses, unlimited question bank, and more. Don&apos;t have a number yet? You can add it later from your profile.
                </p>
              </div>
            </div>
            <Label htmlFor="acpgbi-number">ACPGBI membership number</Label>
            <Input
              id="acpgbi-number"
              placeholder="Optional — enter for full Member access"
              value={formData.acpgbiNumber}
              onChange={(e) => updateField("acpgbiNumber", e.target.value)}
              className="h-11"
            />
            {formData.acpgbiNumber ? (
              <p className="text-xs text-gold flex items-center gap-1">
                <Clock size={12} />
                Your membership number will be verified by an admin. Full Member access will be granted once confirmed.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                If you&apos;re a paying ACPGBI member, enter your membership number for full access
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={directoryVisible}
              onChange={(e) => setDirectoryVisible(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-gold"
            />
            <div>
              <span className="text-sm font-medium text-foreground">Show me in the Member Directory</span>
              <p className="text-xs text-muted-foreground mt-0.5">Other members can see your name, region and training stage. You can change this later in your profile.</p>
            </div>
          </label>

          <Button
            type="submit"
            variant="gold"
            className="w-full h-11"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating account…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Create Account
                <ArrowRight size={16} />
              </span>
            )}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-gold font-medium hover:text-gold/80 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default RegisterPage