import { NextRequest, NextResponse } from 'next/server'

const VIMEO_TOKEN = process.env.VIMEO_ACCESS_TOKEN
const VIMEO_API = 'https://api.vimeo.com'

function getBestThumbnail(pictures: any): string | null {
  if (!pictures?.sizes?.length) return null
  const sorted = [...pictures.sizes].sort((a: any, b: any) => b.width - a.width)
  const preferred = sorted.find((s: any) => s.width >= 640 && s.width <= 1280)
  return (preferred || sorted[0])?.link || null
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    if (!VIMEO_TOKEN) {
      return NextResponse.json({ error: 'VIMEO_ACCESS_TOKEN not configured' }, { status: 500 })
    }

    const res = await fetch(
      `${VIMEO_API}/videos/${id}?fields=name,description,duration,pictures.sizes,stats.plays`,
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

    const video = await res.json()

    return NextResponse.json({
      name: video.name || null,
      description: video.description || null,
      duration: video.duration || 0,
      thumbnail_url: getBestThumbnail(video.pictures),
      plays: video.stats?.plays ?? 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
