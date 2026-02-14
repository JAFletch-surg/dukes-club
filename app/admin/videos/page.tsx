'use client'

import { useState } from 'react'
import { Video, Plus, Edit, Trash2, Save, Loader, X } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'

const STATUSES = ['draft', 'published', 'archived']
function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

export default function VideosAdmin() {
  const { data: videos, loading, create, update, remove } = useSupabaseTable<any>('videos', 'created_at', false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const emptyForm = { title: '', slug: '', description: '', vimeo_id: '', duration_seconds: 0, is_members_only: true, status: 'draft' }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (v: any) => {
    setForm({ title: v.title || '', slug: v.slug || '', description: v.description || '', vimeo_id: v.vimeo_id || '', duration_seconds: v.duration_seconds || 0, is_members_only: v.is_members_only ?? true, status: v.status || 'draft' })
    setEditing(v.id)
  }

  const handleSave = async () => {
    if (!form.title) { showToast('Title is required', 'error'); return }
    setSaving(true)
    try {
      const payload: any = { ...form, slug: form.slug || slugify(form.title), published_at: form.status === 'published' ? new Date().toISOString() : null }
      if (editing === 'new') { await create(payload); showToast('Video added') }
      else { await update(editing!, payload); showToast('Video updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return
    setDeleting(id)
    try { await remove(id); showToast('Video deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const fmtDur = (s: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '—'

  return (
    <div>
      {toast && <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.msg}</div>}

      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold text-slate-800">Videos</h1><p className="text-sm text-gray-500 mt-1">{videos.length} videos</p></div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"><Plus size={16} /> Add Video</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader className="animate-spin text-gray-400" size={28} /></div>
      : videos.length === 0 ? <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400"><Video size={36} className="mx-auto mb-3 opacity-40" /><p>No videos yet</p></div>
      : <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vimeo ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Access</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>{videos.map((v: any) => (
              <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium max-w-[250px] truncate">{v.title}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{v.vimeo_id || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDur(v.duration_seconds)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.is_members_only ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{v.is_members_only ? 'Members' : 'Public'}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{v.status}</span></td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => openEdit(v)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Edit size={15} /></button>
                  <button onClick={() => handleDelete(v.id)} disabled={deleting === v.id} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">{deleting === v.id ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}</button>
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
              <h2 className="text-lg font-serif font-bold">{editing === 'new' ? 'Add Video' : 'Edit Video'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugify(e.target.value) })} /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Vimeo ID</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.vimeo_id} onChange={(e) => setForm({ ...form, vimeo_id: e.target.value })} placeholder="e.g. 123456789" /></div>
              <div><label className="block text-xs font-semibold text-gray-700 mb-1">Description</label><textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Duration (sec)</label><input type="number" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} /></div>
                <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status</label><select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="flex items-end pb-1"><label className="flex items-center gap-2 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.is_members_only} onChange={(e) => setForm({ ...form, is_members_only: e.target.checked })} className="rounded" />Members Only</label></div>
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