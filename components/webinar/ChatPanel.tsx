'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare, EyeOff, Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/lib/webinars'
import { cn } from '@/lib/utils'
import { PanelEmpty } from './PanelEmpty'

interface Props {
  messages: ChatMessage[]
  currentUserId: string | null
  enabled: boolean
  canModerate?: boolean
  readOnly?: boolean
  onSend: (body: string) => Promise<{ error: string | null }>
  onHide?: (id: string) => void
}

export function ChatPanel({
  messages,
  currentUserId,
  enabled,
  canModerate,
  readOnly,
  onSend,
  onHide,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)

  // Only auto-scroll if the reader is already at the bottom — yanking someone
  // away from a message they are reading is worse than a missed scroll.
  useEffect(() => {
    if (pinnedToBottom.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || sending) return

    setSending(true)
    setError(null)
    const result = await onSend(draft)
    setSending(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setDraft('')
    pinnedToBottom.current = true
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0"
      >
        {messages.length === 0 ? (
          <PanelEmpty
            icon={<MessageSquare size={22} />}
            title="No messages yet"
            body="Say hello — the chat is open to everyone watching."
          />
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="wb-msg-enter group">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'text-[12px] font-semibold truncate',
                    msg.is_staff ? 'text-gold' : 'text-navy-foreground/80',
                    msg.user_id === currentUserId && !msg.is_staff && 'text-navy-foreground'
                  )}
                >
                  {msg.display_name}
                </span>
                {msg.is_staff && (
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-gold/70 shrink-0">
                    Speaker
                  </span>
                )}
                <span className="text-[10px] text-navy-foreground/30 ml-auto shrink-0">
                  {new Date(msg.created_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {canModerate && onHide && (
                  <button
                    type="button"
                    onClick={() => onHide(msg.id)}
                    title="Hide this message"
                    className="opacity-0 group-hover:opacity-100 text-navy-foreground/40 hover:text-red-400 transition-opacity shrink-0"
                  >
                    <EyeOff size={12} />
                  </button>
                )}
              </div>
              <p className="text-[13.5px] leading-relaxed text-navy-foreground/90 break-words">
                {msg.body}
              </p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {!readOnly && (
        <form onSubmit={submit} className="border-t border-white/[0.08] p-3 shrink-0">
          {error && <p className="text-[11.5px] text-red-300 mb-2">{error}</p>}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              disabled={!enabled || sending}
              maxLength={2000}
              placeholder={enabled ? 'Message everyone…' : 'Chat is off for this webinar'}
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] ring-1 ring-white/10 text-[13.5px] text-navy-foreground placeholder:text-navy-foreground/30 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!enabled || sending || !draft.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-lg bg-gold text-gold-foreground grid place-items-center hover:bg-gold/90 transition-colors disabled:opacity-40 shrink-0"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
