'use client'

import { useState } from 'react'
import { MessageSquare, HelpCircle, BarChart3, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SidebarTab = 'chat' | 'qa' | 'polls' | 'resources'

interface TabDef {
  id: SidebarTab
  label: string
  icon: typeof MessageSquare
  badge?: number
  hidden?: boolean
}

interface Props {
  defaultTab?: SidebarTab
  chat: React.ReactNode
  qa: React.ReactNode
  polls: React.ReactNode
  resources: React.ReactNode
  counts?: Partial<Record<SidebarTab, number>>
  hide?: Partial<Record<SidebarTab, boolean>>
  /** Pulses a tab when something arrives on it while you are elsewhere. */
  attention?: Partial<Record<SidebarTab, boolean>>
}

/**
 * The tabbed rail beside the stage. Uses its own tab strip rather than the
 * shadcn Tabs primitive: those styles are built for the light surfaces, and
 * the panels here need to own the full remaining height with their own
 * scroll containers.
 */
export function WebinarSidebar({
  defaultTab = 'qa',
  chat,
  qa,
  polls,
  resources,
  counts = {},
  hide = {},
  attention = {},
}: Props) {
  const [active, setActive] = useState<SidebarTab>(defaultTab)

  const allTabs: TabDef[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: counts.chat, hidden: hide.chat },
    { id: 'qa', label: 'Q&A', icon: HelpCircle, badge: counts.qa, hidden: hide.qa },
    { id: 'polls', label: 'Polls', icon: BarChart3, badge: counts.polls, hidden: hide.polls },
    { id: 'resources', label: 'Files', icon: Paperclip, badge: counts.resources, hidden: hide.resources },
  ]
  const tabs = allTabs.filter(t => !t.hidden)

  // If the active tab gets hidden mid-session (host turns chat off), fall back.
  const current = tabs.some(t => t.id === active) ? active : tabs[0]?.id

  return (
    <div className="flex flex-col h-full min-h-0 bg-[hsl(220_35%_11%)]">
      <div className="flex shrink-0 border-b border-white/[0.08]" role="tablist">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = current === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={cn(
                'relative flex-1 flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold transition-colors',
                isActive
                  ? 'text-gold'
                  : 'text-navy-foreground/45 hover:text-navy-foreground/75'
              )}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="text-[10px] text-navy-foreground/40 tabular-nums">
                  {tab.badge}
                </span>
              )}
              {!isActive && attention[tab.id] && (
                <span className="absolute top-2 right-1/2 translate-x-4 w-1.5 h-1.5 rounded-full bg-gold wb-live-dot" />
              )}
              {isActive && <span className="absolute bottom-0 inset-x-2 h-0.5 bg-gold rounded-full" />}
            </button>
          )
        })}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {current === 'chat' && chat}
        {current === 'qa' && qa}
        {current === 'polls' && polls}
        {current === 'resources' && resources}
      </div>
    </div>
  )
}
