'use client'

import { useMemo, useState } from 'react'
import {
  HelpCircle, Send, Loader2, Pin, Check, EyeOff, Paperclip, FileText, ExternalLink, X,
} from 'lucide-react'
import type { WebinarQuestion } from '@/lib/webinars'
import { attachmentKind, MAX_WEBINAR_UPLOAD } from '@/lib/webinars'
import { useImageUpload } from '@/lib/use-image-upload'
import { cn } from '@/lib/utils'
import { PanelEmpty } from './PanelEmpty'

interface Props {
  questions: WebinarQuestion[]
  currentUserId: string | null
  enabled: boolean
  /** Hosts and speakers can answer, pin and hide. */
  canAnswer?: boolean
  readOnly?: boolean
  onAsk: (body: string) => Promise<{ error: string | null }>
  onAnswer?: (
    questionId: string,
    answer: { body: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: string }
  ) => Promise<{ error: string | null }>
  onPin?: (questionId: string, pinned: boolean) => void
  onHide?: (questionId: string) => void
}

/**
 * Q&A. Attendees ask; hosts and speakers answer, and an answer can carry a
 * link, a PDF or an image — which is the whole point of having this rather
 * than just using the chat.
 */
export function QAPanel({
  questions,
  currentUserId,
  enabled,
  canAnswer,
  readOnly,
  onAsk,
  onAnswer,
  onPin,
  onHide,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answering, setAnswering] = useState<string | null>(null)

  // Pinned first, then unanswered, then newest.
  const ordered = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      const aAns = a.status === 'answered'
      const bAns = b.status === 'answered'
      if (aAns !== bAns) return aAns ? 1 : -1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [questions])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim() || sending) return

    setSending(true)
    setError(null)
    const result = await onAsk(draft)
    setSending(false)

    if (result.error) { setError(result.error); return }
    setDraft('')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {ordered.length === 0 ? (
          <PanelEmpty
            icon={<HelpCircle size={22} />}
            title="No questions yet"
            body="Ask the speaker anything. Questions are visible to everyone watching."
          />
        ) : (
          ordered.map(q => (
            <div
              key={q.id}
              className={cn(
                'wb-msg-enter rounded-lg p-3 ring-1 transition-colors',
                q.is_pinned
                  ? 'bg-amber-50 ring-amber-300'
                  : 'bg-white ring-slate-200'
              )}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[12px] font-semibold text-slate-700 truncate">
                  {q.display_name}
                  {q.user_id === currentUserId && (
                    <span className="text-slate-400 font-normal"> (you)</span>
                  )}
                </span>
                {q.is_pinned && <Pin size={10} className="text-amber-700 shrink-0" />}
                {q.status === 'answered' && (
                  <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-emerald-400 shrink-0">
                    Answered
                  </span>
                )}
                <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                  {new Date(q.created_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>

              <p className="text-[13.5px] leading-relaxed text-slate-700 break-words">
                {q.body}
              </p>

              {(q.answer_body || q.answer_attachment_url) && (
                <div className="mt-2.5 pl-3 border-l-2 border-gold/40">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-amber-600 mb-1">
                    {q.answered_by_name ?? 'Answer'}
                  </p>
                  {q.answer_body && (
                    <p className="text-[13px] leading-relaxed text-slate-700 break-words">
                      {q.answer_body}
                    </p>
                  )}
                  {q.answer_attachment_url && (
                    <a
                      href={q.answer_attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-1.5 text-[12px] text-amber-700 hover:underline"
                    >
                      {q.answer_attachment_type === 'link'
                        ? <ExternalLink size={11} />
                        : <FileText size={11} />}
                      {q.answer_attachment_name || 'Attachment'}
                    </a>
                  )}
                </div>
              )}

              {canAnswer && (
                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAnswering(answering === q.id ? null : q.id)}
                    className="text-[11.5px] font-semibold text-amber-700 hover:text-amber-600"
                  >
                    {q.status === 'answered' ? 'Edit answer' : 'Answer'}
                  </button>
                  {onPin && (
                    <button
                      type="button"
                      onClick={() => onPin(q.id, !q.is_pinned)}
                      className="text-[11.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                    >
                      <Pin size={11} /> {q.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {onHide && (
                    <button
                      type="button"
                      onClick={() => onHide(q.id)}
                      className="text-[11.5px] text-slate-500 hover:text-red-400 inline-flex items-center gap-1 ml-auto"
                    >
                      <EyeOff size={11} /> Hide
                    </button>
                  )}
                </div>
              )}

              {canAnswer && answering === q.id && onAnswer && (
                <AnswerComposer
                  initial={q.answer_body ?? ''}
                  onCancel={() => setAnswering(null)}
                  onSubmit={async payload => {
                    const res = await onAnswer(q.id, payload)
                    if (!res.error) setAnswering(null)
                    return res
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {!readOnly && (
        <form onSubmit={submit} className="border-t border-slate-200 p-3 shrink-0">
          {error && <p className="text-[11.5px] text-red-300 mb-2">{error}</p>}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              disabled={!enabled || sending}
              maxLength={1000}
              placeholder={enabled ? 'Ask a question…' : 'Q&A is off for this webinar'}
              className="flex-1 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!enabled || sending || !draft.trim()}
              aria-label="Ask question"
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

/** Answer box with an attachment picker — reuses the same `media` bucket and
 *  10MB ceiling as message attachments. */
function AnswerComposer({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: string
  onCancel: () => void
  onSubmit: (payload: {
    body: string
    attachmentUrl?: string
    attachmentName?: string
    attachmentType?: string
  }) => Promise<{ error: string | null }>
}) {
  const { upload, uploading } = useImageUpload()
  const [body, setBody] = useState(initial)
  const [file, setFile] = useState<File | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!body.trim() && !file && !linkUrl.trim()) {
      setError('Add an answer, a file or a link.')
      return
    }
    setSaving(true)
    setError(null)

    let attachmentUrl: string | undefined
    let attachmentName: string | undefined
    let attachmentType: string | undefined

    if (file) {
      const url = await upload(file, 'webinar-resources')
      if (!url) { setError('Upload failed. Try again.'); setSaving(false); return }
      attachmentUrl = url
      attachmentName = file.name
      attachmentType = attachmentKind(file)
    } else if (linkUrl.trim()) {
      attachmentUrl = linkUrl.trim()
      attachmentName = linkUrl.trim().replace(/^https?:\/\//, '').slice(0, 60)
      attachmentType = 'link'
    }

    const res = await onSubmit({ body: body.trim(), attachmentUrl, attachmentName, attachmentType })
    setSaving(false)
    if (res.error) setError(res.error)
  }

  return (
    <div className="mt-2.5 space-y-2">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        placeholder="Type your answer…"
        className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-slate-200 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
      />

      <input
        value={linkUrl}
        onChange={e => setLinkUrl(e.target.value)}
        disabled={!!file}
        placeholder="…or paste a link (paper, guideline, video)"
        className="w-full px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-200 text-[12.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-40"
      />

      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500 hover:text-slate-900 cursor-pointer">
          <Paperclip size={12} />
          {file ? 'Change file' : 'Attach PDF or image'}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > MAX_WEBINAR_UPLOAD) {
                setError('Files must be under 10MB.')
                return
              }
              setFile(f)
              setLinkUrl('')
              setError(null)
            }}
          />
        </label>

        {file && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-amber-700">
            {file.name.slice(0, 24)}
            <button type="button" onClick={() => setFile(null)} aria-label="Remove file">
              <X size={11} />
            </button>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[11.5px] text-slate-500 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-gold-foreground text-[11.5px] font-semibold hover:bg-gold/90 disabled:opacity-50"
          >
            {saving || uploading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Post answer
          </button>
        </div>
      </div>

      {error && <p className="text-[11.5px] text-red-300">{error}</p>}
    </div>
  )
}
