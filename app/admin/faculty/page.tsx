'use client'

import { useState } from 'react'
import { GraduationCap, Plus, Edit, Trash2, Save, Loader, X, Camera } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'

export default function FacultyAdmin() {
  const { data: faculty, loading, create, update, remove } = useSupabaseTable<any>('faculty', 'sort_order', true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = { full_name: '', position_title: '', hospital: '', bio: '', email: '', photo_url: '', sort_order: 0, is_active: true }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (f: any) => {
    setForm({
      full_name: f.full_name || '', position_title: f.position_title || '',
      hospital: f.hospital || '', bio: f.bio || '', email: f.email || '',
      photo_url: f.photo_url || '',
      sort_order: f.sort_order || 0, is_active: f.is_active ?? true,
    })
    setEditing(f.id)
  }

  const handleSave = async () => {
    if (!form.full_name) { showToast('Name is required', 'error'); return }
    setSaving(true)
    try {
      const payload = { ...form, photo_url: form.photo_url || null }
      if (editing === 'new') { await create(payload); showToast('Faculty added') }
      else { await update(editing!, payload); showToast('Faculty updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this faculty member?')) return
    setDeleting(id)
    try { await remove(id); showToast('Faculty removed') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div>
      {toast && <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.msg}</div>}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold text-slate-800">Faculty</h1><p className="text-sm text-gray-500 mt-1">{faculty.length} faculty members</p></div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"><Plus size={16} /> Add Faculty</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader className="animate-spin text-gray-400" size={28} /></div>
      : faculty.length === 0 ? <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400"><GraduationCap size={36} className="mx-auto mb-3 opacity-40" /><p>No faculty yet</p></div>
      : <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Position</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hospital</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>{faculty.map((f: any) => (
              <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {f.photo_url ? (
                      <img src={f.photo_url} alt={f.full_name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center text-xs font-bold">{initials(f.full_name || '?')}</div>
                    )}
                    <span className="font-medium">{f.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{f.position_title || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{f.hospital || '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{f.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(f)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit size={15} /></button>
                  <button onClick={() => handleDelete(f.id)} disabled={deleting === f.id} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">{deleting === f.id ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}</button>
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
              <h2 className="text-lg font-serif font-bold">{editing === 'new' ? 'Add Faculty' : 'Edit Faculty'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Photo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Headshot Photo</label>
                <div className="flex items-center gap-4">
                  {form.photo_url ? (
                    <img src={form.photo_url} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                      <Camera size={20} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={form.photo_url}
                      onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                      placeholder="https://... paste image URL"
                    />
                    <p className="text-xs text-gray-400 mt-1">Paste a URL to a headshot photo. Square images work best.</p>
                    {form.photo_url && (
                      <button onClick={() => setForm({ ...form, photo_url: '' })} className="text-xs text-red-500 font-medium mt-1 hover:text-red-700">Remove photo</button>
                    )}
                  </div>
                </div>
              </div>

              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Position / Title</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.position_title} onChange={(e) => setForm({ ...form, position_title: e.target.value })} placeholder="e.g. Consultant Surgeon" /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Hospital</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} placeholder="e.g. St Mark's Hospital" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Email</label><input type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Bio</label><textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Short biography..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Sort Order</label><input type="number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />Active</label></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50">{saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />} {editing === 'new' ? 'Add' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}