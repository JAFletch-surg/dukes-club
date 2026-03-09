'use client'

import { useState, useRef } from 'react'
import { Building2, Plus, Edit, Trash2, Save, Loader, X, ImageIcon, Globe, MapPin, Search } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { useImageUpload } from '@/lib/use-image-upload'

const TYPES = ['NHS Trust', 'NHS Foundation Trust', 'University Hospital', 'Private Hospital', 'Hospital', 'Medical School', 'Research Institute', 'Other']

/* ── Style tokens (matching your fellowship admin) ── */
const C = { navy: '#0F1F3D', navyFg: '#F5F8FC', gold: '#E5A718', primary: '#0078D4', bg: '#F1F1F3', fg: '#181820', card: '#FAFAFA', muted: '#D1D1D6', secondary: '#504F58', destructive: '#DB2424', border: '#D1D1D6', accentBg: '#E5F1FB', primaryBg: '#E5F1FB' }
const S = {
  input: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#999', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
}

/* ── Image upload box ── */
function ImageUploadBox({ value, onChange, folder, label, height = 120 }: { value: string; onChange: (url: string) => void; folder: string; label: string; height?: number }) {
  const { upload, uploading, error } = useImageUpload()
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f, folder); if (url) onChange(url); e.target.value = '' }
  return (
    <div>
      <label style={S.label}>{label}</label>
      {value ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.muted}` }}>
          <img src={value} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{ width: '100%', height, border: `2px dashed ${C.muted}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.secondary, background: '#fff', cursor: uploading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500 }}>
          {uploading ? <><Loader size={18} className="animate-spin" />Uploading...</> : <><ImageIcon size={20} strokeWidth={1.5} /><span style={{ fontSize: 11, color: '#999' }}>Click to upload</span></>}
        </button>
      )}
      {error && <p style={{ fontSize: 12, color: C.destructive, marginTop: 6 }}>{error}</p>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

export default function InstitutionsAdmin() {
  const { data: institutions, loading, create, update, remove } = useSupabaseTable<any>('institutions', 'name', true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = {
    name: '', address: '', city: '', country: 'United Kingdom', type: 'NHS Trust',
    logo_url: '', image_url: '', website_url: '', latitude: '', longitude: '',
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (inst: any) => {
    setForm({
      name: inst.name || '', address: inst.address || '', city: inst.city || '',
      country: inst.country || 'United Kingdom', type: inst.type || 'NHS Trust',
      logo_url: inst.logo_url || '', image_url: inst.image_url || '',
      website_url: inst.website_url || '',
      latitude: inst.latitude?.toString() || '', longitude: inst.longitude?.toString() || '',
    })
    setEditing(inst.id)
  }

  const handleSave = async () => {
    if (!form.name) { showToast('Name is required', 'error'); return }
    setSaving(true)
    try {
      const payload: any = {
        name: form.name, address: form.address || null, city: form.city || null,
        country: form.country, type: form.type,
        logo_url: form.logo_url || null, image_url: form.image_url || null,
        website_url: form.website_url || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      }
      if (editing === 'new') { await create(payload); showToast('Institution added') }
      else { await update(editing!, payload); showToast('Institution updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this institution? It may be referenced by fellowships and events.')) return
    setDeleting(id)
    try { await remove(id); showToast('Institution deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const filtered = institutions.filter((i: any) => !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.city?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : C.destructive }}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 700, color: C.navy }}>Institutions</h1>
          <p style={{ fontSize: 14, color: C.secondary, marginTop: 4 }}>Reusable across fellowships, events, and faculty profiles · {institutions.length} institutions</p>
        </div>
        <button onClick={openNew} className="hidden sm:flex" style={{ alignItems: 'center', gap: 8, padding: '10px 20px', background: C.navy, color: C.navyFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><Plus size={16} strokeWidth={2.5} /> Add Institution</button>
      </div>

      <input style={{ ...S.input, maxWidth: 400, marginBottom: 24 }} placeholder="Search institutions..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color={C.muted} /></div>
      : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '80px 20px', textAlign: 'center' }}>
          <Building2 size={40} color={C.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: C.fg }}>No institutions found</p>
          <p style={{ fontSize: 13, color: C.secondary, marginTop: 4 }}>Add your first institution to start linking them to fellowships and events</p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.bg}` }}>
              {['Institution', 'City', 'Country', 'Type', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((inst: any) => (
                <tr key={inst.id} style={{ borderBottom: `1px solid ${C.bg}` }}>
                  <td style={{ padding: '14px 16px', maxWidth: 320 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: inst.logo_url ? 'transparent' : 'rgba(15,31,61,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                        {inst.logo_url ? <img src={inst.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building2 size={18} color={C.navy} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: C.fg }}>{inst.name}</div>
                        {inst.address && <div style={{ fontSize: 12, color: C.secondary, marginTop: 1 }}>{inst.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: C.secondary }}>{inst.city || '—'}</td>
                  <td style={{ padding: '14px 16px', color: C.secondary }}>{inst.country || '—'}</td>
                  <td style={{ padding: '14px 16px' }}><span style={S.badge(C.primaryBg, C.primary)}>{inst.type}</span></td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => openEdit(inst)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.secondary }}><Edit size={16} /></button>
                      <button onClick={() => handleDelete(inst.id)} disabled={deleting === inst.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}>{deleting === inst.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((inst: any) => (
            <div key={inst.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: inst.logo_url ? 'transparent' : 'rgba(15,31,61,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                  {inst.logo_url ? <img src={inst.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building2 size={18} color={C.navy} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: C.fg, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
                  <div style={{ fontSize: 12, color: C.secondary, marginTop: 1 }}>{[inst.city, inst.country].filter(Boolean).join(', ') || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => openEdit(inst)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.secondary }}><Edit size={16} /></button>
                  <button onClick={() => handleDelete(inst.id)} disabled={deleting === inst.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}>{deleting === inst.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>
                </div>
              </div>
              <span style={S.badge(C.primaryBg, C.primary)}>{inst.type}</span>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Mobile FAB */}
      <button onClick={openNew} className="sm:hidden fixed bottom-[4.5rem] right-4 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center" style={{ background: C.navy, color: C.navyFg, border: 'none', cursor: 'pointer' }}>
        <Plus size={24} />
      </button>

      {/* ── Modal ── */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40, paddingBottom: 16, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 640, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #eee' }}>
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 700, color: C.navy }}>{editing === 'new' ? 'Add Institution' : 'Edit Institution'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}><X size={20} /></button>
            </div>

            <div className="p-4 sm:px-7 sm:py-6" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Logo + Cover image side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
                <ImageUploadBox value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} folder="institutions/logos" label="Logo" height={100} />
                <ImageUploadBox value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="institutions/images" label="Cover Image" height={100} />
              </div>

              <div><label style={S.label}>Institution Name *</label><input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. St Mark's Hospital" /></div>
              <div><label style={S.label}>Full Address</label><input style={S.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, Postcode" /></div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div><label style={S.label}>City</label><input style={S.input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><label style={S.label}>Country</label><input style={S.input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                <div><label style={S.label}>Type</label><select style={S.select} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>

              <div><label style={S.label}>Website URL</label><input style={S.input} value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://..." /></div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div><label style={S.label}>Latitude</label><input style={S.input} type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="e.g. 51.5074" /></div>
                <div><label style={S.label}>Longitude</label><input style={S.input} type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="e.g. -0.1278" /></div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '18px 28px', borderTop: '1px solid #eee', background: '#fafafa', borderRadius: '0 0 20px 20px' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: C.secondary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: C.navy, color: C.navyFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Add Institution' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}