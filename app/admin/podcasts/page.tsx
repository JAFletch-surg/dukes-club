'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, Plus, Edit, Trash2, Save, Loader, X, Search } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'

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

function getSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null
  // Match spotify.com/episode/{id} or spotify.com/embed/episode/{id}
  const match = url.match(/spotify\.com\/(?:embed\/)?episode\/([a-zA-Z0-9]+)/)
  return match ? `https://open.spotify.com/embed/episode/${match[1]}?utm_source=generator` : null
}

/* ── Faculty search (mirrors events page pattern) ── */
function GuestFacultySearch({ faculty, onSelect }: {
  faculty: any[]
  onSelect: (f: any) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const matches = faculty.filter(f => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      f.full_name?.toLowerCase().includes(q) ||
      f.hospital?.toLowerCase().includes(q) ||
      f.position_title?.toLowerCase().includes(q)
    )
  })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        border: '1.5px solid #D1D1D6', borderRadius: 10, padding: '0 12px',
        background: '#fff',
        ...(open ? { borderColor: '#7C3AED', boxShadow: '0 0 0 3px rgba(124,58,237,0.1)' } : {}),
      }}>
        <Search size={15} color="#999" style={{ flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search faculty by name, hospital, or role..."
          style={{
            width: '100%', padding: '10px 0', border: 'none', fontSize: 14,
            color: '#000', background: 'transparent', outline: 'none',
            fontFamily: 'Montserrat, sans-serif',
          }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setOpen(false) }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', padding: 2, flexShrink: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          marginTop: 4, background: '#fff', border: '1.5px solid #D1D1D6',
          borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: '16px 14px', textAlign: 'center', color: '#999', fontSize: 13 }}>
              No matching faculty found
            </div>
          ) : (
            matches.slice(0, 20).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => { onSelect(f); setQuery(''); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', textAlign: 'left', fontSize: 13,
                  borderBottom: '1px solid #F1F1F3', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F5FF')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                {f.photo_url ? (
                  <img src={f.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#059669',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {f.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#181820', lineHeight: 1.3 }}>{f.full_name}</div>
                  <div style={{ fontSize: 11, color: '#888', lineHeight: 1.3, marginTop: 1 }}>
                    {[f.position_title, f.hospital].filter(Boolean).join(' · ') || 'Faculty'}
                  </div>
                </div>
                <Plus size={14} color="#7C3AED" style={{ flexShrink: 0 }} />
              </button>
            ))
          )}
          {matches.length > 20 && (
            <div style={{ padding: '8px 14px', textAlign: 'center', color: '#999', fontSize: 11 }}>
              Type to narrow down {matches.length} results...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PodcastsAdmin() {
  const { data: podcasts, loading, create, update, remove } = useSupabaseTable<any>('podcasts', 'created_at', false)
  const [faculty, setFaculty] = useState<any[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  // Load faculty list
  useEffect(() => {
    const supabase = createClient()
    supabase.from('faculty').select('id, full_name, position_title, hospital, photo_url').order('full_name').then(({ data }: any) => setFaculty(data || []))
  }, [])

  const emptyForm = {
    title: '', description: '', episode_number: 1,
    guest_name: '', guest_title: '',
    spotify_url: '',
    duration_seconds: 0, subspecialties: [] as string[],
    status: 'draft', published_at: '',
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm({ ...emptyForm, episode_number: podcasts.length + 1 }); setEditing('new') }
  const openEdit = (p: any) => {
    setForm({
      title: p.title || '', description: p.description || '',
      episode_number: p.episode_number || 1,
      guest_name: p.guest_name || '', guest_title: p.guest_title || '',
      spotify_url: p.spotify_url || '',
      duration_seconds: p.duration_seconds || 0,
      subspecialties: Array.isArray(p.subspecialties) ? p.subspecialties : [],
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Podcasts</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>{podcasts.length} episodes</p>
        </div>
        <button onClick={openNew} className="hidden sm:flex" style={{ ...S.btn }}><Plus size={16} strokeWidth={2.5} /> Add Episode</button>
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
        <>
        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', overflow: 'auto' }}>
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
                      {(p.subspecialties || []).slice(0, 2).map((t: string) => <span key={t} style={S.badge('#FCF5FF', '#9333EA')}>{t}</span>)}
                      {(p.subspecialties || []).length > 2 && <span style={{ fontSize: 11, color: '#888' }}>+{p.subspecialties.length - 2}</span>}
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

        {/* Mobile cards */}
        <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((p: any) => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #D1D1D6', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#C49A6C', flexShrink: 0 }}>#{p.episode_number}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#181820', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: '#504F58', marginTop: 2 }}>{p.guest_name || 'No guest'} · {fmtDur(p.duration_seconds)}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => openEdit(p)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Edit size={16} /></button>
                  <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}>
                    {deleting === p.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={S.badge(p.status === 'published' ? '#f0fdf4' : '#fefce8', p.status === 'published' ? '#16a34a' : '#a16207')}>{p.status}</span>
                {(p.subspecialties || []).slice(0, 2).map((t: string) => <span key={t} style={S.badge('#FCF5FF', '#9333EA')}>{t}</span>)}
                {(p.subspecialties || []).length > 2 && <span style={{ fontSize: 11, color: '#888' }}>+{p.subspecialties.length - 2}</span>}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Mobile FAB */}
      <button onClick={openNew} className="sm:hidden fixed bottom-[4.5rem] right-4 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center" style={{ ...S.btn, padding: 0, borderRadius: '50%' }}>
        <Plus size={24} />
      </button>

      {/* Modal */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 640, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #E4E4E8' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Add Episode' : 'Edit Episode'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>
            <div className="p-4 sm:px-7 sm:py-6" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-3.5">
                <div><label style={S.label}>Episode #</label><input style={S.input} type="number" value={form.episode_number} onChange={(e) => setForm({ ...form, episode_number: Number(e.target.value) })} /></div>
                <div><label style={S.label}>Title *</label><input style={S.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Episode title" /></div>
              </div>

              <div>
                <label style={S.label}>Guest (select from faculty)</label>
                <GuestFacultySearch faculty={faculty} onSelect={(f) => setForm({
                  ...form,
                  guest_name: f.full_name || '',
                  guest_title: [f.position_title, f.hospital].filter(Boolean).join(', '),
                })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div><label style={S.label}>Guest Name</label><input style={S.input} value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} /></div>
                <div><label style={S.label}>Guest Title</label><input style={S.input} value={form.guest_title} onChange={(e) => setForm({ ...form, guest_title: e.target.value })} placeholder="e.g. Consultant, Royal London" /></div>
              </div>

              <div><label style={S.label}>Description</label><textarea style={S.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Episode description..." /></div>

              <div>
                <label style={S.label}>Spotify Episode URL</label>
                <input style={S.input} value={form.spotify_url} onChange={(e) => setForm({ ...form, spotify_url: e.target.value })} placeholder="https://open.spotify.com/episode/..." />
                <p style={S.hint}>Paste the Spotify episode link or embed URL</p>
                {getSpotifyEmbedUrl(form.spotify_url) && (
                  <div style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden' }}>
                    <iframe
                      src={getSpotifyEmbedUrl(form.spotify_url)!}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      style={{ borderRadius: 12 }}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div><label style={S.label}>Duration (seconds)</label><input style={S.input} type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} /></div>
                <div><label style={S.label}>Status</label><select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label style={S.label}>Published Date</label><input style={S.input} type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} /></div>
              </div>

              <div>
                <label style={S.label}>Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TAGS.map(t => {
                    const selected = form.subspecialties.includes(t)
                    return (
                      <button key={t} type="button" onClick={() => {
                        const subspecialties = selected ? form.subspecialties.filter(x => x !== t) : [...form.subspecialties, t]
                        setForm({ ...form, subspecialties })
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
