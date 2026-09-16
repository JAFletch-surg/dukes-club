import { NextRequest, NextResponse } from 'next/server'
import { bearerClient } from '@/lib/supabase/bearer'
import { canAccessVideo } from '@/lib/membership-gates'
import type { Profile } from '@/lib/auth-provider'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/videos/[id]/playback
 *
 * The only place the Vimeo identifiers for a video reach the browser. The
 * archive listing deliberately selects every column EXCEPT vimeo_id and
 * vimeo_embed_hash (app/members/videos/page.tsx), so a locked card cannot be
 * played by reading the row it was rendered from — the lock in the UI and the
 * check here guard the same thing, and this one is the one that counts.
 *
 * Bearer-authenticated like the rest of /api. RLS still decides which video
 * rows are visible at all; this adds the membership gate on top of that.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const authed = await bearerClient(request)
  if (!authed) {
    return NextResponse.json(
      { error: 'Not authenticated — please log in again' },
      { status: 401 }
    )
  }
  const { supabase, userId } = authed
  const { id } = await ctx.params

  const { data: video, error } = await supabase
    .from('videos')
    .select('id, status, is_members_only, vimeo_id, vimeo_embed_hash')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[Video Playback] Lookup failed:', error.message)
    return NextResponse.json({ error: 'Could not load this video' }, { status: 500 })
  }
  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, approval_status, region, member_category, country, training_stage, avatar_url, acpgbi_number, gmc_number, created_at')
    .eq('id', userId)
    .maybeSingle()

  // Admins reach drafts and archived videos through the admin area; everyone
  // else only ever plays what is published.
  const isAdmin = ['admin', 'super_admin', 'editor'].includes(profile?.role ?? '')
  if (video.status !== 'published' && !isAdmin) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (!canAccessVideo(profile as Profile | null, video)) {
    return NextResponse.json(
      {
        error: 'This video is for Dukes’ Club members',
        locked: true,
      },
      { status: 403 }
    )
  }

  return NextResponse.json({
    vimeo_id: video.vimeo_id,
    vimeo_embed_hash: video.vimeo_embed_hash,
  })
}
