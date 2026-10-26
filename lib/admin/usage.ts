import { createClient } from '@/lib/supabase/client'
import type { UsageSummary } from './usage-types'

export type UsageResult =
  | { success: true; data: UsageSummary }
  | { success: false; error: string }

/** Load the site usage summary. Super admin only. */
export async function fetchUsageSummary(rangeDays: number): Promise<UsageResult> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(`/api/admin/usage?range=${rangeDays}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to load usage data' }
    }
    return { success: true, data: result as UsageSummary }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}
