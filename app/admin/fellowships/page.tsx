'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe, Plus, Edit, Trash2, Save, Loader, X, ImageIcon, MapPin, Clock, Stethoscope, MessageSquareQuote, Search, Users, Building2 } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { useImageUpload } from '@/lib/use-image-upload'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['draft', 'published', 'archived']
const DURATIONS = ['6 months', '12 months']
const SUBSPECIALTIES = [
  'Robotic','Laparoscopic','Open','TAMIS','Cancer','Rectal Cancer','Advanced Cancer',
  'Peritoneal Malignancy','Anal Cancer','IBD','Intestinal Failure','Pelvic Floor',
  'Proctology','Fistula','Emergency','Trauma','Abdominal Wall Reconstruction','Endoscopy','Anatomy',
  'Evidence-based Medicine','Pilonidal'
]
const ACCREDITATION_BODIES = ['ACPGBI','ESCP','RCS Eng','RCS Ed','RCS Ireland','RCPS Glasgow','Other']
const ON_CALL_OPTIONS = ['None','1 in 2','1 in 2-3','1 in 3-4','1 in 4-5','1 in 5-6','1 in 6-7','1 in 8','Other']

function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

/* ── Style tokens ─────────────────────────────────── */
const C = { navy: '#0F1F3D', navyFg: '#F5F8FC', gold: '#E5A718', primary: '#0078D4', bg: '#F1F1F3', fg: '#181820', card: '#FAFAFA', muted: '#D1D1D6', secondary: '#504F58', destructive: '#DB2424', border: '#D1D1D6', accentBg: '#E5F1FB', accentFg: '#0060AB', primaryBg: '#E5F1FB' }
const S = {
  input: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 14px', border: `1.5px solid ${C.muted}`, borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif', minHeight: 100, resize: 'vertical' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#999', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  section: { marginTop: 8, paddingTop: 18, borderTop: `1px solid #eee` } as React.CSSProperties,
  sectionTitle: { fontSize: 15, fontWeight: 700, color: C.fg, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
}

/* ── Mode toggle button ───────────────────────────── */
function ModeToggle({ mode, setMode, dbLabel, dbIcon: DbIcon, manualLabel }: { mode: 'db' | 'manual'; setMode: (m: 'db' | 'manual') => void; dbLabel: string; dbIcon: React.ElementType; manualLabel: string }) {
  const base = { padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s' } as React.CSSProperties
  return (
    <div style={{ display: 'flex', gap: 3, background: '#f3f3f5', borderRadius: 10, padding: 3 }}>
      <button type="button" style={{ ...base, background: mode === 'db' ? C.navy : 'transparent', color: mode === 'db' ? '#fff' : C.secondary }} onClick={() => setMode('db')}><DbIcon size={11} />{dbLabel}</button>
      <button type="button" style={{ ...base, background: mode === 'manual' ? C.navy : 'transparent', color: mode === 'manual' ? '#fff' : C.secondary }} onClick={() => setMode('manual')}><Edit size={11} />{manualLabel}</button>
    </div>
  )
}

/* ── Image uploader ───────────────────────────────── */
function ImageUploadBox({ value, onChange, folder, label }: { value: string; onChange: (url: string) => void; folder: string; label: string }) {
  const { upload, uploading, error } = useImageUpload()
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const url = await upload(f, folder); if (url) onChange(url); e.target.value = '' }
  return (
    <div>
      <label style={S.label}>{label}</label>
      {value ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.muted}` }}>
          <img src={value} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{ width: '100%', height: 120, border: `2px dashed ${C.muted}`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: C.secondary, background: '#fff', cursor: uploading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500 }}>
          {uploading ? <><Loader size={20} className="animate-spin" />Uploading...</> : <><ImageIcon size={22} strokeWidth={1.5} />Click to upload image<span style={{ fontSize: 11, color: '#999' }}>PNG, JPG up to 5MB</span></>}
        </button>
      )}
      {error && <p style={{ fontSize: 12, color: C.destructive, marginTop: 6 }}>{error}</p>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

/* ── Tag input (still used for plain text arrays like old manual entries) ─ */
function TagInput({ value, onChange, label, placeholder, hint, color = C.primary, bg: tagBg = C.primaryBg }: { value: string[]; onChange: (v: string[]) => void; label?: string; placeholder: string; hint?: string; color?: string; bg?: string }) {
  const [input, setInput] = useState('')
  const add = () => { const t = input.trim(); if (t && !value.includes(t)) { onChange([...value, t]); setInput('') } }
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map((h, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: tagBg, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 12, fontWeight: 600, color }}>
              {h}<button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...S.input, flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={placeholder} />
        <button type="button" onClick={add} style={{ padding: '10px 16px', border: `1.5px solid ${C.muted}`, borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.secondary, whiteSpace: 'nowrap' }}>Add</button>
      </div>
      {hint && <p style={S.hint}>{hint}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   FACULTY PICKER — search existing faculty DB or manual
   ═══════════════════════════════════════════════════════ */
type FacultyEntry = { id: string; name: string; title: string; hospital: string; fromDB: boolean }

function FacultyPicker({ value, onChange }: { value: FacultyEntry[]; onChange: (v: FacultyEntry[]) => void }) {
  const [mode, setMode] = useState<'db' | 'manual'>('db')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [manualInput, setManualInput] = useState('')

  // Live search faculty table
  useEffect(() => {
    if (mode !== 'db' || search.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('faculty').select('id, full_name, position_title, hospital, photo_url')
          .or(`full_name.ilike.%${search}%,hospital.ilike.%${search}%`)
          .limit(8)
        setResults(data || [])
        setShowDrop(true)
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(timer)
  }, [search, mode])

  const addFromDB = (f: any) => {
    if (value.some(v => v.id === f.id)) return
    onChange([...value, { id: f.id, name: f.full_name, title: f.position_title || '', hospital: f.hospital || '', fromDB: true }])
    setSearch(''); setShowDrop(false)
  }
  const addManual = () => {
    const t = manualInput.trim(); if (!t) return
    onChange([...value, { id: `manual_${Date.now()}`, name: t, title: '', hospital: '', fromDB: false }])
    setManualInput('')
  }
  const remove = (id: string) => onChange(value.filter(v => v.id !== id))

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ ...S.label, margin: 0 }}>Supervisor(s) / Lead Surgeon(s)</label>
        <ModeToggle mode={mode} setMode={setMode} dbLabel="Faculty DB" dbIcon={Users} manualLabel="Manual" />
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {value.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: s.fromDB ? 'rgba(15,31,61,.03)' : '#fafafa', border: `1px solid ${s.fromDB ? 'rgba(15,31,61,.12)' : '#eee'}`, borderRadius: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: s.fromDB ? C.navy : C.muted, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(s.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.name}
                  {s.fromDB && <span style={S.badge('rgba(15,31,61,.08)', C.navy)}>Faculty DB</span>}
                </div>
                {(s.title || s.hospital) && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{[s.title, s.hospital].filter(Boolean).join(' · ')}</div>}
              </div>
              <button type="button" onClick={() => remove(s.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 2 }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      {mode === 'db' ? (
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#aaa', zIndex: 1 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 200)}
            placeholder="Search faculty by name or hospital..." />
          {showDrop && results.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 20, maxHeight: 240, overflowY: 'auto' }}>
              {results.map(f => {
                const already = value.some(v => v.id === f.id)
                return (
                  <div key={f.id} onClick={() => !already && addFromDB(f)}
                    style={{ padding: '10px 14px', cursor: already ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid #f5f5f5`, opacity: already ? 0.4 : 1 }}
                    onMouseEnter={(e) => { if (!already) (e.currentTarget as HTMLDivElement).style.background = '#f8f9fa' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                    {f.photo_url
                      ? <img src={f.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials(f.full_name)}</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{f.full_name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{[f.position_title, f.hospital].filter(Boolean).join(' · ')}</div>
                    </div>
                    {already && <span style={{ fontSize: 10, color: '#aaa' }}>Added</span>}
                  </div>
                )
              })}
            </div>
          )}
          <p style={S.hint}>Search your existing faculty database · <span style={{ color: C.primary, cursor: 'pointer' }} onClick={() => setMode('manual')}>Not found? Add manually</span></p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...S.input, flex: 1 }} value={manualInput} onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
              placeholder="Type supervisor name, press Enter" />
            <button type="button" onClick={addManual} style={{ padding: '10px 16px', border: `1.5px solid ${C.muted}`, borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.secondary, whiteSpace: 'nowrap' }}>Add</button>
          </div>
          <p style={S.hint}>Manually added names won't be linked to faculty profiles</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   INSTITUTION PICKER — search institutions DB or manual
   ═══════════════════════════════════════════════════════ */
type InstitutionEntry = { id: string; name: string; address: string; city: string; fromDB: boolean }

function InstitutionPicker({ value, onChange }: { value: InstitutionEntry[]; onChange: (v: InstitutionEntry[]) => void }) {
  const [mode, setMode] = useState<'db' | 'manual'>('db')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [manualInput, setManualInput] = useState('')

  useEffect(() => {
    if (mode !== 'db' || search.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('institutions').select('id, name, address, city, country, type, logo_url')
          .or(`name.ilike.%${search}%,city.ilike.%${search}%`)
          .limit(8)
        setResults(data || [])
        setShowDrop(true)
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(timer)
  }, [search, mode])

  const addFromDB = (inst: any) => {
    if (value.some(v => v.id === inst.id)) return
    onChange([...value, { id: inst.id, name: inst.name, address: inst.address || '', city: inst.city || '', fromDB: true }])
    setSearch(''); setShowDrop(false)
  }
  const addManual = () => {
    const t = manualInput.trim(); if (!t) return
    onChange([...value, { id: `manual_${Date.now()}`, name: t, address: '', city: '', fromDB: false }])
    setManualInput('')
  }
  const remove = (id: string) => onChange(value.filter(v => v.id !== id))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ ...S.label, margin: 0 }}>Hospital(s) / Site(s)</label>
        <ModeToggle mode={mode} setMode={setMode} dbLabel="Institutions DB" dbIcon={Building2} manualLabel="Manual" />
      </div>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {value.map(h => (
            <span key={h.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: h.fromDB ? 'rgba(15,31,61,.04)' : '#fafafa', border: `1px solid ${h.fromDB ? 'rgba(15,31,61,.12)' : '#eee'}`, borderRadius: 10, fontSize: 13 }}>
              {h.fromDB && <Building2 size={13} color={C.navy} />}
              <span style={{ fontWeight: 600 }}>{h.name}</span>
              {h.city && <span style={{ color: '#999', fontSize: 11 }}>· {h.city}</span>}
              {h.fromDB && <span style={S.badge('rgba(15,31,61,.08)', C.navy)}>DB</span>}
              <button type="button" onClick={() => remove(h.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex' }}><X size={13} /></button>
            </span>
          ))}
        </div>
      )}

      {mode === 'db' ? (
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#aaa', zIndex: 1 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 200)}
            placeholder="Search institutions by name or city..." />
          {showDrop && results.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 20, maxHeight: 240, overflowY: 'auto' }}>
              {results.map(inst => {
                const already = value.some(v => v.id === inst.id)
                return (
                  <div key={inst.id} onClick={() => !already && addFromDB(inst)}
                    style={{ padding: '10px 14px', cursor: already ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid #f5f5f5`, opacity: already ? 0.4 : 1 }}
                    onMouseEnter={(e) => { if (!already) (e.currentTarget as HTMLDivElement).style.background = '#f8f9fa' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${C.border}` }}>
                      {inst.logo_url ? <img src={inst.logo_url} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <Building2 size={15} color={C.navy} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{inst.name}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{[inst.city, inst.country].filter(Boolean).join(', ')} · {inst.type}</div>
                    </div>
                    {already && <span style={{ fontSize: 10, color: '#aaa' }}>Added</span>}
                  </div>
                )
              })}
            </div>
          )}
          <p style={S.hint}>Search your institutions database · <span style={{ color: C.primary, cursor: 'pointer' }} onClick={() => setMode('manual')}>Not found? Add manually</span></p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...S.input, flex: 1 }} value={manualInput} onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
              placeholder="Type hospital name, press Enter" />
            <button type="button" onClick={addManual} style={{ padding: '10px 16px', border: `1.5px solid ${C.muted}`, borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.secondary, whiteSpace: 'nowrap' }}>Add</button>
          </div>
          <p style={S.hint}>Manually added sites won't be linked to the institutions database · <span style={{ color: C.primary, cursor: 'pointer' }} onClick={() => setMode('db')}>Search database instead</span></p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   ADDRESS GEOCODER — search address via Mapbox, auto-fill coords
   ═══════════════════════════════════════════════════════ */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

type GeoResult = { address: string; city: string; country: string; latitude: string; longitude: string }

function AddressGeocoder({ address, city, country, latitude, longitude, onChange }: {
  address: string; city: string; country: string; latitude: string; longitude: string;
  onChange: (loc: Partial<GeoResult>) => void
}) {
  const [query, setQuery] = useState(address || '')
  const [results, setResults] = useState<any[]>([])
  const [showDrop, setShowDrop] = useState(false)

  useEffect(() => {
    if (!MAPBOX_TOKEN || query.length < 3) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,place,locality&limit=5`)
        const data = await res.json()
        setResults(data.features || [])
        setShowDrop(true)
      } catch { setResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const selectResult = (feature: any) => {
    const [lng, lat] = feature.center
    const ctx = (feature.context || []) as any[]
    const placeCtx = ctx.find((c: any) => c.id?.startsWith('place'))
    const countryCtx = ctx.find((c: any) => c.id?.startsWith('country'))
    onChange({
      address: feature.place_name || '',
      city: placeCtx?.text || feature.text || '',
      country: countryCtx?.text || '',
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    })
    setQuery(feature.place_name || '')
    setShowDrop(false)
    setResults([])
  }

  return (
    <div>
      <div>
        <label style={S.label}>Address</label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#aaa', zIndex: 1 }} />
          <input style={{ ...S.input, paddingLeft: 32 }}
            value={query}
            onChange={(e) => { setQuery(e.target.value); onChange({ address: e.target.value }) }}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 200)}
            placeholder="Search for an address, hospital, or place..."
          />
          {showDrop && results.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 20, maxHeight: 240, overflowY: 'auto' }}>
              {results.map((r: any) => (
                <div key={r.id} onClick={() => selectResult(r)}
                  style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, borderBottom: '1px solid #f5f5f5', fontSize: 13 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f8f9fa' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                  <MapPin size={14} color="#999" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.text}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{r.place_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <p style={S.hint}>Type to search — city, country and map coordinates are filled automatically</p>
      </div>

      {/* City / Country (always editable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
        <div><label style={S.label}>City</label><input style={S.input} value={city} onChange={(e) => onChange({ city: e.target.value })} /></div>
        <div><label style={S.label}>Country</label><input style={S.input} value={country} onChange={(e) => onChange({ country: e.target.value })} /></div>
      </div>
    </div>
  )
}

/* ── Operative Volume table editor ────────────────── */
type OpRow = { procedure: string; volume: string }
function OperativeVolumeEditor({ rows, onChange }: { rows: OpRow[]; onChange: (r: OpRow[]) => void }) {
  const add = () => onChange([...rows, { procedure: '', volume: '' }])
  const upd = (i: number, field: keyof OpRow, val: string) => { const u = [...rows]; u[i] = { ...u[i], [field]: val }; onChange(u) }
  const del = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={S.sectionTitle}><Stethoscope size={16} /> Expected Operative Volume</div>
        <button type="button" onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 8, background: C.navy, fontSize: 12, fontWeight: 600, color: C.navyFg, cursor: 'pointer' }}><Plus size={13} /> Add Row</button>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 20, border: `2px dashed ${C.muted}`, borderRadius: 10, textAlign: 'center', color: '#999', fontSize: 13 }}>No operative volumes. Click Add Row to start.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 36px', gap: 8, padding: '0 2px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Procedure</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Volume / Year</span>
            <span></span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 36px', gap: 8, alignItems: 'center' }}>
              <input style={{ ...S.input, padding: '8px 10px', fontSize: 13 }} value={r.procedure} onChange={(e) => upd(i, 'procedure', e.target.value)} placeholder="e.g. Right Hemicolectomy" />
              <input style={{ ...S.input, padding: '8px 10px', fontSize: 13 }} value={r.volume} onChange={(e) => upd(i, 'volume', e.target.value)} placeholder="e.g. 50-80" />
              <button type="button" onClick={() => del(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', padding: 4 }}><X size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Testimonials editor ──────────────────────────── */
type Testimonial = { name: string; quote: string; year: string }
function TestimonialsEditor({ rows, onChange }: { rows: Testimonial[]; onChange: (r: Testimonial[]) => void }) {
  const add = () => onChange([...rows, { name: '', quote: '', year: '' }])
  const upd = (i: number, field: keyof Testimonial, val: string) => { const u = [...rows]; u[i] = { ...u[i], [field]: val }; onChange(u) }
  const del = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={S.sectionTitle}><MessageSquareQuote size={16} /> Testimonials</div>
        <button type="button" onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', borderRadius: 8, background: C.navy, fontSize: 12, fontWeight: 600, color: C.navyFg, cursor: 'pointer' }}><Plus size={13} /> Add</button>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 20, border: `2px dashed ${C.muted}`, borderRadius: 10, textAlign: 'center', color: '#999', fontSize: 13 }}>No testimonials yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ padding: 14, border: `1px solid #eee`, borderRadius: 12, background: '#fafafa', position: 'relative' }}>
              <button type="button" onClick={() => del(i)} style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#ccc' }}><X size={14} /></button>
              <textarea style={{ ...S.textarea, minHeight: 60, marginBottom: 8 }} value={r.quote} onChange={(e) => upd(i, 'quote', e.target.value)} placeholder="Their testimonial..." />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <input style={{ ...S.input, padding: '8px 10px', fontSize: 13 }} value={r.name} onChange={(e) => upd(i, 'name', e.target.value)} placeholder="Name & position" />
                <input style={{ ...S.input, padding: '8px 10px', fontSize: 13 }} value={r.year} onChange={(e) => upd(i, 'year', e.target.value)} placeholder="Year e.g. 2024" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ────────────────────────────────────── */
export default function FellowshipsAdmin() {
  const { data: fellowships, loading, create, update, remove } = useSupabaseTable<any>('fellowships', 'created_at', false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = {
    name: '', slug: '', city: '', country: 'United Kingdom', address: '',
    duration: '12 months', status: 'draft', is_active: true,
    // NEW: structured arrays for DB-linked entries
    hospital_entries: [] as InstitutionEntry[],
    supervisor_entries: [] as FacultyEntry[],
    accreditation: [] as string[], subspecialties: [] as string[],
    description_text: '', learning_outcomes: '',
    latitude: '', longitude: '',
    featured_image_url: '',
    salary_per_annum: '',
    accommodation_available: false, accommodation_notes: '',
    prerequisites: '', application_process: '',
    on_call_weekday: 'None', on_call_weekend_day: 'None',
    on_call_weekday_nights: 'None', on_call_weekend_nights: 'None',
    testimonials: [] as Testimonial[],
    operative_volume: [] as OpRow[],
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (f: any) => {
    const oc = f.on_call || {}
    // Convert legacy string[] hospitals/supervisors to structured entries
    const hospitalEntries: InstitutionEntry[] = Array.isArray(f.hospitals)
      ? f.hospitals.map((h: string, i: number) => ({ id: `legacy_${i}`, name: h, address: '', city: '', fromDB: false }))
      : []
    const supervisorEntries: FacultyEntry[] = Array.isArray(f.supervisors)
      ? f.supervisors.map((s: string, i: number) => ({ id: `legacy_${i}`, name: s, title: '', hospital: '', fromDB: false }))
      : []

    setForm({
      name: f.name || '', slug: f.slug || '', city: f.city || '',
      country: f.country || 'United Kingdom', address: f.address || '',
      duration: f.duration || '12 months', status: f.status || 'draft',
      is_active: f.is_active ?? true,
      hospital_entries: hospitalEntries,
      supervisor_entries: supervisorEntries,
      accreditation: Array.isArray(f.accreditation) ? f.accreditation : [],
      subspecialties: Array.isArray(f.subspecialties) ? f.subspecialties : [],
      description_text: typeof f.description === 'object' && f.description?.text ? f.description.text : (typeof f.description === 'string' ? f.description : ''),
      learning_outcomes: f.learning_outcomes || '',
      latitude: f.latitude?.toString() || '', longitude: f.longitude?.toString() || '',
      featured_image_url: f.featured_image_url || '',
      salary_per_annum: f.salary_per_annum?.toString() || '',
      accommodation_available: f.accommodation_available ?? false,
      accommodation_notes: f.accommodation_notes || '',
      prerequisites: f.prerequisites || '',
      application_process: f.application_process || '',
      on_call_weekday: oc.weekday || 'None', on_call_weekend_day: oc.weekend_day || 'None',
      on_call_weekday_nights: oc.weekday_nights || 'None', on_call_weekend_nights: oc.weekend_nights || 'None',
      testimonials: Array.isArray(f.testimonials) ? f.testimonials : [],
      operative_volume: Array.isArray(f.operative_volume) ? f.operative_volume : [],
    })
    setEditing(f.id)
  }

  const handleSave = async () => {
    if (!form.name) { showToast('Name is required', 'error'); return }
    setSaving(true)
    try {
      const supabase = createClient()

      // Flatten structured entries back to string arrays for the fellowships table
      // (keeps backward compatibility; junction tables store the DB links)
      const hospitalNames = form.hospital_entries.map(h => h.name)
      const supervisorNames = form.supervisor_entries.map(s => s.name)

      const payload: any = {
        name: form.name, slug: form.slug || slugify(form.name),
        city: form.city || null, country: form.country, address: form.address || null,
        duration: form.duration, status: form.status, is_active: form.is_active,
        hospitals: hospitalNames, supervisors: supervisorNames,
        accreditation: form.accreditation, subspecialties: form.subspecialties,
        description: form.description_text ? { text: form.description_text } : null,
        learning_outcomes: form.learning_outcomes || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        featured_image_url: form.featured_image_url || null,
        salary_per_annum: form.salary_per_annum ? parseInt(form.salary_per_annum) : null,
        accommodation_available: form.accommodation_available,
        accommodation_notes: form.accommodation_notes || null,
        prerequisites: form.prerequisites || null,
        application_process: form.application_process || null,
        on_call: { weekday: form.on_call_weekday, weekend_day: form.on_call_weekend_day, weekday_nights: form.on_call_weekday_nights, weekend_nights: form.on_call_weekend_nights },
        testimonials: form.testimonials.length > 0 ? form.testimonials : [],
        operative_volume: form.operative_volume.length > 0 ? form.operative_volume : [],
      }

      let fellowshipId: string
      if (editing === 'new') {
        const result = await create(payload)
        fellowshipId = result?.id || ''
        showToast('Fellowship created')
      } else {
        await update(editing!, payload)
        fellowshipId = editing!
        showToast('Fellowship updated')
      }

      // Sync junction tables for DB-linked entries
      if (fellowshipId) {
        // Fellowship ↔ Institution
        const dbInstitutions = form.hospital_entries.filter(h => h.fromDB)
        if (dbInstitutions.length > 0) {
          await supabase.from('fellowship_institutions').delete().eq('fellowship_id', fellowshipId)
          await supabase.from('fellowship_institutions').insert(
            dbInstitutions.map((h, i) => ({ fellowship_id: fellowshipId, institution_id: h.id, is_primary: i === 0 }))
          )
        }

        // Fellowship ↔ Faculty
        const dbFaculty = form.supervisor_entries.filter(s => s.fromDB)
        if (dbFaculty.length > 0) {
          await supabase.from('fellowship_faculty').delete().eq('fellowship_id', fellowshipId)
          await supabase.from('fellowship_faculty').insert(
            dbFaculty.map(s => ({ fellowship_id: fellowshipId, faculty_id: s.id, role: 'Supervisor' }))
          )
        }
      }

      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fellowship?')) return
    setDeleting(id)
    try { await remove(id); showToast('Fellowship deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const filtered = fellowships.filter((f: any) => !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.city?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : C.destructive }}>{toast.msg}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 700, color: C.navy }}>Fellowships</h1>
          <p style={{ fontSize: 14, color: C.secondary, marginTop: 4 }}>{fellowships.length} fellowships in database</p>
        </div>
        <button onClick={openNew} className="hidden sm:flex items-center gap-2" style={{ padding: '10px 20px', background: C.navy, color: C.navyFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}><Plus size={16} strokeWidth={2.5} /> Add Fellowship</button>
      </div>

      {/* Mobile FAB */}
      <button onClick={openNew} className="sm:hidden fixed bottom-[4.5rem] right-4 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform" style={{ background: C.navy, color: C.navyFg }}>
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <input style={{ ...S.input, maxWidth: 400, marginBottom: 24 }} placeholder="Search fellowships..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color={C.muted} /></div>
      : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, padding: '80px 20px', textAlign: 'center' }}>
          <Globe size={40} color={C.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: C.fg }}>No fellowships found</p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ borderBottom: `2px solid ${C.bg}` }}>
              {['Fellowship', 'Location', 'Duration', 'Supervisors', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((f: any) => (
                <tr key={f.id} style={{ borderBottom: `1px solid ${C.bg}` }}>
                  <td style={{ padding: '14px 16px', maxWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {f.featured_image_url && <img src={f.featured_image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
                      <div>
                        <div style={{ fontWeight: 600, color: C.fg }}>{f.name}</div>
                        {f.hospitals?.length > 0 && <div style={{ fontSize: 12, color: C.secondary, marginTop: 1 }}>{f.hospitals.join(', ')}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: C.secondary }}>{[f.city, f.country].filter(Boolean).join(', ') || '—'}</td>
                  <td style={{ padding: '14px 16px' }}><span style={S.badge(C.primaryBg, C.primary)}>{f.duration}</span></td>
                  <td style={{ padding: '14px 16px', color: C.secondary, fontSize: 12 }}>{f.supervisors?.length > 0 ? f.supervisors.join(', ') : '—'}</td>
                  <td style={{ padding: '14px 16px' }}><span style={S.badge(f.status === 'published' ? '#f0fdf4' : '#fefce8', f.status === 'published' ? '#16a34a' : '#a16207')}>{f.status}</span></td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button onClick={() => openEdit(f)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.secondary }}><Edit size={16} /></button>
                      <button onClick={() => handleDelete(f.id)} disabled={deleting === f.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}>{deleting === f.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3">
          {filtered.map((f: any) => (
            <div key={f.id} className="bg-white rounded-xl border border-[#E4E4E8] p-3.5 active:bg-gray-50">
              <div className="flex items-start gap-3">
                {f.featured_image_url && (
                  <img src={f.featured_image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: C.fg }}>{f.name}</p>
                  {f.hospitals?.length > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: C.secondary }}>{f.hospitals.join(', ')}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: '#999' }}>
                    <MapPin size={10} className="shrink-0" />
                    <span>{[f.city, f.country].filter(Boolean).join(', ') || '—'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[#F1F1F3]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span style={S.badge(f.status === 'published' ? '#f0fdf4' : '#fefce8', f.status === 'published' ? '#16a34a' : '#a16207')}>{f.status}</span>
                  <span style={S.badge(C.primaryBg, C.primary)}>{f.duration}</span>
                  {f.supervisors?.length > 0 && (
                    <span className="text-[10px]" style={{ color: C.secondary }}>{f.supervisors[0]}{f.supervisors.length > 1 ? ` +${f.supervisors.length - 1}` : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(f)} className="p-2 rounded-lg bg-[#F3F4F6]" style={{ color: C.primary }}>
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(f.id)} disabled={deleting === f.id} className="p-2 rounded-lg bg-white border border-[#E4E4E8]" style={{ color: C.destructive }}>
                    {deleting === f.id ? <Loader className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12 text-sm" style={{ color: '#999' }}>
              {search ? 'No fellowships match your search.' : 'No fellowships yet. Tap + to get started.'}
            </div>
          )}
        </div>
        </>
      )}

      {/* ── Modal ──────────────────────────────────── */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, paddingBottom: 16, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>

            <div className="flex justify-between items-center p-4 sm:px-7 sm:py-5 border-b border-[#eee] sticky top-0 bg-white rounded-t-[20px] z-10">
              <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 22, fontWeight: 700, color: C.navy }}>{editing === 'new' ? 'Add Fellowship' : 'Edit Fellowship'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}><X size={20} /></button>
            </div>

            <div className="p-4 sm:px-7 sm:py-6" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>

              <ImageUploadBox value={form.featured_image_url} onChange={(url) => setForm({ ...form, featured_image_url: url })} folder="fellowships" label="Promotional Image" />
              <div><label style={S.label}>Fellowship Name *</label><input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. St Mark's Hospital Colorectal Fellowship" /></div>
              <div><label style={S.label}>Slug</label><input style={{ ...S.input, fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>

              {/* ═══ NEW: Institution picker ═══ */}
              <InstitutionPicker value={form.hospital_entries} onChange={(v) => setForm({ ...form, hospital_entries: v })} />

              {/* ═══ NEW: Faculty picker ═══ */}
              <FacultyPicker value={form.supervisor_entries} onChange={(v) => setForm({ ...form, supervisor_entries: v })} />

              <div><label style={S.label}>Description / Overview</label><textarea style={S.textarea} value={form.description_text} onChange={(e) => setForm({ ...form, description_text: e.target.value })} placeholder="Overview of the fellowship, what it offers..." /></div>
              <div><label style={S.label}>Intended Learning Outcomes</label><textarea style={{ ...S.textarea, minHeight: 80 }} value={form.learning_outcomes} onChange={(e) => setForm({ ...form, learning_outcomes: e.target.value })} placeholder="What trainees will learn and achieve..." /></div>

              {/* Accreditation */}
              <div>
                <label style={S.label}>Accreditation</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ACCREDITATION_BODIES.map(a => {
                    const sel = form.accreditation.includes(a)
                    return <button key={a} type="button" onClick={() => { const v = sel ? form.accreditation.filter(x => x !== a) : [...form.accreditation, a]; setForm({ ...form, accreditation: v }) }}
                      style={{ padding: '5px 14px', borderRadius: 20, border: sel ? '1.5px solid #92400E' : `1.5px solid ${C.muted}`, background: sel ? '#FEF3C7' : '#fff', color: sel ? '#92400E' : C.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{a}</button>
                  })}
                </div>
              </div>

              {/* Location — Geocoder address search */}
              <div style={S.section}>
                <div style={S.sectionTitle}><MapPin size={16} /> Location</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <AddressGeocoder
                    address={form.address}
                    city={form.city}
                    country={form.country}
                    latitude={form.latitude}
                    longitude={form.longitude}
                    onChange={(loc) => setForm({ ...form, ...loc })}
                  />
                </div>
              </div>

              {/* Details */}
              <div style={S.section}>
                <div style={S.sectionTitle}><Clock size={16} /> Details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div><label style={S.label}>Duration</label><select style={S.select} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>{DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
                    <div><label style={S.label}>Status</label><select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div><label style={S.label}>Salary (£/year)</label><input style={S.input} type="number" value={form.salary_per_annum} onChange={(e) => setForm({ ...form, salary_per_annum: e.target.value })} placeholder="e.g. 55000" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: C.fg, cursor: 'pointer' }}><input type="checkbox" checked={form.accommodation_available} onChange={(e) => setForm({ ...form, accommodation_available: e.target.checked })} style={{ width: 18, height: 18 }} />Accommodation Available</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: C.fg, cursor: 'pointer' }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} style={{ width: 18, height: 18 }} />Active listing</label>
                  </div>
                  {form.accommodation_available && (
                    <div><label style={S.label}>Accommodation Notes</label><input style={S.input} value={form.accommodation_notes} onChange={(e) => setForm({ ...form, accommodation_notes: e.target.value })} placeholder="Details about accommodation provided" /></div>
                  )}
                </div>
              </div>

              {/* Subspecialties */}
              <div style={S.section}>
                <label style={S.label}>Subspecialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUBSPECIALTIES.map(s => {
                    const sel = form.subspecialties.includes(s)
                    return <button key={s} type="button" onClick={() => { const v = sel ? form.subspecialties.filter(x => x !== s) : [...form.subspecialties, s]; setForm({ ...form, subspecialties: v }) }}
                      style={{ padding: '4px 12px', borderRadius: 20, border: sel ? `1.5px solid ${C.primary}` : `1.5px solid ${C.muted}`, background: sel ? C.primaryBg : '#fff', color: sel ? C.primary : C.secondary, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{s}</button>
                  })}
                </div>
              </div>

              {/* On Call */}
              <div style={S.section}>
                <div style={S.sectionTitle}><Clock size={16} /> On-Call Commitment</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div><label style={S.label}>Weekday On-Call</label><select style={S.select} value={form.on_call_weekday} onChange={(e) => setForm({ ...form, on_call_weekday: e.target.value })}>{ON_CALL_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div><label style={S.label}>Weekend Day</label><select style={S.select} value={form.on_call_weekend_day} onChange={(e) => setForm({ ...form, on_call_weekend_day: e.target.value })}>{ON_CALL_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div><label style={S.label}>Weekday Nights</label><select style={S.select} value={form.on_call_weekday_nights} onChange={(e) => setForm({ ...form, on_call_weekday_nights: e.target.value })}>{ON_CALL_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
                  <div><label style={S.label}>Weekend Nights</label><select style={S.select} value={form.on_call_weekend_nights} onChange={(e) => setForm({ ...form, on_call_weekend_nights: e.target.value })}>{ON_CALL_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
                </div>
              </div>

              {/* Application */}
              <div style={S.section}>
                <div><label style={S.label}>Prerequisites / Personal Specification</label><textarea style={S.textarea} value={form.prerequisites} onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} placeholder="Required qualifications, experience, skills..." /></div>
              </div>
              <div><label style={S.label}>Application Process</label><textarea style={S.textarea} value={form.application_process} onChange={(e) => setForm({ ...form, application_process: e.target.value })} placeholder="How to apply, deadlines, documents required..." /></div>

              <div style={S.section}><OperativeVolumeEditor rows={form.operative_volume} onChange={(v) => setForm({ ...form, operative_volume: v })} /></div>
              <div style={S.section}><TestimonialsEditor rows={form.testimonials} onChange={(v) => setForm({ ...form, testimonials: v })} /></div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 sm:px-7 sm:py-5 border-t border-[#eee] bg-[#fafafa] rounded-b-[20px] sticky bottom-0">
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: C.secondary, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: C.navy, color: C.navyFg, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Create Fellowship' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}