'use client'

import { useRef, useState } from 'react'
import { Upload, Link2, Loader, Image as ImageIcon } from 'lucide-react'
import { useImageUpload } from '@/lib/use-image-upload'
import { useMediaLibrary } from '@/lib/use-media-library'

const S = {
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 16, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
}

const SELECTED = '2.5px solid #7C3AED'
const UNSELECTED = '1.5px solid #D1D1D6'

type Tab = 'upload' | 'library' | 'url'

const TABS: { id: Tab; label: string; Icon: typeof Upload }[] = [
  { id: 'upload', label: 'Upload', Icon: Upload },
  { id: 'library', label: 'Library', Icon: ImageIcon },
  { id: 'url', label: 'URL', Icon: Link2 },
]

/**
 * Image picker for admin forms: upload a new file, reuse a previously
 * uploaded one, or paste a URL. Uploads go to `<folder>/` in the `media`
 * bucket and the stored value is always the resulting public URL.
 */
export function ImageField({
  value,
  onChange,
  folder = 'uploads',
  label = 'Image',
  table,
  column,
  presets = [],
  presetsLabel = 'Brand images',
}: {
  value: string
  onChange: (url: string) => void
  folder?: string
  label?: string
  /** Table/column to also scan for images already in use (see useMediaLibrary) */
  table?: string
  column?: string
  presets?: { label: string; url: string }[]
  presetsLabel?: string
}) {
  const [tab, setTab] = useState<Tab>('upload')
  const { upload, uploading, error } = useImageUpload()
  const { images, loading, refresh } = useMediaLibrary({ folder, table, column })
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await upload(file, folder)
    if (url) {
      onChange(url)
      refresh()
    }
  }

  return (
    <div>
      <label style={S.label}>{label}</label>

      <div style={{ display: 'flex', gap: 4, padding: 3, background: '#F1F1F3', borderRadius: 10, marginBottom: 12 }}>
        {TABS.map(({ id, label: tabLabel, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'Montserrat, sans-serif',
              background: tab === id ? '#fff' : 'transparent',
              color: tab === id ? '#0F1F3D' : '#6B7280',
              boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={13} />{tabLabel}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%', height: 120, border: '2px dashed #D1D1D6', borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              color: '#504F58', background: '#fff', cursor: uploading ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: 'Montserrat, sans-serif',
            }}
          >
            {uploading ? (
              <><Loader size={20} className="animate-spin" />Uploading...</>
            ) : (
              <>
                <ImageIcon size={22} strokeWidth={1.5} />
                Click to upload image
                <span style={{ fontSize: 11, color: '#999' }}>PNG, JPG up to 5MB</span>
              </>
            )}
          </button>
          {error && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>{error}</p>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {tab === 'library' && (
        <div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 120, color: '#888', fontSize: 13 }}>
              <Loader size={16} className="animate-spin" />Loading images...
            </div>
          ) : images.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#888', fontSize: 13, textAlign: 'center', padding: '0 16px' }}>
              No images uploaded yet — use the Upload tab to add one.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {images.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => onChange(url)}
                  title={url}
                  style={{ border: value === url ? SELECTED : UNSELECTED, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#F1F1F3', padding: 0, height: 70 }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'url' && (
        <div>
          <input
            style={S.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
          />
          <p style={S.hint}>Paste the address of an image hosted elsewhere</p>
        </div>
      )}

      {presets.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{presetsLabel}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {presets.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => onChange(preset.url)}
                style={{ border: value === preset.url ? SELECTED : UNSELECTED, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: '#F1F1F3', padding: 0, width: 100, display: 'flex', flexDirection: 'column' }}
              >
                <img src={preset.url} alt={preset.label} style={{ width: '100%', height: 50, objectFit: 'cover', display: 'block' }} />
                <span style={{ fontSize: 10, padding: '4px 6px', color: value === preset.url ? '#7C3AED' : '#504F58', fontWeight: 600, textAlign: 'center' }}>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid #E4E4E8' }}>
          <img src={value} alt="Preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #E4E4E8', background: '#F1F1F3' }} />
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Remove image
          </button>
        </div>
      )}
    </div>
  )
}

export default ImageField
