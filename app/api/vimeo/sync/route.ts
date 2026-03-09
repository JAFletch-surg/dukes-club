import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const VIMEO_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API = 'https://api.vimeo.com'

interface VimeoVideo {
  uri: string
  name: string
  description: string | null
  duration: number
  created_time: string
  modified_time: string
  pictures: {
    sizes: { width: number; height: number; link: string }[]
  }
  tags: { name: string }[]
  stats: { plays: number }
  privacy: { view: string }
  status: string
  embed: { html: string }
  link: string
}

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function extractVimeoId(uri: string): string {
  // uri is like "/videos/123456789"
  return uri.split('/').pop() || ''
}

function getBestThumbnail(pictures: VimeoVideo['pictures']): string | null {
  if (!pictures?.sizes?.length) return null
  // Pick the largest size that's not ridiculously huge
  const sorted = [...pictures.sizes].sort((a, b) => b.width - a.width)
  // Prefer something around 640-1280px wide
  const preferred = sorted.find(s => s.width >= 640 && s.width <= 1280)
  return (preferred || sorted[0])?.link || null
}

async function fetchAllVimeoVideos(): Promise<VimeoVideo[]> {
  const allVideos: VimeoVideo[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const res = await fetch(
      `${VIMEO_API}/me/videos?page=${page}&per_page=${perPage}&fields=uri,name,description,duration,created_time,modified_time,pictures.sizes,tags.name,stats.plays,privacy.view,status,embed.html,link`,
      {
        headers: {
          Authorization: `Bearer ${VIMEO_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Vimeo API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    allVideos.push(...(data.data || []))

    // Check if there are more pages
    if (!data.paging?.next) break
    page++
  }

  return allVideos
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    // Auth check — only admins can trigger sync
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: 'VIMEO_ACCESS_TOKEN not configured' }, { status: 500 })
    }

    // Fetch all videos from Vimeo
    const vimeoVideos = await fetchAllVimeoVideos()

    // Get existing videos from Supabase to check what's already synced
    const { data: existingVideos } = await supabase
      .from('videos')
      .select('vimeo_id')

    const existingIds = new Set((existingVideos || []).map((v: any) => v.vimeo_id))

    let created = 0
    let updated = 0
    let skipped = 0

    for (const video of vimeoVideos) {
      const vimeoId = extractVimeoId(video.uri)
      if (!vimeoId) { skipped++; continue }

      // Skip videos that aren't available/playable
      if (video.status !== 'available') { skipped++; continue }

      const thumbnail = getBestThumbnail(video.pictures)
      const tags = (video.tags || []).map((t: any) => t.name)

      const row = {
        vimeo_id: vimeoId,
        title: video.name || 'Untitled',
        slug: slugify(video.name || `video-${vimeoId}`),
        description: video.description || null,
        duration_seconds: video.duration || 0,
        thumbnail_url: thumbnail,
        tags: tags.length > 0 ? tags : null,
        vimeo_plays: video.stats?.plays || 0,
        vimeo_created_at: video.created_time || null,
        vimeo_privacy: video.privacy?.view || null,
        is_members_only: true,
        status: 'published',
        published_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }

      if (existingIds.has(vimeoId)) {
        // Update existing — don't overwrite manual edits to title/description/status
        const { error } = await supabase
          .from('videos')
          .update({
            thumbnail_url: thumbnail,
            duration_seconds: video.duration || 0,
            vimeo_plays: video.stats?.plays || 0,
            tags: tags.length > 0 ? tags : null,
            vimeo_privacy: video.privacy?.view || null,
            synced_at: new Date().toISOString(),
          })
          .eq('vimeo_id', vimeoId)

        if (error) {
          console.error(`[Vimeo Sync] Failed to update ${vimeoId}:`, error.message)
        } else {
          updated++
        }
      } else {
        // Insert new
        const { error } = await supabase.from('videos').insert(row)
        if (error) {
          console.error(`[Vimeo Sync] Failed to insert ${vimeoId}:`, error.message)
          skipped++
        } else {
          created++
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_on_vimeo: vimeoVideos.length,
      created,
      updated,
      skipped,
    })
  } catch (error: any) {
    console.error('[Vimeo Sync] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}

// GET endpoint to check sync status / preview what would be synced
export async function GET(request: NextRequest) {
  try {
    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: 'VIMEO_ACCESS_TOKEN not configured' }, { status: 500 })
    }

    // Just fetch first page to show a preview
    const res = await fetch(
      `${VIMEO_API}/me/videos?page=1&per_page=5&fields=uri,name,duration,pictures.sizes,status`,
      {
        headers: {
          Authorization: `Bearer ${VIMEO_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Vimeo API error: ${err}` }, { status: res.status })
    }

    const data = await res.json()

    return NextResponse.json({
      connected: true,
      total_videos: data.total || 0,
      preview: (data.data || []).map((v: any) => ({
        vimeo_id: extractVimeoId(v.uri),
        title: v.name,
        duration: v.duration,
        status: v.status,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
