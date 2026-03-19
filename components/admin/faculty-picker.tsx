'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Plus, X, UserPlus, Pencil } from 'lucide-react'
import { CreateFacultyDialog, type FacultyMember } from './create-faculty-dialog'

interface FacultyPickerProps {
  faculty: FacultyMember[]
  selectedIds: string[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onFacultyCreated: (f: FacultyMember) => void
  onEdit?: (id: string) => void
  placeholder?: string
  showChips?: boolean  // default true — set false when parent renders its own selected list
}

export { type FacultyMember } from './create-faculty-dialog'

export function FacultyPicker({ faculty, selectedIds, onAdd, onRemove, onFacultyCreated, onEdit, placeholder, showChips = true }: FacultyPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const available = faculty.filter(f => {
    if (selectedIds.includes(f.id)) return false
    if (!query) return true
    const q = query.toLowerCase()
    return (
      f.full_name?.toLowerCase().includes(q) ||
      f.position_title?.toLowerCase().includes(q) ||
      f.hospital?.toLowerCase().includes(q)
    )
  })

  const handleCreateNew = () => {
    setOpen(false)
    setCreateOpen(true)
  }

  const handleFacultyCreated = (newFac: FacultyMember) => {
    onFacultyCreated(newFac)
    onAdd(newFac.id)
    setQuery('')
  }

  /* ── Selected chips ── */
  const selectedChips = showChips && selectedIds.length > 0 && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      {selectedIds.map(id => {
        const f = faculty.find(x => x.id === id)
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E4E8', borderRadius: 8 }}>
            {f?.photo_url ? (
              <img src={f.photo_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F0ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>
                {f?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
              </div>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{f?.full_name || 'Unknown'}</span>
            {onEdit && <button type="button" onClick={() => onEdit(id)} title="Edit faculty profile"
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7C3AED', padding: 4 }}><Pencil size={14} /></button>}
            <button type="button" onClick={() => onRemove(id)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', padding: 4 }}><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      {selectedChips}
      <div ref={ref} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #D1D1D6', borderRadius: 10, padding: '0 12px', background: '#fff' }}>
          <Search size={15} color="#999" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder || "Search faculty by name, hospital, or role..."}
            style={{ width: '100%', padding: '10px 0', border: 'none', fontSize: 14, color: '#000', background: 'transparent', outline: 'none' }}
          />
        </div>

        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#fff', border: '1px solid #E4E4E8', borderRadius: 10,
            marginTop: 4, maxHeight: 280, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}>
            {available.length === 0 && !query ? (
              <div style={{ padding: '16px 14px', textAlign: 'center', color: '#999', fontSize: 13 }}>
                All faculty have been assigned
              </div>
            ) : (
              <>
                {available.length === 0 && query ? (
                  <div style={{ padding: '16px 14px', textAlign: 'center', color: '#999', fontSize: 13 }}>
                    No matching faculty found
                  </div>
                ) : (
                  available.slice(0, 20).map(f => (
                    <button key={f.id} type="button"
                      onClick={() => { onAdd(f.id); setQuery(''); setOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 14px', border: 'none', background: 'transparent',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F7'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {f.photo_url ? (
                        <img src={f.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0ECFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>
                          {f.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
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
                {/* Always show "Add new" option */}
                <button type="button" onClick={handleCreateNew}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '12px 14px', border: 'none', background: 'transparent',
                    cursor: 'pointer', textAlign: 'left', borderTop: '1px solid #F1F1F3',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F0F7FF'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={15} color="#2563EB" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#2563EB', fontSize: 13 }}>
                      {query ? `Add "${query}" as new faculty` : 'Add new faculty member'}
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <CreateFacultyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleFacultyCreated}
        initialName={query}
      />
    </>
  )
}
