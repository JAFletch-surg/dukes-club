import { SpeakerRoom } from './speaker-room'

export const dynamic = 'force-dynamic'

/**
 * The guest-speaker surface.
 *
 * Deliberately does NO server-side Supabase check: a visiting speaker has no
 * account here. The magic-link token in ?t= is the credential, and it is
 * verified server-side by /api/webinars/speaker-token, which is the only thing
 * that can mint them a LiveKit token.
 */
export default async function SpeakerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <SpeakerRoom slug={slug} />
}
