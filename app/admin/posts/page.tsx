'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Newspaper, Plus, Edit, Trash2, Save, Loader, X, ImageIcon, Search,
  Users, Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote,
  Image as ImageLucide, Video, Link2, Minus, AlignLeft, Eye, Calendar,
  Type, ChevronDown, Sparkles, FileText
} from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { useImageUpload } from '@/lib/use-image-upload'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['draft', 'published', 'archived']
const CATEGORIES = ['Announcement', 'Education', 'Careers', 'Research', 'Events', 'Policy', 'Member News', 'General']
const SUBSPECIALTIES = [
  'Robotic','Laparoscopic','Open','TAMIS','Cancer','Rectal Cancer','Advanced Cancer',
  'Peritoneal Malignancy','Anal Cancer','IBD','Intestinal Failure','Pelvic Floor',
  'Proctology','Fistula','Emergency','Trauma','Abdominal Wall Reconstruction','Endoscopy',
  'Training','Research','General',
]
function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

/* ── Style tokens ─────────────────────────────────── */
const C = { navy: '#0F1F3D', navyFg: '#F5F8FC', gold: '#E5A718', primary: '#0078D4', bg: '#F1F1F3', fg: '#181820', card: '#FAFAFA', muted: '#D1D1D6', secondary: '#504F58', destructive: '#DB2424', border: '#D1D1D6', accentBg: '#E5F1FB', accentFg: '#0060AB', primaryBg: '#E5F1FB' }
const S = {
  input: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#999', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  section: { marginTop: 8, paddingTop: 18, borderTop: '1px solid #eee' } as React.CSSProperties,
  sectionTitle: { fontSize: 15, fontWeight: 700, color: C.fg, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
}

/* ═══════════════════════════════════════════════════════
   AUTHOR PICKER — search exec committee & faculty
   ═══════════════════════════════════════════════════════ */
type AuthorInfo = { id: string; name: string; role: string; photo_url: string }

function AuthorPicker({ value, onChange }: { value: AuthorInfo | null; onChange: (a: AuthorInfo | null) => void }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showDrop, setShowDrop] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient()
        // Search exec committee
        const { data: exec } = await supabase.from('executive_committee')
          .select('id, full_name, role, photo_url')
          .ilike('full_name', `%${search}%`)
          .eq('is_active', true)
          .limit(6)
        // Search faculty
        const { data: fac } = await supabase.from('faculty')
          .select('id, full_name, position_title, photo_url')
          .ilike('full_name', `%${search}%`)
          .limit(4)

        const combined = [
          ...(exec || []).map((e: any) => ({ id: e.id, name: e.full_name, role: e.role, photo_url: e.photo_url, source: 'Executive' })),
          ...(fac || []).map((f: any) => ({ id: f.id, name: f.full_name, role: f.position_title, photo_url: f.photo_url, source: 'Faculty' })),
        ]
        setResults(combined)
        setShowDrop(true)
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  if (value) {
    return (
      <div>
        <label style={S.label}>Author</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(15,31,61,.03)', border: `1px solid rgba(15,31,61,.12)`, borderRadius: 12 }}>
          {value.photo_url
            ? <img src={value.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{initials(value.name)}</div>
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{value.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{value.role}</div>
          </div>
          <button type="button" onClick={() => onChange(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 4 }}><X size={16} /></button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label style={S.label}>Author</label>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#aaa', zIndex: 1 }} />
        <input style={{ ...S.input, paddingLeft: 32 }} value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 200)}
          placeholder="Search exec committee or faculty..." />
        {showDrop && results.length > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 20, maxHeight: 260, overflowY: 'auto' }}>
            {results.map((r: any) => (
              <div key={`${r.source}-${r.id}`}
                onClick={() => { onChange({ id: r.id, name: r.name, role: r.role || '', photo_url: r.photo_url || '' }); setSearch(''); setShowDrop(false) }}
                style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f5f5f5' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f8f9fa' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                {r.photo_url
                  ? <img src={r.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(r.name)}</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{r.role}</div>
                </div>
                <span style={S.badge(r.source === 'Executive' ? '#FEF3C7' : C.accentBg, r.source === 'Executive' ? '#92400E' : C.accentFg)}>{r.source}</span>
              </div>
            ))}
          </div>
        )}
        <p style={S.hint}>Search the executive committee and faculty database</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   IMAGE UPLOAD BOX (reused from fellowships)
   ═══════════════════════════════════════════════════════ */
function ImageUploadBox({ value, onChange, folder, label }: { value: string; onChange: (url: string) => void; folder: string; label: string }) {
  const { upload, uploading, error } = useImageUpload()
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f, folder); if (url) onChange(url); e.target.value = '' }
  return (
    <div>
      <label style={S.label}>{label}</label>
      {value ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.muted}` }}>
          <img src={value} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{ width: '100%', height: 140, border: `2px dashed ${C.muted}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: C.secondary, background: '#fff', cursor: uploading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500 }}>
          {uploading ? <><Loader size={20} className="animate-spin" />Uploading...</> : <><ImageIcon size={22} strokeWidth={1.5} />Click to upload image<span style={{ fontSize: 11, color: '#999' }}>PNG, JPG up to 5MB</span></>}
        </button>
      )}
      {error && <p style={{ fontSize: 12, color: C.destructive, marginTop: 6 }}>{error}</p>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   BLOCK EDITOR — structured content blocks
   Blocks: paragraph, heading, image, video, quote, divider
   Stores as JSON array, renders to HTML on save
   ═══════════════════════════════════════════════════════ */
type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 1 | 2; text: string }
  | { type: 'image'; url: string; caption: string }
  | { type: 'video'; url: string; caption: string }
  | { type: 'pdf'; url: string; title: string }
  | { type: 'quote'; text: string; attribution: string }
  | { type: 'divider' }

function blocksToHtml(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'paragraph': return `<p>${b.text}</p>`
      case 'heading': return `<h${b.level}>${b.text}</h${b.level}>`
      case 'image': return `<figure><img src="${b.url}" alt="${b.caption}" />${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`
      case 'video': {
        // Support YouTube, Vimeo embeds or direct video
        const yt = b.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
        const vim = b.url.match(/vimeo\.com\/(\d+)/)
        if (yt) return `<figure><div class="video-embed"><iframe src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`
        if (vim) return `<figure><div class="video-embed"><iframe src="https://player.vimeo.com/video/${vim[1]}" frameborder="0" allowfullscreen></iframe></div>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`
        return `<figure><video src="${b.url}" controls></video>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`
      }
      case 'quote': return `<blockquote><p>${b.text}</p>${b.attribution ? `<cite>${b.attribution}</cite>` : ''}</blockquote>`
      case 'pdf': return `<div class="pdf-embed"><a href="${b.url}" target="_blank" rel="noopener noreferrer" class="pdf-link"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>${b.title || 'Download PDF'}</a></div>`
      case 'divider': return '<hr />'
      default: return ''
    }
  }).join('\n')
}

function blocksToPlain(blocks: Block[]): string {
  return blocks.map(b => {
    if ('text' in b) {
      // Strip HTML tags for plain text version
      return b.text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    }
    if (b.type === 'image' || b.type === 'video') return b.caption || ''
    if (b.type === 'pdf') return b.title || 'PDF attachment'
    return ''
  }).filter(Boolean).join('\n\n')
}

function htmlToBlocks(html: string): Block[] {
  if (!html) return [{ type: 'paragraph', text: '' }]
  // Simple parser: split on block-level tags
  const blocks: Block[] = []
  const div = document.createElement('div')
  div.innerHTML = html
  div.childNodes.forEach(node => {
    if (node.nodeType === 3) {
      const text = (node.textContent || '').trim()
      if (text) blocks.push({ type: 'paragraph', text })
      return
    }
    const el = node as HTMLElement
    const tag = el.tagName?.toLowerCase()
    if (tag === 'h1') blocks.push({ type: 'heading', level: 1, text: el.textContent || '' })
    else if (tag === 'h2') blocks.push({ type: 'heading', level: 2, text: el.textContent || '' })
    else if (tag === 'blockquote') blocks.push({ type: 'quote', text: el.querySelector('p')?.textContent || el.textContent || '', attribution: el.querySelector('cite')?.textContent || '' })
    else if (tag === 'hr') blocks.push({ type: 'divider' })
    else if (tag === 'div' && el.classList.contains('pdf-embed')) {
      const a = el.querySelector('a')
      blocks.push({ type: 'pdf', url: a?.href || '', title: a?.textContent || 'PDF' })
    }
    else if (tag === 'figure') {
      const img = el.querySelector('img')
      const video = el.querySelector('video')
      const iframe = el.querySelector('iframe')
      const caption = el.querySelector('figcaption')?.textContent || ''
      if (img) blocks.push({ type: 'image', url: img.src, caption })
      else if (video) blocks.push({ type: 'video', url: video.src, caption })
      else if (iframe) blocks.push({ type: 'video', url: iframe.src, caption })
    }
    else blocks.push({ type: 'paragraph', text: el.textContent || '' })
  })
  return blocks.length > 0 ? blocks : [{ type: 'paragraph', text: '' }]
}

function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  const { upload, uploading } = useImageUpload()
  const fileRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const [insertIdx, setInsertIdx] = useState<number>(-1)

  const updateBlock = (i: number, updates: Partial<Block>) => {
    const nb = [...blocks]
    nb[i] = { ...nb[i], ...updates } as Block
    onChange(nb)
  }
  const removeBlock = (i: number) => {
    const nb = blocks.filter((_, idx) => idx !== i)
    onChange(nb.length > 0 ? nb : [{ type: 'paragraph', text: '' }])
  }
  const addBlockAfter = (i: number, block: Block) => {
    const nb = [...blocks]
    nb.splice(i + 1, 0, block)
    onChange(nb)
  }
  const moveBlock = (i: number, dir: -1 | 1) => {
    const ni = i + dir
    if (ni < 0 || ni >= blocks.length) return
    const nb = [...blocks]
    ;[nb[i], nb[ni]] = [nb[ni], nb[i]]
    onChange(nb)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const url = await upload(f, 'posts')
    if (url) addBlockAfter(insertIdx, { type: 'image', url, caption: '' })
    e.target.value = ''
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const title = f.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ')
    const url = await upload(f, 'posts')
    if (url) {
      addBlockAfter(blocks.length - 1, { type: 'pdf', url, title })
    }
    e.target.value = ''
  }

  const toolbarBtnStyle = (active = false) => ({
    padding: '6px 8px', border: 'none', borderRadius: 6,
    background: active ? C.accentBg : 'transparent',
    color: active ? C.accentFg : C.secondary,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    fontFamily: 'Montserrat, sans-serif',
  } as React.CSSProperties)

  /* ── Inline formatting toolbar ── */
  const [activeBlockIdx, setActiveBlockIdx] = useState<number | null>(null)
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
  }
  const inlineToolbar = (i: number) => activeBlockIdx === i && (
    <div style={{ display: 'flex', gap: 2, marginBottom: 4, padding: '4px 6px', background: '#f5f5f5', borderRadius: 8, width: 'fit-content' }}>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('bold') }} style={toolbarBtnStyle()} title="Bold (Ctrl+B)"><Bold size={13} /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('italic') }} style={toolbarBtnStyle()} title="Italic (Ctrl+I)"><Italic size={13} /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = prompt('Enter URL:'); if (url) execCmd('createLink', url) }} style={toolbarBtnStyle()} title="Link (Ctrl+K)"><Link2 size={13} /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList') }} style={toolbarBtnStyle()} title="Bullet list"><List size={13} /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList') }} style={toolbarBtnStyle()} title="Numbered list"><ListOrdered size={13} /></button>
    </div>
  )

  return (
    <div>
      <label style={S.label}>Content</label>
      <div style={{ border: `1.5px solid ${C.muted}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        {/* Blocks */}
        <div style={{ minHeight: 300, padding: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {blocks.map((block, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {/* Block content */}
              {block.type === 'paragraph' && (
                <div>
                  {inlineToolbar(i)}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: block.text }}
                    onFocus={() => setActiveBlockIdx(i)}
                    onBlur={(e) => {
                      updateBlock(i, { text: (e.currentTarget as HTMLDivElement).innerHTML })
                      setTimeout(() => setActiveBlockIdx(prev => prev === i ? null : prev), 200)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        // Save current content first
                        updateBlock(i, { text: (e.currentTarget as HTMLDivElement).innerHTML })
                        addBlockAfter(i, { type: 'paragraph', text: '' })
                      }
                      if (e.key === 'Backspace') {
                        const el = e.currentTarget as HTMLDivElement
                        if (el.textContent === '' && blocks.length > 1) {
                          e.preventDefault()
                          removeBlock(i)
                        }
                      }
                      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        const url = prompt('Enter URL:')
                        if (url) execCmd('createLink', url)
                      }
                    }}
                    data-placeholder={i === 0 ? 'Start writing your post...' : 'Continue writing...'}
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, lineHeight: 1.7, fontFamily: 'Georgia, serif', padding: '8px 4px', minHeight: 28, color: '#333', background: 'transparent', whiteSpace: 'pre-wrap' }}
                  />
                </div>
              )}

              {block.type === 'heading' && (
                <input
                  value={block.text}
                  onChange={(e) => updateBlock(i, { text: e.target.value })}
                  placeholder={`Heading ${block.level}`}
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: block.level === 1 ? 28 : 22, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', padding: '12px 4px 4px', color: C.navy, background: 'transparent' }}
                />
              )}

              {block.type === 'image' && (
                <div style={{ margin: '12px 0', borderRadius: 10, overflow: 'hidden', border: `1px solid #eee`, background: '#fafafa' }}>
                  {block.url ? (
                    <>
                      <img src={block.url} alt={block.caption} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
                      <input value={block.caption} onChange={(e) => updateBlock(i, { caption: e.target.value })}
                        placeholder="Image caption (optional)" style={{ width: '100%', border: 'none', borderTop: '1px solid #eee', padding: '8px 12px', fontSize: 12, color: '#999', fontStyle: 'italic', outline: 'none', background: 'transparent' }} />
                    </>
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: '#999' }}><ImageLucide size={24} /><p style={{ fontSize: 13, marginTop: 8 }}>Upload an image</p></div>
                  )}
                </div>
              )}

              {block.type === 'video' && (
                <div style={{ margin: '12px 0', borderRadius: 10, overflow: 'hidden', border: `1px solid #eee`, background: '#fafafa' }}>
                  <input value={block.url} onChange={(e) => updateBlock(i, { url: e.target.value })}
                    placeholder="YouTube, Vimeo, or direct video URL" style={{ width: '100%', border: 'none', padding: '10px 12px', fontSize: 13, outline: 'none', background: 'transparent', borderBottom: '1px solid #eee' }} />
                  {block.url && (() => {
                    const yt = block.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
                    const vim = block.url.match(/vimeo\.com\/(\d+)/)
                    if (yt) return <div style={{ position: 'relative', paddingBottom: '56.25%' }}><iframe src={`https://www.youtube.com/embed/${yt[1]}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen /></div>
                    if (vim) return <div style={{ position: 'relative', paddingBottom: '56.25%' }}><iframe src={`https://player.vimeo.com/video/${vim[1]}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen /></div>
                    return <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>Paste a YouTube or Vimeo URL above</div>
                  })()}
                  <input value={block.caption} onChange={(e) => updateBlock(i, { caption: e.target.value })}
                    placeholder="Video caption (optional)" style={{ width: '100%', border: 'none', borderTop: '1px solid #eee', padding: '8px 12px', fontSize: 12, color: '#999', fontStyle: 'italic', outline: 'none', background: 'transparent' }} />
                </div>
              )}

              {block.type === 'quote' && (
                <div style={{ margin: '12px 0', padding: '16px 20px', borderLeft: `4px solid ${C.gold}`, background: '#FFFBF0', borderRadius: '0 10px 10px 0' }}>
                  <textarea value={block.text} onChange={(e) => updateBlock(i, { text: e.target.value })}
                    placeholder="Quote text..." style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontSize: 15, fontStyle: 'italic', lineHeight: 1.7, fontFamily: 'Georgia, serif', background: 'transparent', color: '#555', minHeight: 40 }}
                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }} />
                  <input value={block.attribution} onChange={(e) => updateBlock(i, { attribution: e.target.value })}
                    placeholder="— Attribution" style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: '#999', fontWeight: 600, background: 'transparent', marginTop: 4, fontFamily: 'Montserrat, sans-serif' }} />
                </div>
              )}

              {block.type === 'pdf' && (
                <div style={{ margin: '12px 0', padding: '16px 20px', border: `1px solid #eee`, borderRadius: 10, background: '#fafafa', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={22} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input value={block.title} onChange={(e) => updateBlock(i, { title: e.target.value })}
                      placeholder="PDF title (e.g. Programme Schedule 2026)" style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, background: 'transparent', color: C.fg, fontFamily: 'Montserrat, sans-serif' }} />
                    {block.url && <a href={block.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: C.primary, textDecoration: 'none', display: 'block', marginTop: 2 }}>View uploaded PDF ↗</a>}
                  </div>
                  {!block.url && <span style={{ fontSize: 11, color: '#999' }}>Uploading...</span>}
                </div>
              )}

              {block.type === 'divider' && (
                <div style={{ margin: '16px 0', borderTop: '2px solid #eee' }} />
              )}

              {/* Block controls (hover) */}
              <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, opacity: 0.3, transition: 'opacity 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.3' }}>
                {i > 0 && <button type="button" onClick={() => moveBlock(i, -1)} style={{ ...toolbarBtnStyle(), padding: '2px 4px', fontSize: 11 }} title="Move up">↑</button>}
                {i < blocks.length - 1 && <button type="button" onClick={() => moveBlock(i, 1)} style={{ ...toolbarBtnStyle(), padding: '2px 4px', fontSize: 11 }} title="Move down">↓</button>}
                <button type="button" onClick={() => removeBlock(i)} style={{ ...toolbarBtnStyle(), padding: '2px 4px', color: C.destructive }} title="Remove"><X size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Add block toolbar */}
        <div style={{ borderTop: `1px solid #eee`, padding: '10px 16px', display: 'flex', gap: 4, flexWrap: 'wrap', background: '#fafafa' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', display: 'flex', alignItems: 'center', marginRight: 4 }}>ADD:</span>
          <button type="button" onClick={() => addBlockAfter(blocks.length - 1, { type: 'paragraph', text: '' })} style={toolbarBtnStyle()} title="Text"><Type size={14} /></button>
          <button type="button" onClick={() => addBlockAfter(blocks.length - 1, { type: 'heading', level: 1, text: '' })} style={toolbarBtnStyle()} title="Heading 1"><Heading1 size={14} /></button>
          <button type="button" onClick={() => addBlockAfter(blocks.length - 1, { type: 'heading', level: 2, text: '' })} style={toolbarBtnStyle()} title="Heading 2"><Heading2 size={14} /></button>
          <button type="button" onClick={() => { setInsertIdx(blocks.length - 1); fileRef.current?.click() }} style={toolbarBtnStyle()} title="Image">{uploading ? <Loader size={14} className="animate-spin" /> : <ImageLucide size={14} />}</button>
          <button type="button" onClick={() => addBlockAfter(blocks.length - 1, { type: 'video', url: '', caption: '' })} style={toolbarBtnStyle()} title="Video"><Video size={14} /></button>
          <button type="button" onClick={() => addBlockAfter(blocks.length - 1, { type: 'quote', text: '', attribution: '' })} style={toolbarBtnStyle()} title="Quote"><Quote size={14} /></button>
          <button type="button" onClick={() => { setInsertIdx(blocks.length - 1); pdfRef.current?.click() }} style={toolbarBtnStyle()} title="PDF"><FileText size={14} /></button>
          <button type="button" onClick={() => addBlockAfter(blocks.length - 1, { type: 'divider' })} style={toolbarBtnStyle()} title="Divider"><Minus size={14} /></button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        <input ref={pdfRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
      </div>
      <p style={S.hint}>Click a text block to see formatting options · <b>Ctrl+B</b> bold · <b>Ctrl+I</b> italic · <b>Ctrl+K</b> link · Enter for new paragraph</p>
      <style dangerouslySetInnerHTML={{ __html: `
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #bbb;
          pointer-events: none;
          font-style: italic;
        }
        [contenteditable] a { color: ${C.primary}; text-decoration: underline; }
        [contenteditable] b, [contenteditable] strong { font-weight: 700; }
        [contenteditable] i, [contenteditable] em { font-style: italic; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 24px; margin: 4px 0; }
        [contenteditable] li { margin: 2px 0; }
      `}} />
    </div>
  )
}

/* ── Main Page ────────────────────────────────────── */
export default function PostsAdmin() {
  const { data: posts, loading, create, update, remove } = useSupabaseTable<any>('posts', 'created_at', false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = {
    title: '', slug: '', excerpt: '',
    content_blocks: [{ type: 'paragraph', text: '' }] as Block[],
    status: 'draft', is_featured: false,
    category: 'General',
    subspecialties: [] as string[],
    featured_image_url: '',
    author: null as AuthorInfo | null,
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (p: any) => {
    // Parse content: prefer content_html → blocks, fall back to content_plain
    let blocks: Block[] = [{ type: 'paragraph', text: '' }]
    if (p.content_html) {
      blocks = htmlToBlocks(p.content_html)
    } else if (p.content_plain) {
      blocks = p.content_plain.split('\n').filter((l: string) => l.trim()).map((l: string) => ({ type: 'paragraph' as const, text: l }))
    }

    setForm({
      title: p.title || '', slug: p.slug || '', excerpt: p.excerpt || '',
      content_blocks: blocks,
      status: p.status || 'draft', is_featured: p.is_featured || false,
      category: p.category || 'General',
      subspecialties: Array.isArray(p.subspecialties) ? p.subspecialties : [],
      featured_image_url: p.featured_image_url || '',
      author: p.author_name ? { id: p.author_id || '', name: p.author_name, role: p.author_role || '', photo_url: p.author_photo_url || '' } : null,
    })
    setEditing(p.id)
  }

  const handleSave = async () => {
    if (!form.title) { showToast('Title is required', 'error'); return }
    setSaving(true)
    try {
      const contentHtml = blocksToHtml(form.content_blocks)
      const contentPlain = blocksToPlain(form.content_blocks)
      const excerpt = form.excerpt || contentPlain.slice(0, 200)

      const payload: any = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        content_html: contentHtml,
        content_plain: contentPlain,
        excerpt,
        status: form.status,
        is_featured: form.is_featured,
        category: form.category,
        subspecialties: form.subspecialties,
        featured_image_url: form.featured_image_url || null,
        author_id: form.author?.id || null,
        author_name: form.author?.name || null,
        author_role: form.author?.role || null,
        author_photo_url: form.author?.photo_url || null,
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      }

      if (editing === 'new') { await create(payload); showToast('Post created') }
      else { await update(editing!, payload); showToast('Post updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return
    setDeleting(id)
    try { await remove(id); showToast('Post deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const filtered = posts.filter((p: any) => !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : C.destructive }}>{toast.msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 700, color: C.navy }}>News & Posts</h1>
          <p style={{ fontSize: 14, color: C.secondary, marginTop: 4 }}>{posts.length} posts in database</p>
        </div>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: C.navy, color: C.navyFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><Plus size={16} strokeWidth={2.5} /> New Post</button>
      </div>

      <input style={{ ...S.input, maxWidth: 400, marginBottom: 24 }} placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color={C.muted} /></div>
      : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '80px 20px', textAlign: 'center' }}>
          <Newspaper size={40} color={C.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: C.fg }}>No posts found</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.bg}` }}>
              {['Post', 'Category', 'Author', 'Published', 'Status', 'Views', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.bg}` }}>
                  <td style={{ padding: '14px 16px', maxWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.featured_image_url && <img src={p.featured_image_url} alt="" style={{ width: 48, height: 36, borderRadius: 6, objectFit: 'cover' }} />}
                      <div>
                        <div style={{ fontWeight: 600, color: C.fg }}>{p.title}</div>
                        {p.excerpt && <div style={{ fontSize: 12, color: C.secondary, marginTop: 1, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.excerpt}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><span style={S.badge('#FEF3C7', '#92400E')}>{p.category || 'General'}</span></td>
                  <td style={{ padding: '14px 16px', color: C.secondary, fontSize: 12 }}>{p.author_name || '—'}</td>
                  <td style={{ padding: '14px 16px', color: C.secondary, fontSize: 12 }}>{p.published_at ? new Date(p.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '14px 16px' }}><span style={S.badge(p.status === 'published' ? '#f0fdf4' : '#fefce8', p.status === 'published' ? '#16a34a' : '#a16207')}>{p.status}</span></td>
                  <td style={{ padding: '14px 16px', color: C.secondary }}>{p.view_count || 0}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => openEdit(p)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.secondary }}><Edit size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}>{deleting === p.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ──────────────────────────────────── */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, paddingBottom: 16, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 860, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fff', borderRadius: '20px 20px 0 0', zIndex: 10 }}>
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 700, color: C.navy }}>{editing === 'new' ? 'New Post' : 'Edit Post'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}><X size={20} /></button>
            </div>

            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>

              {/* Featured image */}
              <ImageUploadBox value={form.featured_image_url} onChange={(url) => setForm({ ...form, featured_image_url: url })} folder="posts" label="Featured Image" />

              {/* Title */}
              <div>
                <label style={S.label}>Title *</label>
                <input style={{ ...S.input, fontSize: 18, fontWeight: 600, padding: '12px 14px' }} value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugify(e.target.value) })}
                  placeholder="Post title..." />
              </div>

              {/* Slug */}
              <div>
                <label style={S.label}>Slug</label>
                <input style={{ ...S.input, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>

              {/* Author picker */}
              <AuthorPicker value={form.author} onChange={(a) => setForm({ ...form, author: a })} />

              {/* Category + Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.label}>Category</label>
                  <select style={S.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: C.fg, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} style={{ width: 18, height: 18 }} />
                    Featured
                  </label>
                </div>
              </div>

              {/* Excerpt */}
              <div>
                <label style={S.label}>Excerpt <span style={{ fontWeight: 400, color: '#999' }}>(auto-generated if blank)</span></label>
                <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' as const }} value={form.excerpt}
                  onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                  placeholder="Brief summary for listings and previews..." />
              </div>

              {/* Subspecialties */}
              <div>
                <label style={S.label}>Subspecialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUBSPECIALTIES.map(s => {
                    const sel = form.subspecialties.includes(s)
                    return <button key={s} type="button" onClick={() => {
                      const v = sel ? form.subspecialties.filter(x => x !== s) : [...form.subspecialties, s]
                      setForm({ ...form, subspecialties: v })
                    }}
                      style={{ padding: '4px 12px', borderRadius: 20, border: sel ? `1.5px solid ${C.primary}` : `1.5px solid ${C.muted}`, background: sel ? C.primaryBg : '#fff', color: sel ? C.primary : C.secondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>{s}</button>
                  })}
                </div>
              </div>

              {/* Block editor */}
              <div style={S.section}>
                <BlockEditor blocks={form.content_blocks} onChange={(b) => setForm({ ...form, content_blocks: b })} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '18px 28px', borderTop: '1px solid #eee', background: '#fafafa', borderRadius: '0 0 20px 20px', position: 'sticky', bottom: 0 }}>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: C.secondary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: C.navy, color: C.navyFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Publish Post' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}