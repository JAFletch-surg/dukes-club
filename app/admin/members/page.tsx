'use client'

import { useState } from 'react'
import { Users, Loader } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'

export default function MembersAdmin() {
  const { data: members, loading } = useSupabaseTable<any>('profiles', 'created_at', false)
  const [search, setSearch] = useState('')

  const filtered = members.filter((m: any) =>
    !search || (m.full_name || '').toLowerCase().includes(search.toLowerCase()) || (m.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const initials = (name: string) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">Members</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} registered members</p>
        </div>
        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{members.length} total</span>
      </div>

      <input
        className="w-full max-w-sm mb-5 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        placeholder="Search members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m: any) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {initials(m.full_name)}
                      </div>
                      <span className="font-medium">{m.full_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{m.region || '—'}</td>
                  <td className="px-4 py-3">
                    {m.training_stage ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{m.training_stage}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.role === 'admin' || m.role === 'super_admin' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                    }`}>{m.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}