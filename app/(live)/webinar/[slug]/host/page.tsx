import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HostStudio } from './host-studio'

export const dynamic = 'force-dynamic'

/**
 * The host console. Outside /admin (so it shares the full-bleed live shell
 * with the other two surfaces), which means the admin-role check has to
 * happen here rather than in middleware.
 */
export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/webinar/${slug}/host`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'super_admin', 'editor'].includes(profile?.role ?? '')) {
    redirect('/members')
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, slug, starts_at')
    .eq('slug', slug)
    .maybeSingle()

  if (!event) redirect('/admin/webinars')

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('*')
    .eq('event_id', event.id)
    .maybeSingle()

  if (!session) redirect('/admin/webinars')

  return (
    <HostStudio
      event={event as any}
      initialSession={session as any}
      userId={user.id}
      displayName={profile?.full_name || 'Host'}
    />
  )
}
