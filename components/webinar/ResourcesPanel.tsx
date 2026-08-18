'use client'

import { FileText, ExternalLink, ImageIcon, Video, Paperclip } from 'lucide-react'
import type { WebinarResource } from '@/lib/webinars'
import { PanelEmpty } from './PanelEmpty'

const ICONS = {
  pdf: FileText,
  link: ExternalLink,
  image: ImageIcon,
  video: Video,
} as const

/**
 * Links, papers and slides the host shares during the session. Stays available
 * after the webinar ends — this is a real reason people come back to the page.
 */
export function ResourcesPanel({ resources }: { resources: WebinarResource[] }) {
  if (resources.length === 0) {
    return (
      <PanelEmpty
        icon={<Paperclip size={22} />}
        title="Nothing shared yet"
        body="Papers, guidelines and slides the host shares will collect here."
      />
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
      {resources.map(resource => {
        const Icon = ICONS[resource.kind] ?? ExternalLink
        return (
          <a
            key={resource.id}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="wb-msg-enter flex gap-3 p-3 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] hover:ring-white/[0.14] transition-colors group"
          >
            <span className="w-8 h-8 rounded-md bg-gold/15 text-gold grid place-items-center shrink-0">
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-navy-foreground/90 truncate group-hover:text-navy-foreground">
                {resource.title}
              </span>
              {resource.description && (
                <span className="block text-[12px] text-navy-foreground/45 line-clamp-2 mt-0.5">
                  {resource.description}
                </span>
              )}
            </span>
            <ExternalLink
              size={13}
              className="text-navy-foreground/25 shrink-0 mt-0.5 group-hover:text-gold transition-colors"
            />
          </a>
        )
      })}
    </div>
  )
}
