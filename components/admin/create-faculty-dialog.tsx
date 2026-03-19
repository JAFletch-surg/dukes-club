'use client'

import { useState, useRef } from 'react'
import { X, Camera, Upload, Loader, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface FacultyMember {
  id: string
  full_name: string
  position_title: string | null
  hospital: string | null
  photo_url: string | null
}

interface CreateFacultyDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (faculty: FacultyMember) => void
  initialName?: string
}

export function CreateFacultyDialog({ open, onClose, onCreated, initialName = '' }: CreateFacultyDialogProps) {
  const [form, setForm] = useState({
    full_name: initialName, position_title: '', hospital: '', email: '', bio: '', photo_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset form when dialog opens with new initialName
  const prevOpenRef = useRef(open)
  if (open && !prevOpenRef.current) {
    setForm({ full_name: initialName, position_title: '', hospital: '', email: '', bio: '', photo_url: '' })
    setError('')
  }
  prevOpenRef.current = open

  if (!open) return null

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `faculty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(`faculty-photos/${fileName}`, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(`faculty-photos/${fileName}`)
      setForm(prev => ({ ...prev, photo_url: urlData.publicUrl }))
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: insertErr } = await supabase
        .from('faculty')
        .insert({
          full_name: form.full_name.trim(),
          position_title: form.position_title || null,
          hospital: form.hospital || null,
          email: form.email || null,
          bio: form.bio || null,
          photo_url: form.photo_url || null,
          is_active: true,
          sort_order: 0,
        })
        .select('id, full_name, position_title, hospital, photo_url')
        .single()
      if (insertErr) throw insertErr
      onCreated(data as FacultyMember)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create faculty member')
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f3f5' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Montserrat, sans-serif' }}>Add New Faculty Member</h2>
          <button onClick={onClose} style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>{error}</div>}

          {/* Photo Upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {form.photo_url ? (
              <img src={form.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E4E4E8' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={20} color="#999" />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(file); e.target.value = '' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '2px dashed #D1D1D6', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#666', background: 'none', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                {uploading ? <><Loader size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> {form.photo_url ? 'Change Photo' : 'Upload Photo'}</>}
              </button>
              {form.photo_url && (
                <button type="button" onClick={() => setForm({ ...form, photo_url: '' })} style={{ fontSize: 12, color: '#DC2626', fontWeight: 600, marginTop: 4, border: 'none', background: 'none', cursor: 'pointer' }}>Remove photo</button>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Full Name *</label>
            <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D1D6', borderRadius: 8, fontSize: 14, outline: 'none' }}
              value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Position / Title</label>
              <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D1D6', borderRadius: 8, fontSize: 14, outline: 'none' }}
                value={form.position_title} onChange={(e) => setForm({ ...form, position_title: e.target.value })} placeholder="e.g. Consultant Surgeon" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Hospital</label>
              <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D1D6', borderRadius: 8, fontSize: 14, outline: 'none' }}
                value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} placeholder="e.g. St Mark's Hospital" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Email</label>
            <input type="email" style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D1D6', borderRadius: 8, fontSize: 14, outline: 'none' }}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#504F58', marginBottom: 4 }}>Bio</label>
            <textarea style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D1D6', borderRadius: 8, fontSize: 14, outline: 'none', minHeight: 80, resize: 'vertical' }}
              value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Short biography..." />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid #f3f3f5', background: '#FAFAFA', borderRadius: '0 0 16px 16px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 14, fontWeight: 500, color: '#666', border: 'none', background: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1E293B', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Add Faculty
          </button>
        </div>
      </div>
    </div>
  )
}
