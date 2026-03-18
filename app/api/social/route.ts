import { NextResponse } from 'next/server'

export type SocialPost = {
  id: string
  platform: 'twitter' | 'linkedin' | 'instagram'
  text: string
  date: string
  url: string
  imageUrl?: string
  author: string
  handle: string
  likes?: number
  retweets?: number
}

// TODO: Replace placeholder data with real API calls once keys are configured.
// Required env vars:
//   TWITTER_BEARER_TOKEN   – Twitter API v2 bearer token
//   INSTAGRAM_ACCESS_TOKEN – Instagram Graph API long-lived token
//   LINKEDIN_ACCESS_TOKEN  – LinkedIn Page API token
//
// Each fetcher below has a stub you can swap in.

async function fetchTwitterPosts(): Promise<SocialPost[]> {
  const token = process.env.TWITTER_BEARER_TOKEN
  if (token) {
    try {
      const res = await fetch(
        'https://api.twitter.com/2/users/me/tweets?max_results=5&tweet.fields=created_at,public_metrics',
        { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } }
      )
      if (res.ok) {
        const json = await res.json()
        return (json.data ?? []).map((t: any) => ({
          id: `tw-${t.id}`,
          platform: 'twitter' as const,
          text: t.text,
          date: t.created_at,
          url: `https://twitter.com/i/status/${t.id}`,
          author: "Dukes' Club",
          handle: '@DukesClubUK',
          likes: t.public_metrics?.like_count,
          retweets: t.public_metrics?.retweet_count,
        }))
      }
    } catch { /* fall through to placeholders */ }
  }

  return [
    {
      id: 'tw-placeholder-1',
      platform: 'twitter',
      text: 'Excited to announce our Annual Colorectal Surgery Weekend 2026! Early-bird registration now open. #ColorectalSurgery #DukesClub',
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      url: '#',
      author: "Dukes' Club",
      handle: '@DukesClubUK',
      likes: 42,
      retweets: 12,
    },
    {
      id: 'tw-placeholder-2',
      platform: 'twitter',
      text: 'Congratulations to our members who passed the FRCS this session! The hard work pays off. 🎉',
      date: new Date(Date.now() - 5 * 86400000).toISOString(),
      url: '#',
      author: "Dukes' Club",
      handle: '@DukesClubUK',
      likes: 87,
      retweets: 23,
    },
  ]
}

async function fetchInstagramPosts(): Promise<SocialPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (token) {
    try {
      const res = await fetch(
        `https://graph.instagram.com/me/media?fields=id,caption,timestamp,permalink,media_url&limit=5&access_token=${token}`,
        { next: { revalidate: 300 } }
      )
      if (res.ok) {
        const json = await res.json()
        return (json.data ?? []).map((p: any) => ({
          id: `ig-${p.id}`,
          platform: 'instagram' as const,
          text: p.caption ?? '',
          date: p.timestamp,
          url: p.permalink,
          imageUrl: p.media_url,
          author: "Dukes' Club",
          handle: '@dukesclub',
        }))
      }
    } catch { /* fall through to placeholders */ }
  }

  return [
    {
      id: 'ig-placeholder-1',
      platform: 'instagram',
      text: 'Great turnout at our latest hands-on simulation course! Thank you to all the trainers and trainees who made it a success.',
      date: new Date(Date.now() - 3 * 86400000).toISOString(),
      url: '#',
      author: "Dukes' Club",
      handle: '@dukesclub',
    },
    {
      id: 'ig-placeholder-2',
      platform: 'instagram',
      text: 'Behind the scenes at our committee meeting — planning exciting events for the year ahead! Stay tuned.',
      date: new Date(Date.now() - 7 * 86400000).toISOString(),
      url: '#',
      author: "Dukes' Club",
      handle: '@dukesclub',
    },
  ]
}

async function fetchLinkedInPosts(): Promise<SocialPost[]> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  if (token) {
    try {
      // LinkedIn Page posts API – requires page admin token
      const res = await fetch(
        'https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:organization:DUKES_ORG_ID&count=5',
        { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } }
      )
      if (res.ok) {
        const json = await res.json()
        return (json.elements ?? []).map((p: any, i: number) => ({
          id: `li-${i}`,
          platform: 'linkedin' as const,
          text: p.text?.text ?? '',
          date: new Date(p.created?.time ?? Date.now()).toISOString(),
          url: '#',
          author: "Dukes' Club",
          handle: "Dukes' Club",
        }))
      }
    } catch { /* fall through to placeholders */ }
  }

  return [
    {
      id: 'li-placeholder-1',
      platform: 'linkedin',
      text: "We're proud to support the next generation of colorectal surgeons. Read about our latest mentorship programme and how you can get involved.",
      date: new Date(Date.now() - 1 * 86400000).toISOString(),
      url: '#',
      author: "Dukes' Club",
      handle: "Dukes' Club",
      likes: 56,
    },
    {
      id: 'li-placeholder-2',
      platform: 'linkedin',
      text: 'Applications are now open for our Research Fellowship 2026. A fantastic opportunity for trainees passionate about colorectal research.',
      date: new Date(Date.now() - 4 * 86400000).toISOString(),
      url: '#',
      author: "Dukes' Club",
      handle: "Dukes' Club",
      likes: 34,
    },
  ]
}

export async function GET() {
  const [twitter, instagram, linkedin] = await Promise.all([
    fetchTwitterPosts(),
    fetchInstagramPosts(),
    fetchLinkedInPosts(),
  ])

  const posts = [...twitter, ...instagram, ...linkedin].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return NextResponse.json({ posts })
}
