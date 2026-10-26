import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRequest } from '@/lib/supabase/admin-request'

const USERS_PER_PAGE = 1000
const MAX_USER_PAGES = 50

/**
 * IDs of every account whose email address is still unconfirmed.
 *
 * Confirmation state lives in auth.users, which the browser cannot read, so
 * the members page asks here and overlays the result on the profiles list.
 * Pages through listUsers() in full — the default page only covers the first
 * handful of members.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request)
  if (!auth.ok) return auth.response

  const userIds: string[] = []

  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await auth.supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })

    if (error) {
      console.error('Error listing users for unverified check:', error)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    const users = data?.users ?? []
    for (const user of users) {
      if (!user.email_confirmed_at) userIds.push(user.id)
    }

    if (users.length < USERS_PER_PAGE) break
  }

  return NextResponse.json({ userIds })
}
