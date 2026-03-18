'use client'

import { useEffect, useState } from 'react'
import { Twitter, Instagram, Linkedin, Heart, Repeat2, ExternalLink, Loader } from 'lucide-react'
import type { SocialPost } from '@/app/api/social/route'

const platformConfig = {
  twitter: {
    icon: Twitter,
    label: 'Twitter',
    color: 'text-[#1DA1F2]',
    bg: 'bg-[#1DA1F2]/10',
    border: 'border-[#1DA1F2]/20',
    url: '#', // TODO: replace with real Twitter/X profile URL
  },
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color: 'text-[#E4405F]',
    bg: 'bg-[#E4405F]/10',
    border: 'border-[#E4405F]/20',
    url: '#', // TODO: replace with real Instagram profile URL
  },
  linkedin: {
    icon: Linkedin,
    label: 'LinkedIn',
    color: 'text-[#0A66C2]',
    bg: 'bg-[#0A66C2]/10',
    border: 'border-[#0A66C2]/20',
    url: '#', // TODO: replace with real LinkedIn page URL
  },
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const SocialFeedSection = () => {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'twitter' | 'instagram' | 'linkedin'>('all')

  useEffect(() => {
    fetch('/api/social')
      .then((r) => r.json())
      .then((data) => setPosts(data.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.platform === filter)

  return (
    <section className="py-20 bg-navy text-navy-foreground">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-2">
            Stay Connected
          </p>
          <h2 className="text-3xl md:text-4xl font-sans font-bold">
            Follow Us on Social Media
          </h2>
          <p className="mt-3 text-navy-foreground/60 max-w-2xl mx-auto text-sm md:text-base">
            Keep up with the latest from the Dukes&apos; Club across our social channels.
          </p>
        </div>

        {/* Follow buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {Object.entries(platformConfig).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <a
                key={key}
                href={cfg.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${cfg.border} ${cfg.bg} ${cfg.color} text-sm font-medium hover:opacity-80 transition-opacity`}
              >
                <Icon size={16} />
                Follow on {cfg.label}
              </a>
            )
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {(['all', 'twitter', 'instagram', 'linkedin'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab
                  ? 'bg-gold text-navy'
                  : 'bg-navy-foreground/10 text-navy-foreground/60 hover:text-navy-foreground'
              }`}
            >
              {tab === 'all' ? 'All' : platformConfig[tab].label}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader className="animate-spin text-navy-foreground/40" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-navy-foreground/40">No posts to show.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((post) => {
              const cfg = platformConfig[post.platform]
              const Icon = cfg.icon
              return (
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-navy-foreground/10 bg-navy-foreground/5 p-5 hover:border-gold/30 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Post header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-full ${cfg.bg}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{post.author}</p>
                        <p className="text-xs text-navy-foreground/50">{post.handle}</p>
                      </div>
                    </div>
                    <span className="text-xs text-navy-foreground/40">{timeAgo(post.date)}</span>
                  </div>

                  {/* Post body */}
                  <p className="text-sm text-navy-foreground/80 leading-relaxed mb-3 line-clamp-4">
                    {post.text}
                  </p>

                  {post.imageUrl && (
                    <div className="rounded-md overflow-hidden mb-3">
                      <img src={post.imageUrl} alt="" className="w-full h-40 object-cover" />
                    </div>
                  )}

                  {/* Post footer */}
                  <div className="flex items-center gap-4 text-xs text-navy-foreground/40">
                    {post.likes != null && (
                      <span className="flex items-center gap-1">
                        <Heart size={12} /> {post.likes}
                      </span>
                    )}
                    {post.retweets != null && (
                      <span className="flex items-center gap-1">
                        <Repeat2 size={12} /> {post.retweets}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-gold">
                      View <ExternalLink size={12} />
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default SocialFeedSection
