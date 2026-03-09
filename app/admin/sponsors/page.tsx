'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Building2, Plus, Edit, Trash2, Save, Loader, X, Upload, ImageIcon } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'

const TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Partner']

export default function SponsorsAdmin() {
  const { data: sponsors, loading, create, update, remove } = useSupabaseTable<any>('sponsors', 'sort_order', true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = { name: '', tier: 'Partner' as string, website_url: '', description: '', sort_order: 0, is_active: true, logo_url: '' }
  const [form, setForm] = useState(emptyForm)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const openNew = () => { setForm(emptyForm); setLogoPreview(null); setEditing('new') }
  const openEdit = (s: any) => {
    setForm({
      name: s.name || '',
      tier: s.tier || 'Partner',
      website_url: s.website_url || '',
      description: s.description || '',
      sort_order: s.sort_order || 0,
      is_active: s.is_active ?? true,
      logo_url: s.logo_url || '',
    })
    setLogoPreview(s.logo_url || null)
    setEditing(s.id)
  }

  const uploadLogo = async (file: File): Promise<string> => {
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const filePath = `logos/${fileName}`

    const { error } = await supabase.storage
      .from('sponsor-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('sponsor-logos')
      .getPublicUrl(filePath)

    return publicUrl
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo must be under 2MB', 'error')
      return
    }

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to storage
    setUploading(true)
    try {
      const publicUrl = await uploadLogo(file)
      setForm(prev => ({ ...prev, logo_url: publicUrl }))
      showToast('Logo uploaded')
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error')
      setLogoPreview(form.logo_url || null)
    }
    setUploading(false)

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeLogo = () => {
    setForm(prev => ({ ...prev, logo_url: '' }))
    setLogoPreview(null)
  }

  const handleSave = async () => {
    if (!form.name) { showToast('Name is required', 'error'); return }
    setSaving(true)
    try {
      if (editing === 'new') { await create(form); showToast('Sponsor added') }
      else { await update(editing!, form); showToast('Sponsor updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this sponsor?')) return
    setDeleting(id)
    try { await remove(id); showToast('Sponsor removed') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const tierColor = (t: string) => ({
    Platinum: 'bg-slate-100 text-slate-700',
    Gold: 'bg-amber-50 text-amber-700',
    Silver: 'bg-gray-100 text-gray-600',
    Bronze: 'bg-orange-50 text-orange-700',
    Partner: 'bg-green-50 text-green-700',
  }[t] || 'bg-gray-100 text-gray-600')

  return (
    <div>
      {toast && <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.msg}</div>}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold text-slate-800">Sponsors</h1><p className="text-sm text-gray-500 mt-1">{sponsors.length} sponsors</p></div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"><Plus size={16} /> Add Sponsor</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader className="animate-spin text-gray-400" size={28} /></div>
      : sponsors.length === 0 ? <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400"><Building2 size={36} className="mx-auto mb-3 opacity-40" /><p>No sponsors yet</p></div>
      : <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Logo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tier</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Website</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>{sponsors.map((s: any) => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  {s.logo_url ? (
                    <div className="w-10 h-10 rounded-lg border border-gray-100 overflow-hidden bg-white flex items-center justify-center">
                      <img src={s.logo_url} alt={s.name} className="w-full h-full object-contain p-1" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                      <ImageIcon size={16} className="text-gray-300" />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierColor(s.tier)}`}>{s.tier}</span></td>
                <td className="px-4 py-3 text-xs">{s.website_url ? <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.website_url.replace(/https?:\/\//, '')}</a> : '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit size={15} /></button>
                  <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">{deleting === s.id ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      }

      {editing !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-serif font-bold">{editing === 'new' ? 'Add Sponsor' : 'Edit Sponsor'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Logo Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Company Logo</label>
                <div className="flex items-start gap-4">
                  {/* Preview */}
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {uploading ? (
                      <Loader className="animate-spin text-gray-400" size={24} />
                    ) : logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon size={28} className="text-gray-300" />
                    )}
                  </div>
                  {/* Upload controls */}
                  <div className="flex flex-col gap-2 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Upload size={14} />
                      {logoPreview ? 'Replace Logo' : 'Upload Logo'}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                    <p className="text-xs text-gray-400">PNG, JPG, SVG or WebP. Max 2MB.</p>
                  </div>
                </div>
              </div>

              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Company Name *</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Tier</label><select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Website URL</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://..." /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Description</label><textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Sort Order</label><input type="number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />Active</label></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={handleSave} disabled={saving || uploading} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">{saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />} {editing === 'new' ? 'Add' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}