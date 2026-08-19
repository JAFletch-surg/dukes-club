'use client'

import { MicOff, UserMinus, Monitor, Loader2, Users, Star, StarOff } from 'lucide-react'
import { readMetadata, parseIdentity } from '@/lib/webinars'
import { cn } from '@/lib/utils'
import { PanelEmpty } from './PanelEmpty'

export interface RosterEntry {
  identity: string
  name: string
  metadata?: string
  joinedAt: number
  isPublisher: boolean
}

interface Props {
  roster: RosterEntry[]
  loading?: boolean
  spotlightIdentity?: string | null
  busy?: string | null
  onSpotlight: (identity: string | null) => void
  onMute: (identity: string) => void
  onRemove: (identity: string) => void
}

/**
 * The studio's roster. Host only — a live list of everyone watching is not
 * something a webinar audience needs, and the attendee surfaces do not get it.
 *
 * Fed by GET /api/webinars/[sessionId]/session, which has always returned
 * LiveKit's participant list and which nothing called until now.
 */
export function PeoplePanel({
  roster,
  loading,
  spotlightIdentity,
  busy,
  onSpotlight,
  onMute,
  onRemove,
}: Props) {
  // Egress joins the room as a participant too; it is a recorder, not a person.
  const people = roster.filter(p => parseIdentity(p.identity).kind !== 'other')
  const presenters = people.filter(p => p.isPublisher)
  const attendees = people.filter(p => !p.isPublisher)

  if (loading && roster.length === 0) {
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 size={22} className="animate-spin text-slate-400" />
      </div>
    )
  }

  if (people.length === 0) {
    return (
      <PanelEmpty
        icon={<Users size={22} />}
        title="Nobody here yet"
        body="Speakers and attendees appear as they join the room."
      />
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">
      <Section label={`On stage · ${presenters.length}`}>
        {presenters.map(p => {
          const spotlit = spotlightIdentity === p.identity
          const isGuest = parseIdentity(p.identity).kind === 'guest'
          return (
            <div
              key={p.identity}
              className={cn(
                'rounded-lg p-2.5 ring-1',
                spotlit ? 'bg-blue-50 ring-primary/40' : 'bg-white ring-slate-200'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 grid place-items-center text-[11px] font-semibold shrink-0">
                  {initials(p.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-900 truncate">
                    {p.name || readMetadata(p.metadata)?.name || 'Speaker'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isGuest ? 'Guest speaker' : 'Member'}
                    {spotlit && ' · on stage'}
                  </p>
                </div>
                {spotlit && <Monitor size={13} className="text-primary shrink-0" />}
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <button
                  type="button"
                  disabled={busy === p.identity}
                  onClick={() => onSpotlight(spotlit ? null : p.identity)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors disabled:opacity-40',
                    spotlit
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-primary text-white hover:bg-primary/90'
                  )}
                >
                  {spotlit ? <StarOff size={11} /> : <Star size={11} />}
                  {spotlit ? 'Take off stage' : 'Put on stage'}
                </button>

                <button
                  type="button"
                  disabled={busy === p.identity}
                  onClick={() => onMute(p.identity)}
                  title="Mute their microphone"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                >
                  <MicOff size={11} />
                </button>

                <button
                  type="button"
                  disabled={busy === p.identity}
                  onClick={() => {
                    if (confirm(`Remove ${p.name} from the webinar?`)) onRemove(p.identity)
                  }}
                  title="Remove from the webinar"
                  className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  <UserMinus size={11} />
                </button>
              </div>
            </div>
          )
        })}
        {presenters.length === 0 && (
          <p className="text-[12.5px] text-slate-400 px-0.5">Nobody is presenting yet.</p>
        )}
      </Section>

      <Section label={`Watching · ${attendees.length}`}>
        {attendees.length === 0 ? (
          <p className="text-[12.5px] text-slate-400 px-0.5">No attendees yet.</p>
        ) : (
          <div className="rounded-lg bg-white ring-1 ring-slate-200 divide-y divide-slate-100">
            {attendees.slice(0, 100).map(p => (
              <div key={p.identity} className="flex items-center gap-2 px-2.5 py-2">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 grid place-items-center text-[10px] font-semibold shrink-0">
                  {initials(p.name)}
                </span>
                <span className="text-[12.5px] text-slate-700 truncate">{p.name || 'Member'}</span>
              </div>
            ))}
            {attendees.length > 100 && (
              <p className="px-2.5 py-2 text-[11.5px] text-slate-400">
                and {attendees.length - 100} more
              </p>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 px-0.5">
        {label}
      </p>
      {children}
    </div>
  )
}

function initials(name: string): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}
