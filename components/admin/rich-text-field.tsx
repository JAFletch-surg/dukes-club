'use client'

/* ══════════════════════════════════════════════════════════════════
   RICH TEXT FIELD — free text that accepts HTML segments

   Admins type normally: a blank line starts a new paragraph. Where
   they want formatting they drop an HTML segment in — <strong>, a
   list, a table, a callout — either by hand or from the insert bar.
   The preview shows exactly what the public page will render, and
   everything is scrubbed through the sanitiser before it is stored.
   ══════════════════════════════════════════════════════════════════ */

import { useRef, useState } from 'react'
import { Code2, Eye, EyeOff } from 'lucide-react'
import { richTextToHtml } from '@/lib/rich-text'

/** Quick-insert snippets shared by every HTML-aware admin editor. */
export const HTML_SNIPPETS: { label: string; snippet: string }[] = [
  { label: 'Heading', snippet: '<h3>Section heading</h3>' },
  { label: 'Bold', snippet: '<strong>bold text</strong>' },
  { label: 'Italic', snippet: '<em>italic text</em>' },
  { label: 'Link', snippet: '<a href="https://example.com" target="_blank">link text</a>' },
  { label: 'Bullets', snippet: '<ul>\n  <li>First point</li>\n  <li>Second point</li>\n</ul>' },
  { label: 'Numbered', snippet: '<ol>\n  <li>First step</li>\n  <li>Second step</li>\n</ol>' },
  { label: 'Table', snippet: '<table>\n  <thead><tr><th>Column</th><th>Column</th></tr></thead>\n  <tbody><tr><td>Cell</td><td>Cell</td></tr></tbody>\n</table>' },
  { label: 'Callout', snippet: '<div class="callout">\n  <strong>Note</strong> — something worth highlighting.\n</div>' },
  { label: 'Divider', snippet: '<hr />' },
]

const C = { navy: '#0F1F3D', gold: '#E5A718', primary: '#0078D4', secondary: '#504F58', muted: '#D1D1D6', accentBg: '#E5F1FB', accentFg: '#0060AB' }

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: '#181820' }}>
          {label}{optional && <span style={{ fontWeight: 400, color: '#999' }}> (optional)</span>}
        </label>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: C.accentFg, background: C.accentBg, padding: '2px 8px', borderRadius: 20 }}>
          <Code2 size={10} /> HTML OK
        </span>
        <button type="button" onClick={() => setPreview(p => !p)}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.muted}`, background: preview ? C.accentBg : '#fff', color: preview ? C.accentFg : C.secondary, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
          {preview ? <><EyeOff size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
        </button>
      </div>

      <div style={{ border: `1.5px solid ${C.muted}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        {preview ? (
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

      <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
        {hint || 'Leave a blank line between paragraphs. Add HTML anywhere for formatting — scripts and unknown embeds are stripped when saved.'}
      </p>

      <style dangerouslySetInnerHTML={{ __html: `
        .rich-preview { font-family: Montserrat, sans-serif; font-size: 15px; line-height: 1.7; color: #181820; }
        .rich-preview > *:first-child { margin-top: 0 }
        .rich-preview p { margin: 0 0 0.9em }
        .rich-preview h1, .rich-preview h2, .rich-preview h3, .rich-preview h4 { font-weight: 700; color: ${C.navy}; margin: 0.9em 0 0.4em; line-height: 1.3 }
        .rich-preview h1 { font-size: 1.6em } .rich-preview h2 { font-size: 1.35em }
        .rich-preview h3 { font-size: 1.15em } .rich-preview h4 { font-size: 1em }
        .rich-preview ul, .rich-preview ol { margin: 0.6em 0; padding-left: 22px }
        .rich-preview ul li { list-style: disc } .rich-preview ol li { list-style: decimal }
        .rich-preview li { margin: 2px 0 }
        .rich-preview a { color: ${C.primary}; text-decoration: underline }
        .rich-preview img, .rich-preview iframe { max-width: 100%; border-radius: 8px; border: none }
        .rich-preview table { border-collapse: collapse; width: 100%; font-size: 0.92em; margin: 0.8em 0 }
        .rich-preview th, .rich-preview td { border: 1px solid #E4E4E8; padding: 6px 10px; text-align: left }
        .rich-preview th { background: ${C.navy}; color: #fff }
        .rich-preview blockquote { border-left: 3px solid ${C.gold}; background: #FFFBF0; margin: 0.8em 0; padding: 10px 16px; font-style: italic }
        .rich-preview .callout { background: #FFFBF0; border-left: 4px solid ${C.gold}; padding: 14px 18px; border-radius: 0 10px 10px 0; margin: 0.9em 0 }
        .rich-preview hr { border: none; border-top: 1px solid #E4E4E8; margin: 1.2em 0 }
      `}} />
    </div>
  )
}
