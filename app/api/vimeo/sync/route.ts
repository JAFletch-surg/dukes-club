import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Supabase (service role for admin-level DB access) ───────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Env ─────────────────────────────────────────────────────────

const VIMEO_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_FOLDER_ID = process.env.VIMEO_FOLDER_ID
const VIMEO_API = 'https://api.vimeo.com'

const VIMEO_HEADERS = {
  Authorization: `bearer ${VIMEO_TOKEN}`,
  Accept: 'application/vnd.vimeo.*+json;version=3.4',
}

const FIELDS = 'uri,name,description,duration,created_time,pictures.sizes,tags,privacy,embed.html,stats.plays'

// ── Types ───────────────────────────────────────────────────────

interface VimeoVideoData {
  uri: string
  name: string
  description: string | null
  duration: number
  created_time: string
  pictures: {
    sizes: Array<{ width: number; height: number; link: string }>
  }
  tags: Array<{ name: string }>
  privacy: { embed: string; view: string }
  embed?: { html?: string }
  stats?: { plays: number }
}

interface VimeoApiResponse {
  data: VimeoVideoData[]
  total: number
  paging: { next: string | null }
}

// ── Helpers ─────────────────────────────────────────────────────

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function extractVimeoId(uri: string): string {
  // URI can be /videos/123456 or /videos/123456:hash
  const last = uri.split('/').pop() || ''
  return last.split(':')[0]
}

function extractEmbedHash(video: VimeoVideoData): string | null {
  // Try URI first — unlisted videos use /videos/123456:hash format
  const uriPart = video.uri.split('/').pop() || ''
  if (uriPart.includes(':')) {
    return uriPart.split(':')[1] || null
  }
  // Fallback: extract ?h=... from embed HTML
  const html = video.embed?.html || ''
  const match = html.match(/[?&]h=([a-f0-9]+)/)
  return match?.[1] || null
}

function getBestThumbnail(
  pictures: VimeoVideoData['pictures']
): string | null {
  if (!pictures?.sizes?.length) return null
  const sorted = [...pictures.sizes].sort((a, b) => b.width - a.width)
  const preferred = sorted.find(s => s.width >= 640 && s.width <= 1280)
  return (preferred || sorted[0])?.link || null
}

// ── Fetch all videos from the Vimeo folder (paginated) ─────────

async function fetchAllFolderVideos(): Promise<VimeoVideoData[]> {
  const allVideos: VimeoVideoData[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = `${VIMEO_API}/me/projects/${VIMEO_FOLDER_ID}/videos?page=${page}&per_page=${perPage}&fields=${FIELDS}`

    const res = await fetch(url, { headers: VIMEO_HEADERS })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Vimeo API error ${res.status}: ${err}`)
    }

    const body: VimeoApiResponse = await res.json()
    allVideos.push(...body.data)

    if (!body.paging.next) break
    page++
  }

  return allVideos
}

// ── POST — full sync ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!VIMEO_TOKEN) {
      return NextResponse.json(
        { error: 'VIMEO_ACCESS_TOKEN not configured' },
        { status: 500 }
      )
    }
    if (!VIMEO_FOLDER_ID) {
      return NextResponse.json(
        { error: 'VIMEO_FOLDER_ID not configured' },
        { status: 500 }
      )
    }

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

    // Fetch all videos from the Vimeo folder
    const vimeoVideos = await fetchAllFolderVideos()

    // Get existing vimeo_ids from Supabase
    const { data: existingVideos } = await supabase
      .from('videos')
      .select('vimeo_id')

    const existingIds = new Set(
      (existingVideos || []).map((v: { vimeo_id: string }) => v.vimeo_id)
    )

    let created = 0
    let updated = 0
    let skipped = 0

    for (const video of vimeoVideos) {
      const vimeoId = extractVimeoId(video.uri)
      if (!vimeoId) { skipped++; continue }

      const thumbnail = getBestThumbnail(video.pictures)
      const tags = (video.tags || []).map(t => t.name)
      const embedHash = extractEmbedHash(video)

      if (existingIds.has(vimeoId)) {
        // Update existing — only sync Vimeo-owned fields, preserve manual edits
        const { error } = await supabase
          .from('videos')
          .update({
            thumbnail_url: thumbnail,
            duration_seconds: video.duration || 0,
            vimeo_plays: video.stats?.plays ?? 0,
            vimeo_privacy: video.privacy?.view || null,
            vimeo_embed_hash: embedHash,
            synced_at: new Date().toISOString(),
          })
          .eq('vimeo_id', vimeoId)

        if (error) {
          console.error(`[Vimeo Sync] Failed to update ${vimeoId}:`, error.message)
        } else {
          updated++
        }
      } else {
        // Insert new video
        const { error } = await supabase.from('videos').insert({
          vimeo_id: vimeoId,
          title: video.name || 'Untitled',
          slug: slugify(video.name || `video-${vimeoId}`),
          description: video.description?.trim() || null,
          duration_seconds: video.duration || 0,
          thumbnail_url: thumbnail,
          tags: tags.length > 0 ? tags : null,
          vimeo_created_at: video.created_time || null,
          vimeo_plays: video.stats?.plays ?? 0,
          vimeo_privacy: video.privacy?.view || null,
          vimeo_embed_hash: embedHash,
          is_members_only: true,
          status: 'published',
          published_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        })

        if (error) {
          console.error(`[Vimeo Sync] Failed to insert ${vimeoId}:`, error.message)
          skipped++
        } else {
          created++
        }
      }
    }

    // Archive videos no longer in the Vimeo folder (e.g. old account IDs)
    const folderVimeoIds = new Set(
      vimeoVideos.map(v => extractVimeoId(v.uri)).filter(Boolean)
    )
    const staleIds = (existingVideos || [])
      .map((v: { vimeo_id: string }) => v.vimeo_id)
      .filter(id => !folderVimeoIds.has(id))

    let archived = 0
    if (staleIds.length > 0) {
      const { error: archiveErr, count } = await supabase
        .from('videos')
        .update({ status: 'archived', synced_at: new Date().toISOString() })
        .in('vimeo_id', staleIds)
        .eq('status', 'published')

      if (archiveErr) {
        console.error('[Vimeo Sync] Failed to archive stale videos:', archiveErr.message)
      } else {
        archived = count ?? staleIds.length
      }
    }

    return NextResponse.json({
      success: true,
      total_on_vimeo: vimeoVideos.length,
      created,
      updated,
      skipped,
      archived,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Vimeo Sync] Error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── GET — preview / connection check ────────────────────────────

export async function GET() {
  try {
    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: 'VIMEO_ACCESS_TOKEN not configured' }, { status: 500 })
    }
    if (!VIMEO_FOLDER_ID) {
      return NextResponse.json({ error: 'VIMEO_FOLDER_ID not configured' }, { status: 500 })
    }

    const url = `${VIMEO_API}/me/projects/${VIMEO_FOLDER_ID}/videos?page=1&per_page=5&fields=uri,name,duration,pictures.sizes,stats.plays`

    const res = await fetch(url, { headers: VIMEO_HEADERS })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Vimeo API error: ${err}` }, { status: res.status })
    }

    const body: VimeoApiResponse = await res.json()

    return NextResponse.json({
      connected: true,
      total_videos: body.total || 0,
      preview: body.data.map(v => ({
        vimeo_id: extractVimeoId(v.uri),
        title: v.name,
        duration: v.duration,
      })),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
