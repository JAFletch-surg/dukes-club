import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AttendeeRoom } from './attendee-room'

export const dynamic = 'force-dynamic'

/**
 * The attendee surface. Server component so an unauthenticated visitor is
 * bounced to login before any of the client bundle loads — this route sits
 * outside the /members middleware gate, so the check has to happen here.
 */
export default async function WebinarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/webinar/${slug}`)

  const { data: event } = await supabase
    .from('events')
    .select('id, title, slug, description_plain, starts_at, ends_at, featured_image_url, capacity, auto_approve, event_type, stream_type')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!event) redirect('/members/webinars')

  const { data: session } = await supabase
    .from('webinar_sessions')
    .select('*')
    .eq('event_id', event.id)
    .maybeSingle()

  // An event without a live room is a Zoom/Vimeo-Live webinar — those still
  // live on the webinars index page.
  if (!session) redirect(`/events/${slug}`)

  const { data: booking } = await supabase
    .from('event_bookings')
    .select('id, status')
    .eq('event_id', event.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <AttendeeRoom
      event={event as any}
      initialSession={session as any}
      booking={booking as any}
      userId={user.id}
      displayName={profile?.full_name || 'Member'}
      isAdmin={['admin', 'super_admin', 'editor'].includes(profile?.role ?? '')}
    />
  )
}
