'use client'

import { useEffect, useRef } from 'react'
import { Twitter, Instagram, Linkedin } from 'lucide-react'

const TWITTER_HANDLE = 'dukes_club'
const INSTAGRAM_HANDLE = 'the_dukesclub'
const LINKEDIN_URL = 'https://www.linkedin.com/in/the-dukes-club-4a3492327/'

function TwitterEmbed() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    ref.current?.appendChild(script)
  }, [])

  return (
    <div ref={ref} className="min-h-[400px]">
      <a
        className="twitter-timeline"
        data-height="500"
        data-theme="dark"
        data-chrome="noheader nofooter noborders transparent"
        href={`https://twitter.com/${TWITTER_HANDLE}`}
      >
        Loading tweets...
      </a>
    </div>
  )
}

function InstagramEmbed() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://www.instagram.com/embed.js'
    script.async = true
    ref.current?.appendChild(script)
    return () => {
      if ((window as any).instgrm) {
        (window as any).instgrm.Embeds.process()
      }
    }
  }, [])

  return (
    <div ref={ref} className="min-h-[400px] flex items-center justify-center">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`https://www.instagram.com/${INSTAGRAM_HANDLE}/`}
        data-instgrm-version="14"
        style={{
          background: 'transparent',
          border: 0,
          margin: '0 auto',
          maxWidth: '100%',
          width: '100%',
          padding: 0,
        }}
      >
        <a href={`https://www.instagram.com/${INSTAGRAM_HANDLE}/`}>Loading Instagram...</a>
      </blockquote>
    </div>
  )
}

function LinkedInEmbed() {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center rounded-lg border border-navy-foreground/10 bg-navy-foreground/5 p-8 text-center">
      <div className="p-3 rounded-full bg-[#0A66C2]/10 mb-4">
        <Linkedin size={28} className="text-[#0A66C2]" />
      </div>
      <h3 className="text-lg font-semibold text-navy-foreground mb-2">
        Dukes&apos; Club on LinkedIn
      </h3>
      <p className="text-sm text-navy-foreground/60 mb-5 max-w-xs">
        Follow us for updates on training opportunities, research fellowships, and career development.
      </p>
      <a
        href={LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A66C2] text-white text-sm font-semibold hover:bg-[#094d92] transition-colors"
      >
        <Linkedin size={16} />
        Follow on LinkedIn
      </a>
    </div>
  )
}

const SocialFeedSection = () => {
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
          <a href={`https://twitter.com/${TWITTER_HANDLE}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-[#1DA1F2] text-sm font-medium hover:opacity-80 transition-opacity">
            <Twitter size={16} /> Follow on X
          </a>
          <a href={`https://instagram.com/${INSTAGRAM_HANDLE}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E4405F]/20 bg-[#E4405F]/10 text-[#E4405F] text-sm font-medium hover:opacity-80 transition-opacity">
            <Instagram size={16} /> Follow on Instagram
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#0A66C2]/20 bg-[#0A66C2]/10 text-[#0A66C2] text-sm font-medium hover:opacity-80 transition-opacity">
            <Linkedin size={16} /> Follow on LinkedIn
          </a>
        </div>

        {/* Embedded feeds */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg overflow-hidden">
            <TwitterEmbed />
          </div>
          <div className="rounded-lg overflow-hidden">
            <InstagramEmbed />
          </div>
          <div className="rounded-lg overflow-hidden">
            <LinkedInEmbed />
          </div>
        </div>
      </div>
    </section>
  )
}

export default SocialFeedSection
