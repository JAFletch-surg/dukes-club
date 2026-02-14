'use client'

import { useState, useRef } from 'react'
import { UserCheck, Plus, Edit, Trash2, Save, Loader, X, ImageIcon } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { useImageUpload } from '@/lib/use-image-upload'

const EXEC_ROLES = ['President','Vice-President','Past-President','Secretary','Treasurer','Web Master','IBD Lead','Abdominal Wall / Intestinal Failure Lead','Pelvic Floor Lead','Proctology Lead','Endoscopy Lead','ASiT Representative','Research Lead','Advanced Cancer Lead','Training and Education Lead','Communications Officer','Events Coordinator','Regional Representative']
const UK_REGIONS = ['Mersey','Wessex','North East Thames','North West','Yorkshire','South West','South Wales','Scotland','Republic of Ireland','East Anglia','SE Thames','Oxford','Northern','North West Thames','West Midlands','North Wales','East Midlands','Northern Ireland']

function PhotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { upload, uploading, error } = useImageUpload()
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await upload(file, 'team')
    if (url) onChange(url)
    e.target.value = ''
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">Photo</label>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 text-sm hover:border-gray-400 cursor-pointer">
          {uploading ? <><Loader size={18} className="animate-spin" />Uploading...</> : <><ImageIcon size={20} />Upload photo</>}
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function TeamAdmin() {
  const { data: team, loading, create, update, remove } = useSupabaseTable<any>('executive_committee', 'sort_order', true)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = { full_name: '', role: 'Regional Representative' as string, region: 'Mersey' as string, statement: '', email: '', sort_order: 0, is_active: true, photo_url: '', social_media_tag: '', social_media_url: '' }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (m: any) => {
    setForm({ full_name: m.full_name || '', role: m.role || 'Regional Representative', region: m.region || 'Mersey', statement: m.statement || '', email: m.email || '', sort_order: m.sort_order || 0, is_active: m.is_active ?? true, photo_url: m.photo_url || '', social_media_tag: m.social_media_tag || '', social_media_url: m.social_media_url || '' })
    setEditing(m.id)
  }

  const handleSave = async () => {
    if (!form.full_name) { showToast('Name is required', 'error'); return }
    setSaving(true)
    try {
      if (editing === 'new') { await create(form); showToast('Member added') }
      else { await update(editing!, form); showToast('Member updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this team member?')) return
    setDeleting(id)
    try { await remove(id); showToast('Member removed') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div>
      {toast && <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.msg}</div>}
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold text-slate-800">Executive Team</h1><p className="text-sm text-gray-500 mt-1">{team.length} members</p></div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"><Plus size={16} /> Add Member</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader className="animate-spin text-gray-400" size={28} /></div>
      : team.length === 0 ? <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400"><UserCheck size={36} className="mx-auto mb-3 opacity-40" /><p>No team members yet</p></div>
      : <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Region</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>{team.map((m: any) => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  {m.photo_url
                    ? <img src={m.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    : <div className="w-8 h-8 bg-slate-700 text-white rounded-full flex items-center justify-center text-xs font-bold">{initials(m.full_name || '?')}</div>
                  }
                  <span className="font-medium">{m.full_name}</span>
                </div></td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">{m.role}</span></td>
                <td className="px-4 py-3 text-gray-500">{m.region || '—'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-gray-500">{m.sort_order}</td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit size={15} /></button>
                  <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">{deleting === m.id ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}</button>
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
              <h2 className="text-lg font-serif font-bold">{editing === 'new' ? 'Add Team Member' : 'Edit Team Member'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <PhotoUpload value={form.photo_url} onChange={(url) => setForm({ ...form, photo_url: url })} />
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Role</label><select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{EXEC_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Region</label><select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{UK_REGIONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Email</label><input type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-gray-700 mb-1">Social Media Handle</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.social_media_tag} onChange={(e) => setForm({ ...form, social_media_tag: e.target.value })} placeholder="@username" /></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">Social Media URL</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.social_media_url} onChange={(e) => setForm({ ...form, social_media_url: e.target.value })} placeholder="https://twitter.com/..." /></div></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Statement / Bio</label><textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} /></div>
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
