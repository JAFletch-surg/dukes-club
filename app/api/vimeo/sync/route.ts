import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  VIMEO_TOKEN,
  VIMEO_API,
  VIMEO_HEADERS,
  extractIdFromUri,
  requireAdmin,
} from '../_shared'

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

interface SyncFolder {
  /** vimeo_folders row id — null when falling back to VIMEO_FOLDER_ID */
  id: string | null
  folder_id: string
  name: string
}

interface FolderFailure {
  folder_id: string
  name: string
  message: string
}

interface FolderResult {
  folder_id: string
  name: string
  video_count: number
}

// ── Helpers ─────────────────────────────────────────────────────

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

// ── Which folders to sync ───────────────────────────────────────

/**
 * Active rows from vimeo_folders, or the legacy VIMEO_FOLDER_ID env var when
 * no folders have been added in the admin panel yet. The fallback keeps the
 * site syncing exactly as it did before folders became admin-managed.
 */
async function getActiveFolders(supabase: SupabaseClient): Promise<SyncFolder[]> {
  const { data, error } = await supabase
    .from('vimeo_folders')
    .select('id, folder_id, name')
    .eq('is_active', true)
    .order('created_at')

  if (error) {
    // Table missing (migration not run yet) — fall through to the env var
    console.error('[Vimeo Sync] Could not read vimeo_folders:', error.message)
  }

  if (data && data.length > 0) {
    return data as SyncFolder[]
  }

  const envFolder = process.env.VIMEO_FOLDER_ID
  if (envFolder) {
    return [{ id: null, folder_id: envFolder, name: 'VIMEO_FOLDER_ID' }]
  }

  return []
}

// ── Fetch all videos across the active folders (paginated) ──────

async function fetchFolderVideos(folderId: string): Promise<VimeoVideoData[]> {
  const videos: VimeoVideoData[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = `${VIMEO_API}/me/projects/${folderId}/videos?page=${page}&per_page=${perPage}&fields=${FIELDS}`

    const res = await fetch(url, { headers: VIMEO_HEADERS })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Vimeo API error ${res.status}: ${err}`)
    }

    const body: VimeoApiResponse = await res.json()
    videos.push(...body.data)

    if (!body.paging.next) break
    page++
  }

  return videos
}

/**
 * Fetch every active folder. A folder that fails (deleted on Vimeo, transient
 * error) is recorded rather than thrown, so one bad folder can't abort a sync
 * of the others — but its videos must not then be treated as stale.
 */
async function fetchAllFolderVideos(folders: SyncFolder[]): Promise<{
  videos: Array<VimeoVideoData & { folderId: string }>
  results: FolderResult[]
  failures: FolderFailure[]
}> {
  const videos: Array<VimeoVideoData & { folderId: string }> = []
  const results: FolderResult[] = []
  const failures: FolderFailure[] = []
  const seen = new Set<string>()

  for (const folder of folders) {
    try {
      const folderVideos = await fetchFolderVideos(folder.folder_id)

      let counted = 0
      for (const video of folderVideos) {
        const vimeoId = extractIdFromUri(video.uri)
        // A video can appear in only one Vimeo folder, but guard anyway —
        // first folder wins so a duplicate can't be written twice.
        if (!vimeoId || seen.has(vimeoId)) continue
        seen.add(vimeoId)
        videos.push({ ...video, folderId: folder.folder_id })
        counted++
      }

      results.push({
        folder_id: folder.folder_id,
        name: folder.name,
        video_count: counted,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Vimeo Sync] Folder ${folder.folder_id} failed:`, message)
      failures.push({
        folder_id: folder.folder_id,
        name: folder.name,
        message,
      })
    }
  }

  return { videos, results, failures }
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

    // Auth check — only admins can trigger sync
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    const folders = await getActiveFolders(supabase)
    if (folders.length === 0) {
      return NextResponse.json(
        { error: 'No Vimeo folders configured — add one in Admin → Videos → Manage Folders' },
        { status: 400 }
      )
    }

    // Fetch all videos across the active folders
    const { videos: vimeoVideos, results, failures } = await fetchAllFolderVideos(folders)

    if (results.length === 0) {
      return NextResponse.json(
        {
          error: 'Could not read any of the configured Vimeo folders',
          failures,
        },
        { status: 502 }
      )
    }

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
      const vimeoId = extractIdFromUri(video.uri)
      if (!vimeoId) { skipped++; continue }

      const thumbnail = getBestThumbnail(video.pictures)
      const tags = (video.tags || []).map(t => t.name)
      const embedHash = extractEmbedHash(video)

      if (existingIds.has(vimeoId)) {
        // Update existing — only sync Vimeo-owned fields, preserve manual edits.
        // vimeo_folder_id is refreshed because a video can be moved on Vimeo.
        // event_id is deliberately absent: it is set by the webinar recording
        // pipeline and must survive every subsequent sync.
        const { error } = await supabase
          .from('videos')
          .update({
            thumbnail_url: thumbnail,
            duration_seconds: video.duration || 0,
            vimeo_plays: video.stats?.plays ?? 0,
            vimeo_privacy: video.privacy?.view || null,
            vimeo_embed_hash: embedHash,
            vimeo_folder_id: video.folderId,
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
          vimeo_folder_id: video.folderId,
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

    // Archive videos no longer in any synced folder.
    // Skipped entirely when a folder failed to load — otherwise a transient
    // error on one folder would archive every video that lives in it.
    const archiveSkipped = failures.length > 0
    let archived = 0

    if (!archiveSkipped) {
      const folderVimeoIds = new Set(
        vimeoVideos.map(v => extractIdFromUri(v.uri)).filter(Boolean)
      )
      const staleIds = (existingVideos || [])
        .map((v: { vimeo_id: string }) => v.vimeo_id)
        .filter(id => !folderVimeoIds.has(id))

      if (staleIds.length > 0) {
        const { error: archiveErr, count } = await supabase
          .from('videos')
          .update({ status: 'archived', synced_at: new Date().toISOString() })
          .in('vimeo_id', staleIds)
          .eq('status', 'published')
          // Webinar recordings are published by the live-webinar pipeline, not
          // by this sync. If VIMEO_RECORDINGS_FOLDER_ID has not been registered
          // in vimeo_folders, they would look "stale" here and get archived out
          // from under the webinar that produced them.
          .is('event_id', null)

        if (archiveErr) {
          console.error('[Vimeo Sync] Failed to archive stale videos:', archiveErr.message)
        } else {
          archived = count ?? staleIds.length
        }
      }
    }

    // Stamp each folder row that synced cleanly
    const syncedAt = new Date().toISOString()
    for (const result of results) {
      const folder = folders.find(f => f.folder_id === result.folder_id)
      if (!folder?.id) continue
      const { error } = await supabase
        .from('vimeo_folders')
        .update({ last_synced_at: syncedAt, video_count: result.video_count })
        .eq('id', folder.id)
      if (error) {
        console.error(`[Vimeo Sync] Failed to stamp folder ${folder.folder_id}:`, error.message)
      }
    }

    return NextResponse.json({
      success: true,
      total_on_vimeo: vimeoVideos.length,
      created,
      updated,
      skipped,
      archived,
      archive_skipped: archiveSkipped,
      folders: results,
      failures,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Vimeo Sync] Error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── GET — preview / connection check ────────────────────────────

export async function GET(request: NextRequest) {
  try {
    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: 'VIMEO_ACCESS_TOKEN not configured' }, { status: 500 })
    }

    // Admin-only — this now reports folder names and counts
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    const folders = await getActiveFolders(supabase)

    if (folders.length === 0) {
      return NextResponse.json({
        connected: false,
        error: 'No Vimeo folders configured',
        folders: [],
        using_env_fallback: false,
      })
    }

    const usingEnvFallback = folders.length === 1 && folders[0].id === null

    const perFolder: Array<{
      folder_id: string
      name: string
      total_videos: number
      error?: string
    }> = []

    for (const folder of folders) {
      const url = `${VIMEO_API}/me/projects/${folder.folder_id}/videos?page=1&per_page=1&fields=uri`
      const res = await fetch(url, { headers: VIMEO_HEADERS })

      if (!res.ok) {
        perFolder.push({
          folder_id: folder.folder_id,
          name: folder.name,
          total_videos: 0,
          error: `Vimeo API error ${res.status}`,
        })
        continue
      }

      const body: VimeoApiResponse = await res.json()
      perFolder.push({
        folder_id: folder.folder_id,
        name: folder.name,
        total_videos: body.total || 0,
      })
    }

    return NextResponse.json({
      connected: perFolder.some(f => !f.error),
      total_videos: perFolder.reduce((sum, f) => sum + f.total_videos, 0),
      folders: perFolder,
      using_env_fallback: usingEnvFallback,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
