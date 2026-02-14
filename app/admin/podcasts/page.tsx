'use client'

import { useState } from 'react'
import { Mic, Plus, Edit, Trash2, Save, Loader, X, ExternalLink } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'

const STATUSES = ['draft', 'published', 'archived']
const TAGS = [
  'Cancer','Rectal Cancer','IBD','Pelvic Floor','Robotic','Laparoscopic',
  'Intestinal Failure','Proctology','Fistula','Emergency','Upper GI','HPB',
  'Endocrine','Breast','Trauma','Education','Research','Career',
]

const S = {
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif', minHeight: 100, resize: 'vertical' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  btn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
}

export default function PodcastsAdmin() {
  const { data: podcasts, loading, create, update, remove } = useSupabaseTable<any>('podcasts', 'created_at', false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = {
    title: '', description: '', episode_number: 1,
    guest_name: '', guest_title: '',
    audio_url: '', external_url: '',
    duration_seconds: 0, tags: [] as string[],
    status: 'draft', published_at: '',
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm({ ...emptyForm, episode_number: podcasts.length + 1 }); setEditing('new') }
  const openEdit = (p: any) => {
    setForm({
      title: p.title || '', description: p.description || '',
      episode_number: p.episode_number || 1,
      guest_name: p.guest_name || '', guest_title: p.guest_title || '',
      audio_url: p.audio_url || '', external_url: p.external_url || '',
      duration_seconds: p.duration_seconds || 0,
      tags: Array.isArray(p.tags) ? p.tags : [],
      status: p.status || 'draft',
      published_at: p.published_at?.slice(0, 10) || '',
    })
    setEditing(p.id)
  }

  const handleSave = async () => {
    if (!form.title) { showToast('Title is required', 'error'); return }
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        published_at: form.status === 'published' ? (form.published_at || new Date().toISOString()) : null,
      }
      if (editing === 'new') { await create(payload); showToast('Podcast created') }
      else { await update(editing!, payload); showToast('Podcast updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this podcast?')) return
    setDeleting(id)
    try { await remove(id); showToast('Podcast deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const fmtDur = (s: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—'
  const filtered = podcasts.filter((p: any) => !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.guest_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Podcasts</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>{podcasts.length} episodes</p>
        </div>
        <button onClick={openNew} style={S.btn}><Plus size={16} strokeWidth={2.5} /> Add Episode</button>
      </div>

      <input style={{ ...S.input, maxWidth: 400, marginBottom: 24 }} placeholder="Search podcasts..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '80px 20px', textAlign: 'center' }}>
          <Mic size={40} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No podcasts found</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #F1F1F3' }}>
                {['#', 'Title', 'Guest', 'Duration', 'Tags', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F1F3' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#C49A6C' }}>{p.episode_number}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#181820', maxWidth: 240 }}>{p.title}</td>
                  <td style={{ padding: '14px 16px', color: '#504F58' }}>{p.guest_name || '—'}</td>
                  <td style={{ padding: '14px 16px', color: '#504F58' }}>{fmtDur(p.duration_seconds)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(p.tags || []).slice(0, 2).map((t: string) => <span key={t} style={S.badge('#FCF5FF', '#9333EA')}>{t}</span>)}
                      {(p.tags || []).length > 2 && <span style={{ fontSize: 11, color: '#888' }}>+{p.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={S.badge(p.status === 'published' ? '#f0fdf4' : '#fefce8', p.status === 'published' ? '#16a34a' : '#a16207')}>{p.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => openEdit(p)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Edit size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}>
                        {deleting === p.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 640, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #E4E4E8' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Add Episode' : 'Edit Episode'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 }}>
                <div><label style={S.label}>Episode #</label><input style={S.input} type="number" value={form.episode_number} onChange={(e) => setForm({ ...form, episode_number: Number(e.target.value) })} /></div>
                <div><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Episode title" /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Guest Name</label><input style={S.input} value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} /></div>
                <div><label style={S.label}>Guest Title</label><input style={S.input} value={form.guest_title} onChange={(e) => setForm({ ...form, guest_title: e.target.value })} placeholder="e.g. Consultant, Royal London" /></div>
              </div>

              <div><label style={S.label}>Description</label><textarea style={S.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Episode description..." /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Audio URL</label><input style={S.input} value={form.audio_url} onChange={(e) => setForm({ ...form, audio_url: e.target.value })} placeholder="https://..." /><p style={S.hint}>Direct link to MP3 or hosted player</p></div>
                <div><label style={S.label}>External Link</label><input style={S.input} value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="Spotify, Apple Podcasts, etc." /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div><label style={S.label}>Duration (seconds)</label><input style={S.input} type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} /></div>
                <div><label style={S.label}>Status</label><select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label style={S.label}>Published Date</label><input style={S.input} type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} /></div>
              </div>

              <div>
                <label style={S.label}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TAGS.map(t => {
                    const selected = form.tags.includes(t)
                    return (
                      <button key={t} type="button" onClick={() => {
                        const tags = selected ? form.tags.filter(x => x !== t) : [...form.tags, t]
                        setForm({ ...form, tags })
                      }}
                        style={{ padding: '4px 12px', borderRadius: 20, border: selected ? '1.5px solid #7C3AED' : '1.5px solid #D1D1D6', background: selected ? '#F5F3FF' : '#fff', color: selected ? '#7C3AED' : '#504F58', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '18px 28px', borderTop: '1px solid #E4E4E8', background: '#FAFAFA', borderRadius: '0 0 20px 20px' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Create Episode' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
