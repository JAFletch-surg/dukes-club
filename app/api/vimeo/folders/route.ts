import { NextRequest, NextResponse } from 'next/server'
import {
  VIMEO_TOKEN,
  VIMEO_API,
  VIMEO_HEADERS,
  extractIdFromUri,
  requireAdmin,
} from '../_shared'

// ── Types ───────────────────────────────────────────────────────

interface VimeoProject {
  uri: string
  name: string
  metadata?: {
    connections?: {
      videos?: { total?: number }
    }
  }
}

interface VimeoProjectsResponse {
  data: VimeoProject[]
  total: number
  paging: { next: string | null }
}

export interface VimeoFolderSummary {
  folder_id: string
  name: string
  video_count: number
}

const FIELDS = 'uri,name,metadata.connections.videos.total'

// ── Fetch every folder on the account (paginated) ───────────────

async function fetchAllProjects(): Promise<VimeoFolderSummary[]> {
  const folders: VimeoFolderSummary[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = `${VIMEO_API}/me/projects?page=${page}&per_page=${perPage}&fields=${FIELDS}`

    const res = await fetch(url, { headers: VIMEO_HEADERS })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Vimeo API error ${res.status}: ${err}`)
    }

    const body: VimeoProjectsResponse = await res.json()

    for (const project of body.data) {
      const folderId = extractIdFromUri(project.uri)
      if (!folderId) continue
      folders.push({
        folder_id: folderId,
        name: project.name || 'Untitled folder',
        video_count: project.metadata?.connections?.videos?.total ?? 0,
      })
    }

    if (!body.paging.next) break
    page++
  }

  return folders
}

// ── GET — list the folders available on the Vimeo account ───────

export async function GET(request: NextRequest) {
  try {
    if (!VIMEO_TOKEN) {
      return NextResponse.json(
        { error: 'VIMEO_ACCESS_TOKEN not configured' },
        { status: 500 }
      )
    }

    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const folders = await fetchAllProjects()

    return NextResponse.json({
      folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
      // The folder the site synced before folders were managed in the admin
      // panel. The UI uses this to seed vimeo_folders on first open.
      env_folder_id: process.env.VIMEO_FOLDER_ID || null,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Vimeo Folders] Error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
