import { createClient } from '@/lib/supabase/client'

export type ConfirmEmailResult =
  | { success: true; alreadyVerified: boolean }
  | { success: false; error: string }

/** Ask the server to mark a member's email verified. Admin only. */
export async function confirmMemberEmail(userId: string): Promise<ConfirmEmailResult> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch('/api/admin/members/confirm-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ userId }),
    })

    const result = await response.json()
    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to mark email as verified' }
    }
    return { success: true, alreadyVerified: !!result.alreadyVerified }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}
