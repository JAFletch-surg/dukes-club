'use client'

import { useState, useEffect } from 'react'
import { Video, Plus, Edit, Trash2, Save, Loader, X, Search, Eye, Clock, Upload } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'

/* ── Constants ───────────────────────────────────── */
const VIDEO_CATEGORIES = ['Operative', 'Complications', 'Webinar', 'Education', 'Lecture', 'Endoscopy', 'Conference']
const STATUSES = ['draft', 'published', 'archived']
const SUBSPECIALTIES = [
  'Cancer - Colon','Cancer - Rectal','Cancer - Anal','Cancer - Advanced',
  'Peritoneal Malignancy','IBD','Abdominal Wall','Pelvic Floor',
  'Proctology','Fistula','Intestinal Failure','Emergency','Trauma',
  'Research','Endoscopy','Training','Radiology','Robotic','Laparoscopic',
  'Open','TAMIS','General',
]

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
function fmtDuration(seconds: number) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/* ── Style tokens (matching other admin pages) ──── */
const C = { navy: '#0F1F3D', navyFg: '#F5F8FC', gold: '#E5A718', primary: '#0078D4', bg: '#F1F1F3', fg: '#181820', card: '#FAFAFA', muted: '#D1D1D6', secondary: '#504F58', destructive: '#DB2424', border: '#D1D1D6' }
const S = {
  input: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#999', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  section: { marginTop: 8, paddingTop: 18, borderTop: '1px solid #eee' } as React.CSSProperties,
  sectionTitle: { fontSize: 15, fontWeight: 700, color: C.fg, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
}

/* ── Types ────────────────────────────────────────── */
interface VideoRecord {
  id: string
  title: string
  slug: string
  description: string | null
  vimeo_id: string | null
  duration_seconds: number
  thumbnail_url: string | null
  tags: string[]
  vimeo_plays: number
  vimeo_created_at: string | null
  speaker: string | null
  category: string | null
  is_members_only: boolean
  status: string
  published_at: string | null
  created_at: string
}

/* ═════════════════════════════════════════════════════
   MAIN ADMIN VIDEOS PAGE
   ═════════════════════════════════════════════════════ */
export default function AdminVideosPage() {
  const { data: videos, loading, error, refetch, create, update, remove } = useSupabaseTable<VideoRecord>('videos', 'created_at', false)

  const [editing, setEditing] = useState<VideoRecord | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  /* ── Form state ──────────────────────────────────── */
  const [form, setForm] = useState({
    title: '',
    vimeo_id: '',
    description: '',
    duration_seconds: 0,
    thumbnail_url: '',
    speaker: '',
    category: '',
    tags: [] as string[],
    status: 'draft',
    is_members_only: true,
    published_at: '',
  })

  const openNew = () => {
    setIsNew(true)
    setEditing({} as VideoRecord)
    setForm({
      title: '', vimeo_id: '', description: '', duration_seconds: 0,
      thumbnail_url: '', speaker: '', category: '', tags: [],
      status: 'draft', is_members_only: true, published_at: '',
    })
  }

  const openEdit = (v: VideoRecord) => {
    setIsNew(false)
    setEditing(v)
    setForm({
      title: v.title || '',
      vimeo_id: v.vimeo_id || '',
      description: v.description || '',
      duration_seconds: v.duration_seconds || 0,
      thumbnail_url: v.thumbnail_url || '',
      speaker: v.speaker || '',
      category: v.category || '',
      tags: Array.isArray(v.tags) ? v.tags : [],
      status: v.status || 'draft',
      is_members_only: v.is_members_only ?? true,
      published_at: v.published_at ? v.published_at.slice(0, 10) : '',
    })
  }

  const closeModal = () => { setEditing(null); setIsNew(false) }

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required')
    setSaving(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        slug: slugify(form.title),
        vimeo_id: form.vimeo_id.trim() || null,
        description: form.description.trim() || null,
        duration_seconds: form.duration_seconds || 0,
        thumbnail_url: form.thumbnail_url.trim() || null,
        speaker: form.speaker.trim() || null,
        category: form.category || null,
        tags: form.tags,
        status: form.status,
        is_members_only: form.is_members_only,
        published_at: form.published_at || null,
      }
      if (isNew) {
        await create(payload)
      } else if (editing?.id) {
        await update(editing.id, payload)
      }
      closeModal()
    } catch (err: any) {
      alert('Save failed: ' + err.message)
    }
    setSaving(false)
  }

  const handleDelete = async (v: VideoRecord) => {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return
    try { await remove(v.id) } catch (err: any) { alert('Delete failed: ' + err.message) }
  }

  /* ── Fetch thumbnail from Vimeo API ──────────────── */
  const fetchVimeoData = async () => {
    if (!form.vimeo_id) return
    try {
      const res = await fetch(`/api/vimeo/video?id=${form.vimeo_id}`)
      if (!res.ok) throw new Error('Vimeo API error')
      const data = await res.json()
      setForm(f => ({
        ...f,
        thumbnail_url: data.thumbnail_url || f.thumbnail_url,
        duration_seconds: data.duration || f.duration_seconds,
        title: f.title || data.name || f.title,
        description: f.description || data.description || f.description,
      }))
    } catch (err) {
      console.error('Failed to fetch Vimeo data:', err)
    }
  }

  /* ── Filter videos ───────────────────────────────── */
  const filtered = videos.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q || v.title.toLowerCase().includes(q) || (v.speaker || '').toLowerCase().includes(q) || (v.vimeo_id || '').includes(q)
    const matchStatus = filterStatus === 'all' || v.status === filterStatus
    const matchCategory = filterCategory === 'all' || v.category === filterCategory
    return matchSearch && matchStatus && matchCategory
  })

  /* ── STATUS BADGE ──────────────────────────────── */
  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      published: { bg: '#DCFCE7', fg: '#166534' },
      draft: { bg: '#FEF3C7', fg: '#92400E' },
      archived: { bg: '#F3F4F6', fg: '#6B7280' },
    }
    const c = colors[status] || colors.draft
    return <span style={S.badge(c.bg, c.fg)}>{status}</span>
  }

  /* ═══ RENDER ═════════════════════════════════════ */
  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.fg, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video size={26} /> Videos
          </h1>
          <p style={{ color: C.secondary, fontSize: 14, marginTop: 4 }}>
            {videos.length} video{videos.length !== 1 ? 's' : ''} in library
          </p>
        </div>
        <button
          onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: C.navy, color: C.navyFg,
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
          }}
        >
          <Plus size={18} /> Add Video
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input
            placeholder="Search by title, speaker, or Vimeo ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, paddingLeft: 36 }}
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...S.select, width: 160 }}>
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...S.select, width: 180 }}>
          <option value="all">All categories</option>
          {VIDEO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Loader size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Loading videos...
        </div>
      )}
      {error && <p style={{ color: C.destructive, marginBottom: 16 }}>Error: {error}</p>}

      {/* Table */}
      {!loading && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Video</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tags</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Views</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: C.secondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id} style={{ borderBottom: `1px solid #F1F1F3` }}>
                  {/* Video info */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {/* Thumbnail */}
                      <div style={{ width: 80, height: 48, borderRadius: 8, overflow: 'hidden', background: C.navy, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v.thumbnail_url ? (
                          <img src={v.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Video size={18} color="rgba(255,255,255,0.3)" />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 600, color: C.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                          {v.title}
                        </p>
                        <p style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                          {v.speaker && <span>{v.speaker} · </span>}
                          <span>{fmtDuration(v.duration_seconds)}</span>
                          {v.vimeo_id && <span> · Vimeo {v.vimeo_id}</span>}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{ padding: '14px 16px' }}>
                    {v.category ? (
                      <span style={S.badge('#EEF2FF', '#4338CA')}>{v.category}</span>
                    ) : (
                      <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* Tags */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                      {(v.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} style={{ ...S.badge('#F3F4F6', '#374151'), fontSize: 10 }}>{tag}</span>
                      ))}
                      {(v.tags || []).length > 3 && (
                        <span style={{ ...S.badge('#F3F4F6', '#9CA3AF'), fontSize: 10 }}>+{v.tags.length - 3}</span>
                      )}
                      {(!v.tags || v.tags.length === 0) && <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <StatusBadge status={v.status} />
                    {v.is_members_only && (
                      <span style={{ ...S.badge('#FFF7ED', '#C2410C'), marginLeft: 6, fontSize: 10 }}>Members</span>
                    )}
                  </td>

                  {/* Views */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#999', fontSize: 12 }}>
                      <Eye size={13} /> {v.vimeo_plays || 0}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(v)} title="Edit"
                        style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.primary, borderRadius: 6 }}>
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(v)} title="Delete"
                        style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.destructive, borderRadius: 6 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#999' }}>
                    {search || filterStatus !== 'all' || filterCategory !== 'all'
                      ? 'No videos match your filters.'
                      : 'No videos yet. Click "Add Video" to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ EDIT / ADD MODAL ══════════════════════════ */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #eee' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg }}>
                {isNew ? 'Add Video' : 'Edit Video'}
              </h2>
              <button onClick={closeModal} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Title */}
              <div>
                <label style={S.label}>Title <span style={{ color: C.destructive }}>*</span></label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Complete mesocolic excision"
                  style={S.input}
                />
              </div>

              {/* Vimeo ID + Fetch button */}
              <div>
                <label style={S.label}>Vimeo ID</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={form.vimeo_id}
                    onChange={e => setForm(f => ({ ...f, vimeo_id: e.target.value }))}
                    placeholder="e.g. 353960614"
                    style={{ ...S.input, flex: 1 }}
                  />
                  <button
                    onClick={fetchVimeoData}
                    title="Fetch title, thumbnail & duration from Vimeo"
                    style={{
                      padding: '10px 16px', border: `1.5px solid ${C.muted}`, borderRadius: 10,
                      background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 600, color: C.primary, fontFamily: 'Montserrat, sans-serif',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Upload size={14} /> Fetch
                  </button>
                </div>
                <p style={S.hint}>Enter Vimeo ID and click Fetch to auto-fill thumbnail, duration &amp; title</p>
              </div>

              {/* Speaker */}
              <div>
                <label style={S.label}>Speaker / Presenter</label>
                <input
                  value={form.speaker}
                  onChange={e => setForm(f => ({ ...f, speaker: e.target.value }))}
                  placeholder="e.g. Mr J. Smith"
                  style={S.input}
                />
              </div>

              {/* Description */}
              <div>
                <label style={S.label}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {/* Category */}
              <div>
                <label style={S.label}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={S.select}
                >
                  <option value="">Select category...</option>
                  {VIDEO_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Tags / Subspecialties */}
              <div>
                <label style={S.label}>Tags / Subspecialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUBSPECIALTIES.map(tag => {
                    const sel = form.tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          border: sel ? '1.5px solid #7C3AED' : '1.5px solid #D1D1D6',
                          background: sel ? '#7C3AED' : '#fff',
                          color: sel ? '#fff' : '#504F58',
                          cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
                {form.tags.length > 0 && (
                  <p style={S.hint}>{form.tags.length} tag{form.tags.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>

              {/* Thumbnail URL */}
              <div>
                <label style={S.label}>Thumbnail URL</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                  <input
                    value={form.thumbnail_url}
                    onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                    placeholder="https://..."
                    style={{ ...S.input, flex: 1 }}
                  />
                  {form.thumbnail_url && (
                    <div style={{ width: 80, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f1f1f3' }}>
                      <img src={form.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Duration + Status + Date row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Duration (sec)</label>
                  <input
                    type="number"
                    value={form.duration_seconds || ''}
                    onChange={e => setForm(f => ({ ...f, duration_seconds: Number(e.target.value) || 0 }))}
                    style={S.input}
                  />
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    style={S.select}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Publish Date</label>
                  <input
                    type="date"
                    value={form.published_at}
                    onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                    style={S.input}
                  />
                </div>
              </div>

              {/* Members only toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_members_only}
                  onChange={e => setForm(f => ({ ...f, is_members_only: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: C.primary }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Members Only</span>
              </label>
            </div>

            {/* Modal footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #eee', background: '#FAFAFA', borderRadius: '0 0 16px 16px' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '10px 20px', border: `1.5px solid ${C.muted}`, borderRadius: 10,
                  background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  color: C.secondary, fontFamily: 'Montserrat, sans-serif',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 24px', border: 'none', borderRadius: 10,
                  background: saving || !form.title.trim() ? '#ccc' : C.navy, color: C.navyFg,
                  fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}