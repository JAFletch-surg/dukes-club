import { createClient } from '@/lib/supabase/client'

type EmailType = 'welcome' | 'approval' | 'rejection' | 'booking_confirmation' | 'booking_status' | 'password_reset'

interface SendEmailParams {
  type: EmailType
  to: string
  data: Record<string, any>
}

/**
 * Send an email via the /api/email/send route.
 * Automatically includes the current user's auth token for authorization.
 */
export async function sendEmail({ type, to, data }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ type, to, data }),
    })

    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to send email' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('sendEmail error:', error)
    return { success: false, error: error.message || 'Network error' }
  }
}
