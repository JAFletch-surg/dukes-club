'use client'

/* ══════════════════════════════════════════════════════════════════
   RICH TEXT FIELD — visual formatting, with HTML underneath

   Two modes over one value:

     Visual  a toolbar and a live editor. Click Bold, get bold. No
             markup on screen at all — this is the mode for whoever
             is setting up an event without knowing what a <ul> is.
     HTML    the raw text, with the INSERT bar and a preview, for
             anyone who wants to paste an embed or hand-tune markup.

   Both write the same field, so one person can lay a page out
   visually and another can drop an iframe into it afterwards.

   Everything is scrubbed through the sanitiser before it is stored.
   ══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import {
  Bold, Code2, Eye, EyeOff, Italic, Link2, List, ListOrdered, Minus,
  Quote, Redo2, Table as TableIcon, Underline, Undo2, Lightbulb, Type,
} from 'lucide-react'
import { richTextToHtml } from '@/lib/rich-text'
import { Callout } from './callout-node'
import { HTML_SNIPPETS } from './html-snippets'

const C = { navy: '#0F1F3D', gold: '#E5A718', primary: '#0078D4', secondary: '#504F58', muted: '#D1D1D6', accentBg: '#E5F1FB', accentFg: '#0060AB' }

/* ── What the visual editor can and cannot hold ─────────────────────
   Everything the toolbar and the INSERT bar produce is in here. Markup
   outside it — an iframe, an image, a styled <span> — has no node in
   the editor's schema, so opening it visually would quietly throw it
   away. Rather than let that happen we detect it and say so. */
const VISUAL_TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre',
  'ul', 'ol', 'li', 'blockquote', 'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

/** Tags in `source` that the visual editor would drop, most notable first. */
function unsupportedTags(source: string): string[] {
  const found = new Set<string>()
  const re = /<\s*([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g
  let m: RegExpExecArray | null

  while ((m = re.exec(source)) !== null) {
    const tag = m[1].toLowerCase()
    // A callout div has a node of its own; any other div does not.
    if (tag === 'div') {
      if (!/class\s*=\s*["'][^"']*\bcallout\b/i.test(m[2])) found.add('div')
      continue
    }
    if (!VISUAL_TAGS.has(tag)) found.add(tag)
  }
  return [...found]
}

/* Tidy the editor's output before it becomes the stored value.

   TipTap renders an empty document as a single empty paragraph; stored as
   that, an optional field would look filled in and the excerpt would carry a
   stray blank paragraph, so empty means empty.

   It also writes a `min-width` on tables and their columns, left over from
   column resizing. That is editor bookkeeping, not something the author
   asked for, and it should not end up in the public page's markup — so it is
   dropped, but only where the whole style attribute is that one property. */
function normalise(html: string): string {
  if (/^\s*<p>(\s|<br\s*\/?>|&nbsp;)*<\/p>\s*$/i.test(html)) return ''
  return html.replace(/(<(?:table|col)\b[^>]*?)\s*style="min-width:\s*\d+px;?"/gi, '$1')
}

type Mode = 'visual' | 'html'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
  minHeight?: number
  optional?: boolean
}

export function RichTextField({ label, value, onChange, placeholder, hint, minHeight = 150, optional }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [preview, setPreview] = useState(false)

  /* Start in whichever mode is safe for the content already there: visual
     unless it holds markup the visual editor cannot represent, in which case
     showing it visually would be the destructive choice. Decided once, from
     the value the field opened with — the mode must not flip underneath
     someone as they type. */
  const [mode, setMode] = useState<Mode>(() => (unsupportedTags(value || '').length ? 'html' : 'visual'))
  const [warning, setWarning] = useState<string | null>(null)

  /* Everything we have handed up, most recent last. `value` is a prop, so it
     arrives a render or two behind the editor's own document — an incoming
     value is therefore just as likely to be one of our own, stale, than
     something genuinely external. Comparing against only the newest emission
     is not enough: writing a stale one back drops keystrokes and makes
     toolbar buttons look dead. Anything in here is ours and is ignored;
     anything else is a record being loaded and is applied.

     Bounded because values in flight are only ever a render or two old. */
  const mine = useRef<string[]>([])
  const remember = (html: string) => {
    mine.current.push(html)
    if (mine.current.length > 50) mine.current.shift()
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // Opening a link mid-edit is more often an accident than an intent.
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
        codeBlock: false,
      }),
      TableKit.configure({ table: { resizable: false } }),
      Callout,
    ],
    content: richTextToHtml(value) || '',
    // Next.js renders this on the server first; TipTap must wait for the
    // browser or the two renders disagree.
    immediatelyRender: false,
    editorProps: { attributes: { class: 'rich-editor-content', style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor }) => {
      const html = normalise(editor.getHTML())
      remember(html)
      onChange(html)
    },
  }, [])

  /* Keep the editor in step when the value changes from outside — a record
     being loaded, or the admin editing in HTML mode and switching back. */
  useEffect(() => {
    if (!editor || mode !== 'visual') return

    // Our own work coming back round, however far behind. Not external.
    if (mine.current.includes(value)) return
    // And never mid-keystroke, even for something we have not seen before.
    if (editor.isFocused) return

    const next = richTextToHtml(value) || ''
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
    remember(value)
  }, [editor, value, mode])

  /* Drop a snippet in at the cursor, leaving the caret after it. */
  const insert = (snippet: string) => {
    const el = ref.current
    const start = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    const selected = value.slice(start, end)

    // With text selected, wrap it rather than overwrite it.
    const body = selected && /^<([a-z0-9]+)[^>]*>[^<]*<\/\1>$/i.test(snippet)
      ? snippet.replace(/>([^<]*)</, `>${selected}<`)
      : snippet

    const lead = before && !before.endsWith('\n') && body.includes('\n') ? '\n' : ''
    onChange(`${before}${lead}${body}${after}`)

    requestAnimationFrame(() => {
      const caret = before.length + lead.length + body.length
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  /* Switching to visual is the one move that can lose work, so it asks
     first and names what it would simplify. Switching to HTML never can. */
  const switchMode = (next: Mode) => {
    setWarning(null)
    if (next === mode) return

    if (next === 'visual') {
      const lost = unsupportedTags(value || '')
      if (lost.length) {
        const list = lost.map(t => `<${t}>`).join(', ')
        const ok = window.confirm(
          `The visual editor cannot show ${list}.\n\n` +
          `Switching will remove ${lost.length === 1 ? 'it' : 'them'} from this field. ` +
          `Stay in HTML mode to keep ${lost.length === 1 ? 'it' : 'them'}.`
        )
        if (!ok) return
        setWarning(`${list} ${lost.length === 1 ? 'was' : 'were'} removed when you switched to the visual editor.`)
      }
      /* Re-seed from the current text, which HTML mode may have changed, and
         publish what the editor made of it — that, not the text typed in HTML
         mode, is now the field's value. */
      const seeded = richTextToHtml(value) || ''
      editor?.commands.setContent(seeded, { emitUpdate: false })
      const settled = normalise(editor?.getHTML() ?? seeded)
      remember(settled)
      onChange(settled)
    }

    setPreview(false)
    setMode(next)
  }

  const link = useCallback(() => {
    if (!editor) return
    const current = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link address', current || 'https://')
    if (url === null) return
    if (!url.trim()) { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }, [editor])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#181820' }}>
          {label}{optional && <span style={{ fontWeight: 400, color: '#999' }}> (optional)</span>}
        </label>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <ModeButton active={mode === 'visual'} onClick={() => switchMode('visual')} icon={<Type size={12} />} label="Visual" />
          <ModeButton active={mode === 'html'} onClick={() => switchMode('html')} icon={<Code2 size={12} />} label="HTML" />
          {mode === 'html' && (
            <button type="button" onClick={() => setPreview(p => !p)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.muted}`, background: preview ? C.accentBg : '#fff', color: preview ? C.accentFg : C.secondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
              {preview ? <><EyeOff size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
            </button>
          )}
        </div>
      </div>

      <div style={{ border: `1.5px solid ${C.muted}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        {mode === 'visual' ? (
          <>
            <Toolbar editor={editor} onLink={link} />
            <div className="rich-editor" style={{ padding: '4px 4px 0' }}>
              <EditorContent editor={editor} />
            </div>
          </>
        ) : preview ? (
          <div className="rich-preview" style={{ padding: '14px 16px', minHeight }}
            dangerouslySetInnerHTML={{ __html: richTextToHtml(value) || '<p style="color:#bbb;font-style:italic">Nothing to preview yet</p>' }} />
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 10px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#aaa', alignSelf: 'center', marginRight: 2 }}>INSERT:</span>
              {HTML_SNIPPETS.map(s => (
                <button key={s.label} type="button" onClick={() => insert(s.snippet)}
                  style={{ padding: '3px 9px', borderRadius: 14, border: `1px solid ${C.muted}`, background: '#fff', color: C.secondary, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                  {s.label}
                </button>
              ))}
            </div>
            <textarea
              ref={ref}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              spellCheck
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', minHeight, padding: '12px 14px', fontSize: 15, lineHeight: 1.65, color: '#000', background: '#fff', fontFamily: 'Montserrat, sans-serif' }}
            />
          </>
        )}
      </div>

      {warning && (
        <p style={{ fontSize: 11, color: '#B54708', background: '#FFFAEB', border: '1px solid #FEDF89', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}>
          {warning}
        </p>
      )}

      <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
        {hint || (mode === 'visual'
          ? 'Format with the buttons above. Switch to HTML to paste an embed or edit the markup by hand.'
          : 'Leave a blank line between paragraphs. Add HTML anywhere for formatting — scripts and unknown embeds are stripped when saved.')}
      </p>

      <style dangerouslySetInnerHTML={{ __html: `
        .rich-preview, .rich-editor-content { font-family: Montserrat, sans-serif; font-size: 15px; line-height: 1.7; color: #181820; }
        .rich-editor-content { padding: 10px 12px; outline: none; }
        .rich-preview > *:first-child, .rich-editor-content > *:first-child { margin-top: 0 }
        .rich-preview p, .rich-editor-content p { margin: 0 0 0.9em }
        .rich-preview h1, .rich-preview h2, .rich-preview h3, .rich-preview h4,
        .rich-editor-content h1, .rich-editor-content h2, .rich-editor-content h3, .rich-editor-content h4 { font-weight: 700; color: ${C.navy}; margin: 0.9em 0 0.4em; line-height: 1.3 }
        .rich-preview h1, .rich-editor-content h1 { font-size: 1.6em }
        .rich-preview h2, .rich-editor-content h2 { font-size: 1.35em }
        .rich-preview h3, .rich-editor-content h3 { font-size: 1.15em }
        .rich-preview h4, .rich-editor-content h4 { font-size: 1em }
        .rich-preview ul, .rich-preview ol, .rich-editor-content ul, .rich-editor-content ol { margin: 0.6em 0; padding-left: 22px }
        .rich-preview ul li, .rich-editor-content ul li { list-style: disc }
        .rich-preview ol li, .rich-editor-content ol li { list-style: decimal }
        .rich-preview li, .rich-editor-content li { margin: 2px 0 }
        .rich-preview a, .rich-editor-content a { color: ${C.primary}; text-decoration: underline }
        .rich-preview img, .rich-preview iframe { max-width: 100%; border-radius: 8px; border: none }
        .rich-preview table, .rich-editor-content table { border-collapse: collapse; width: 100%; font-size: 0.92em; margin: 0.8em 0 }
        .rich-preview th, .rich-preview td, .rich-editor-content th, .rich-editor-content td { border: 1px solid #E4E4E8; padding: 6px 10px; text-align: left }
        .rich-preview th { background: ${C.navy}; color: #fff }
        .rich-editor-content th { background: ${C.navy}; color: #fff }
        .rich-preview blockquote, .rich-editor-content blockquote { border-left: 3px solid ${C.gold}; background: #FFFBF0; margin: 0.8em 0; padding: 10px 16px; font-style: italic }
        .rich-preview .callout, .rich-editor-content .callout { background: #FFFBF0; border-left: 4px solid ${C.gold}; padding: 14px 18px; border-radius: 0 10px 10px 0; margin: 0.9em 0 }
        .rich-preview hr, .rich-editor-content hr { border: none; border-top: 1px solid #E4E4E8; margin: 1.2em 0 }
        .rich-editor-content hr.ProseMirror-selectednode { border-top-color: ${C.primary} }
        .rich-editor-content .selectedCell:after { background: rgba(0,120,212,0.12); content: ''; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; position: absolute; z-index: 2 }
        .rich-editor-content td, .rich-editor-content th { position: relative }
      `}} />
    </div>
  )
}

function ModeButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
        border: `1px solid ${active ? C.accentFg : C.muted}`,
        background: active ? C.accentBg : '#fff',
        color: active ? C.accentFg : C.secondary,
        fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
      }}>
      {icon} {label}
    </button>
  )
}

/* ── The visual toolbar ───────────────────────────────────────────── */

function Toolbar({ editor, onLink }: { editor: Editor | null; onLink: () => void }) {
  // useEditor re-renders this component on every transaction, so the active
  // states below are read fresh each time.
  if (!editor) {
    return <div style={{ height: 41, borderBottom: '1px solid #eee', background: '#fafafa' }} />
  }

  const chain = () => editor.chain().focus()

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '6px 8px', borderBottom: '1px solid #eee', background: '#fafafa', alignItems: 'center' }}>
      <Tool on={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} title="Bold"><Bold size={13} /></Tool>
      <Tool on={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} title="Italic"><Italic size={13} /></Tool>
      <Tool on={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} title="Underline"><Underline size={13} /></Tool>

      <Divider />

      <Tool on={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()} title="Large heading" wide>H1</Tool>
      <Tool on={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} title="Heading" wide>H2</Tool>
      <Tool on={editor.isActive('heading', { level: 4 })} onClick={() => chain().toggleHeading({ level: 4 }).run()} title="Small heading" wide>H3</Tool>

      <Divider />

      <Tool on={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()} title="Bulleted list"><List size={13} /></Tool>
      <Tool on={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={13} /></Tool>
      <Tool on={editor.isActive('link')} onClick={onLink} title="Link"><Link2 size={13} /></Tool>

      <Divider />

      <Tool on={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()} title="Quote"><Quote size={13} /></Tool>
      <Tool on={editor.isActive('callout')} onClick={() => chain().toggleCallout().run()} title="Highlighted box"><Lightbulb size={13} /></Tool>
      <Tool on={editor.isActive('table')}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon size={13} /></Tool>
      <Tool on={false} onClick={() => chain().setHorizontalRule().run()} title="Divider"><Minus size={13} /></Tool>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
        <Tool on={false} disabled={!editor.can().undo()} onClick={() => chain().undo().run()} title="Undo"><Undo2 size={13} /></Tool>
        <Tool on={false} disabled={!editor.can().redo()} onClick={() => chain().redo().run()} title="Redo"><Redo2 size={13} /></Tool>
      </div>
    </div>
  )
}

function Tool({ on, onClick, title, children, wide, disabled }: {
  on: boolean; onClick: () => void; title: string; children: React.ReactNode; wide?: boolean; disabled?: boolean
}) {
  return (
    <button type="button"
      /* Keep focus in the editor. Without this the button takes it on
         mousedown, the selection collapses before the command runs, and
         selecting a word then clicking Bold does nothing at all. */
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick} title={title} aria-label={title} aria-pressed={on} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: wide ? 28 : 26, height: 26, padding: wide ? '0 6px' : 0, borderRadius: 6,
        border: `1px solid ${on ? C.accentFg : 'transparent'}`,
        background: on ? C.accentBg : 'transparent',
        color: disabled ? '#c9c9cf' : on ? C.accentFg : C.secondary,
        fontSize: 11, fontWeight: 700, fontFamily: 'Montserrat, sans-serif',
        cursor: disabled ? 'default' : 'pointer',
      }}>
      {children}
    </button>
  )
}

function Divider() {
  return <span style={{ width: 1, height: 16, background: '#e2e2e6', margin: '0 3px' }} />
}
