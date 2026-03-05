'use client'

import { useState } from 'react'
import { Users, Loader, UserCheck, UserX, Search, Edit, X, Save, Shield, ChevronDown } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'
import { sendEmail } from '@/lib/emails/send-email'

const ROLES = ['pending', 'trainee', 'member', 'editor', 'admin', 'super_admin'] as const
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-50 text-red-700 border-red-200',
  admin: 'bg-amber-50 text-amber-700 border-amber-200',
  editor: 'bg-purple-50 text-purple-700 border-purple-200',
  member: 'bg-green-50 text-green-700 border-green-200',
  trainee: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-gray-100 text-gray-500 border-gray-200',
}

const APPROVAL_COLORS: Record<string, string> = {
  approved: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
}

export default function MembersAdmin() {
  const { data: members, loading, refetch } = useSupabaseTable<any>('profiles', 'created_at', false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ role: string; approval_status: string }>({ role: '', approval_status: '' })
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  const showToast = (msg: string, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = members.filter((m: any) => {
    if (filter === 'pending' && m.approval_status !== 'pending') return false
    if (filter === 'approved' && m.approval_status !== 'approved') return false
    if (filter === 'rejected' && m.approval_status !== 'rejected') return false
    if (search) {
      const q = search.toLowerCase()
      return (m.full_name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.region || '').toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    all: members.length,
    pending: members.filter((m: any) => m.approval_status === 'pending').length,
    approved: members.filter((m: any) => m.approval_status === 'approved').length,
    rejected: members.filter((m: any) => m.approval_status === 'rejected').length,
  }

  // Quick approve (from pending → approved + trainee role)
  const handleApprove = async (member: any) => {
    setUpdating(member.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          role: member.role === 'pending' ? 'trainee' : member.role,
        })
        .eq('id', member.id)

      if (error) throw error

      if (member.email) {
        sendEmail({
          type: 'approval',
          to: member.email,
          data: { name: member.full_name || 'Member' },
        }).catch((err) => console.error('Approval email failed:', err))
      }

      showToast(`${member.full_name || 'Member'} approved`)
      refetch()
    } catch (e: any) {
      showToast(e.message || 'Failed to approve', 'error')
    }
    setUpdating(null)
  }

  // Quick reject
  const handleReject = async (member: any) => {
    if (!confirm(`Reject ${member.full_name || 'this member'}?`)) return
    setUpdating(member.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'rejected' })
        .eq('id', member.id)

      if (error) throw error

      if (member.email) {
        sendEmail({
          type: 'rejection',
          to: member.email,
          data: { name: member.full_name || 'Member' },
        }).catch((err) => console.error('Rejection email failed:', err))
      }

      showToast(`${member.full_name || 'Member'} rejected`)
      refetch()
    } catch (e: any) {
      showToast(e.message || 'Failed to reject', 'error')
    }
    setUpdating(null)
  }

  // Open edit modal for a member
  const openEdit = (member: any) => {
    setEditForm({
      role: member.role || 'pending',
      approval_status: member.approval_status || 'pending',
    })
    setEditingId(member.id)
  }

  // Save edited role/status
  const handleSaveEdit = async () => {
    if (!editingId) return
    setUpdating(editingId)
    try {
      const supabase = createClient()
      const member = members.find((m: any) => m.id === editingId)
      const oldStatus = member?.approval_status

      const { error } = await supabase
        .from('profiles')
        .update({
          role: editForm.role,
          approval_status: editForm.approval_status,
        })
        .eq('id', editingId)

      if (error) throw error

      // Send email if approval status changed
      if (member?.email && oldStatus !== editForm.approval_status) {
        if (editForm.approval_status === 'approved') {
          sendEmail({
            type: 'approval',
            to: member.email,
            data: { name: member.full_name || 'Member' },
          }).catch((err) => console.error('Approval email failed:', err))
        } else if (editForm.approval_status === 'rejected') {
          sendEmail({
            type: 'rejection',
            to: member.email,
            data: { name: member.full_name || 'Member' },
          }).catch((err) => console.error('Rejection email failed:', err))
        }
      }

      showToast(`${member?.full_name || 'Member'} updated`)
      setEditingId(null)
      refetch()
    } catch (e: any) {
      showToast(e.message || 'Failed to update', 'error')
    }
    setUpdating(null)
  }

  const initials = (name: string) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">Members</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} registered members</p>
        </div>
        {counts.pending > 0 && (
          <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-200 animate-pulse">
            {counts.pending} pending approval
          </span>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
          </button>
        ))}
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk approve banner */}
      {filter === 'pending' && counts.pending > 0 && (
        <div className="flex gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg items-center">
          <span className="text-sm font-semibold text-amber-800 flex-1">
            {counts.pending} member{counts.pending !== 1 ? 's' : ''} waiting for approval
          </span>
          <button
            onClick={async () => {
              const pending = members.filter((m: any) => m.approval_status === 'pending')
              for (const m of pending) await handleApprove(m)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-600"
          >
            <UserCheck size={14} /> Approve All
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader className="animate-spin text-gray-400" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-40" /><p>No members found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Region</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m: any) => (
                <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${m.approval_status === 'pending' ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {initials(m.full_name)}
                      </div>
                      <span className="font-medium">{m.full_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.region || '—'}</td>
                  <td className="px-4 py-3">
                    {m.training_stage ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{m.training_stage}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[m.role] || ROLE_COLORS.pending}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${APPROVAL_COLORS[m.approval_status] || 'bg-gray-100 text-gray-500'}`}>
                      {m.approval_status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Quick approve/reject for pending */}
                      {m.approval_status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(m)}
                            disabled={updating === m.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-700 text-white rounded-md text-xs font-semibold hover:bg-green-600 disabled:opacity-50"
                            title="Approve"
                          >
                            {updating === m.id ? <Loader className="animate-spin" size={12} /> : <UserCheck size={12} />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(m)}
                            disabled={updating === m.id}
                            className="flex items-center gap-1 px-2 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                            title="Reject"
                          >
                            <UserX size={12} />
                          </button>
                        </>
                      )}

                      {/* Re-approve rejected members */}
                      {m.approval_status === 'rejected' && (
                        <button
                          onClick={() => handleApprove(m)}
                          disabled={updating === m.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-green-700 text-white rounded-md text-xs font-semibold hover:bg-green-600 disabled:opacity-50"
                        >
                          <UserCheck size={12} /> Approve
                        </button>
                      )}

                      {/* Edit button for all members */}
                      <button
                        onClick={() => openEdit(m)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                        title="Edit role & status"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingId(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-slate-600" />
                <h2 className="text-lg font-serif font-bold">Edit Member</h2>
              </div>
              <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>

            {(() => {
              const member = members.find((m: any) => m.id === editingId)
              if (!member) return null
              return (
                <div className="px-6 py-5 space-y-5">
                  {/* Member info header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-10 h-10 bg-purple-700 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {initials(member.full_name)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{member.full_name || '—'}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>

                  {/* Member details (read-only) */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Region</p>
                      <p className="text-gray-700">{member.region || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Training Stage</p>
                      <p className="text-gray-700">{member.training_stage || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">ACPGBI Number</p>
                      <p className="text-gray-700">{member.acpgbi_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Joined</p>
                      <p className="text-gray-700">
                        {member.created_at ? new Date(member.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Controls what the member can access</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Approval Status</label>
                      <select
                        value={editForm.approval_status}
                        onChange={(e) => setEditForm(prev => ({ ...prev, approval_status: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {APPROVAL_STATUSES.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Changing to approved/rejected will send an email notification</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={updating === editingId}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
              >
                {updating === editingId ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}