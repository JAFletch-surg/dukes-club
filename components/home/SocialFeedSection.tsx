import { Twitter, Instagram, Linkedin } from 'lucide-react'

const TWITTER_HANDLE = 'dukes_club'
const INSTAGRAM_HANDLE = 'the_dukesclub'
const LINKEDIN_URL = 'https://www.linkedin.com/in/the-dukes-club-4a3492327/'

function SocialCard({
  icon: Icon,
  color,
  name,
  handle,
  description,
  href,
  buttonLabel,
}: {
  icon: typeof Twitter
  color: string
  name: string
  handle: string
  description: string
  href: string
  buttonLabel: string
}) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center rounded-lg border border-navy-foreground/10 bg-navy-foreground/5 p-8 text-center">
      <div className={`p-3 rounded-full mb-4`} style={{ backgroundColor: `${color}15` }}>
        <Icon size={28} style={{ color }} />
      </div>
      <h3 className="text-lg font-semibold text-navy-foreground mb-1">
        {name}
      </h3>
      <p className="text-sm text-navy-foreground/40 mb-3">{handle}</p>
      <p className="text-sm text-navy-foreground/60 mb-5 max-w-xs">
        {description}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold transition-colors hover:opacity-90"
        style={{ backgroundColor: color }}
      >
        <Icon size={16} />
        {buttonLabel}
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

        {/* Social cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SocialCard
            icon={Twitter}
            color="#1DA1F2"
            name="Dukes' Club on X"
            handle={`@${TWITTER_HANDLE}`}
            description="Follow us for the latest updates, event highlights, and community news."
            href={`https://twitter.com/${TWITTER_HANDLE}`}
            buttonLabel="Follow on X"
          />
          <SocialCard
            icon={Instagram}
            color="#E4405F"
            name="Dukes' Club on Instagram"
            handle={`@${INSTAGRAM_HANDLE}`}
            description="Behind-the-scenes, event photos, and stories from our community."
            href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
            buttonLabel="Follow on Instagram"
          />
          <SocialCard
            icon={Linkedin}
            color="#0A66C2"
            name="Dukes' Club on LinkedIn"
            handle="The Dukes' Club"
            description="Follow us for updates on training opportunities, research fellowships, and career development."
            href={LINKEDIN_URL}
            buttonLabel="Follow on LinkedIn"
          />
        </div>
      </div>
    </section>
  )
}

export default SocialFeedSection
