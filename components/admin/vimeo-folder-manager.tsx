'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader, Plus, Trash2, FolderOpen, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { createClient } from '@/lib/supabase/client'

/* ── Style tokens (matching the admin pages) ─────── */
const C = {
  navy: '#0F1F3D', primary: '#0078D4', fg: '#181820',
  muted: '#D1D1D6', secondary: '#504F58', destructive: '#DB2424',
}

/* ── Types ───────────────────────────────────────── */
export interface VimeoFolderRecord {
  id: string
  folder_id: string
  name: string
  is_active: boolean
  video_count: number | null
  last_synced_at: string | null
  created_at: string
}

interface VimeoFolderSummary {
  folder_id: string
  name: string
  video_count: number
}

interface Props {
  open: boolean
  onClose: () => void
}

function fmtDate(iso: string | null) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function VimeoFolderManager({ open, onClose }: Props) {
  const { data: synced, loading, refetch, create, update, remove } =
    useSupabaseTable<VimeoFolderRecord>('vimeo_folders', 'created_at', true)

  const [available, setAvailable] = useState<VimeoFolderSummary[] | null>(null)
  const [envFolderId, setEnvFolderId] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const seededRef = useRef(false)
  const attemptedRef = useRef(false)

  /* ── Load the account's folders from Vimeo ──────── */
  const loadAvailable = useCallback(async () => {
    setBrowsing(true)
    setBrowseError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const res = await fetch('/api/vimeo/folders', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not load Vimeo folders')
      setAvailable(body.folders || [])
      setEnvFolderId(body.env_folder_id || null)
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Could not load Vimeo folders')
      setAvailable(null)
    }
    setBrowsing(false)
  }, [])

  /* Load once per opening. Guarded by a ref rather than `available === null`
     so a failed fetch doesn't retry in a loop — use Refresh to try again. */
  useEffect(() => {
    if (!open) {
      attemptedRef.current = false
      return
    }
    if (attemptedRef.current) return
    attemptedRef.current = true
    loadAvailable()
  }, [open, loadAvailable])

  /* ── Seed the legacy VIMEO_FOLDER_ID folder ──────
     Until a folder is added here the sync route falls back to that env var.
     Adding a *different* folder first would silently drop it from the active
     set and archive its videos, so it goes in automatically before anything
     else can be added. */
  useEffect(() => {
    if (!open || loading || seededRef.current) return
    if (synced.length > 0 || !envFolderId || available === null) return

    const match = available.find(f => f.folder_id === envFolderId)
    if (!match) return // handled by the warning below

    seededRef.current = true
    create({
      folder_id: match.folder_id,
      name: match.name,
      is_active: true,
      video_count: match.video_count,
    }).catch(err => {
      seededRef.current = false
      setBrowseError(err instanceof Error ? err.message : 'Could not add the current folder')
    })
  }, [open, loading, synced.length, envFolderId, available, create])

  if (!open) return null

  const syncedIds = new Set(synced.map(f => f.folder_id))
  const unadded = (available || []).filter(f => !syncedIds.has(f.folder_id))

  /* The env folder is configured but missing from the account — seeding it
     would create a row that can never sync. */
  const envFolderMissing =
    synced.length === 0 &&
    !!envFolderId &&
    available !== null &&
    !available.some(f => f.folder_id === envFolderId)

  const handleAdd = async (folder: VimeoFolderSummary) => {
    setBusyId(folder.folder_id)
    try {
      await create({
        folder_id: folder.folder_id,
        name: folder.name,
        is_active: true,
        video_count: folder.video_count,
      })
    } catch (err) {
      alert('Could not add folder: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
    setBusyId(null)
  }

  const handleToggle = async (folder: VimeoFolderRecord) => {
    if (folder.is_active && !confirm(
      `Stop syncing "${folder.name}"?\n\nIts videos will be archived on the next sync.`
    )) return
    setBusyId(folder.folder_id)
    try {
      await update(folder.id, { is_active: !folder.is_active })
    } catch (err) {
      alert('Could not update folder: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
    setBusyId(null)
  }

  const handleRemove = async (folder: VimeoFolderRecord) => {
    if (!confirm(
      `Remove "${folder.name}" from the synced folders?\n\nIts videos will be archived on the next sync.`
    )) return
    setBusyId(folder.folder_id)
    try {
      await remove(folder.id)
    } catch (err) {
      alert('Could not remove folder: ' + (err instanceof Error ? err.message : 'unknown error'))
    }
    setBusyId(null)
  }

  const activeCount = synced.filter(f => f.is_active).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.fg, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOpen size={20} /> Vimeo Folders
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          <p style={{ fontSize: 13, color: C.secondary, lineHeight: 1.5, margin: 0 }}>
            Videos in these folders are pulled into the library when you run <strong>Sync from Vimeo</strong>.
            Any video that is not in a synced folder is archived.
          </p>

          {browseError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#FEF3C7', color: '#92400E', fontSize: 13 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{browseError}</span>
            </div>
          )}

          {envFolderMissing && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#FEF3C7', color: '#92400E', fontSize: 13 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                The folder currently set in <code>VIMEO_FOLDER_ID</code> ({envFolderId}) is not on this
                Vimeo account. Add the folders you want below — until you do, sync will keep trying
                that ID and fail.
              </span>
            </div>
          )}

          {/* ── Synced folders ─────────────────────────── */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.fg, marginBottom: 12 }}>
              Synced folders {synced.length > 0 && <span style={{ fontWeight: 500, color: C.secondary }}>({activeCount} active)</span>}
            </h3>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.secondary, fontSize: 13, padding: '12px 0' }}>
                <Loader size={14} className="animate-spin" /> Loading…
              </div>
            ) : synced.length === 0 ? (
              <p style={{ fontSize: 13, color: C.secondary, margin: 0, padding: '12px 16px', background: '#F7F7F9', borderRadius: 10 }}>
                No folders added yet. Pick one from the list below.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {synced.map(folder => (
                  <div
                    key={folder.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      border: `1.5px solid ${folder.is_active ? C.muted : '#EEE'}`,
                      background: folder.is_active ? '#fff' : '#FAFAFA',
                      opacity: folder.is_active ? 1 : 0.65,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {folder.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>
                        ID {folder.folder_id}
                        {folder.video_count !== null && ` · ${folder.video_count} video${folder.video_count === 1 ? '' : 's'}`}
                        {' · last synced '}{fmtDate(folder.last_synced_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {busyId === folder.folder_id ? (
                        <Loader size={16} className="animate-spin" style={{ color: C.secondary }} />
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggle(folder)}
                            title={folder.is_active ? 'Pause syncing this folder' : 'Resume syncing this folder'}
                            style={{
                              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: `1.5px solid ${C.muted}`, background: '#fff', cursor: 'pointer',
                              color: folder.is_active ? C.secondary : C.primary,
                              fontFamily: 'Montserrat, sans-serif',
                            }}
                          >
                            {folder.is_active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            onClick={() => handleRemove(folder)}
                            title="Remove folder"
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.destructive, padding: 6 }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Available on Vimeo ─────────────────────── */}
          <div style={{ paddingTop: 18, borderTop: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.fg, margin: 0 }}>
                Available on Vimeo
              </h3>
              <button
                onClick={() => { loadAvailable(); refetch() }}
                disabled={browsing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${C.muted}`, background: '#fff',
                  cursor: browsing ? 'wait' : 'pointer', color: C.primary,
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                <RefreshCw size={13} className={browsing ? 'animate-spin' : undefined} /> Refresh
              </button>
            </div>

            {browsing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.secondary, fontSize: 13, padding: '12px 0' }}>
                <Loader size={14} className="animate-spin" /> Loading folders from Vimeo…
              </div>
            ) : available === null ? (
              <p style={{ fontSize: 13, color: C.secondary, margin: 0 }}>
                Could not reach Vimeo. Use Refresh to try again.
              </p>
            ) : unadded.length === 0 ? (
              <p style={{ fontSize: 13, color: C.secondary, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={14} /> Every folder on the account is already added.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unadded.map(folder => (
                  <div
                    key={folder.folder_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '12px 16px', borderRadius: 10, border: '1.5px solid #EEE', background: '#FAFAFA',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {folder.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.secondary, marginTop: 2 }}>
                        ID {folder.folder_id} · {folder.video_count} video{folder.video_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(folder)}
                      disabled={busyId === folder.folder_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: 'none', background: C.navy, color: '#fff',
                        cursor: busyId === folder.folder_id ? 'wait' : 'pointer',
                        fontFamily: 'Montserrat, sans-serif',
                      }}
                    >
                      {busyId === folder.folder_id
                        ? <Loader size={14} className="animate-spin" />
                        : <Plus size={14} />} Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 28px', borderTop: '1px solid #eee' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: 'none', background: C.navy, color: '#fff', cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
