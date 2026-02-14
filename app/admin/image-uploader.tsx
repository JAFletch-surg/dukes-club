'use client'

import { useRef } from 'react'
import { Upload, X, Loader, ImageIcon } from 'lucide-react'
import { useImageUpload } from '@/lib/use-image-upload'

export default function ImageUploader({
  value,
  onChange,
  folder = 'uploads',
  label = 'Featured Image',
}: {
  value: string
  onChange: (url: string) => void
  folder?: string
  label?: string
}) {
  const { upload, uploading, error } = useImageUpload()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await upload(file, folder)
    if (url) onChange(url)
  }

  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#1a1f2e] mb-1.5">{label}</label>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-[#e0e3e8] bg-[#f8f9fa]">
          <img src={value} alt="" className="w-full h-40 object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 border-2 border-dashed border-[#d1d5db] rounded-xl flex flex-col items-center justify-center gap-2 text-[#6b7280] hover:border-[#9ca3af] hover:text-[#374151] hover:bg-[#f9fafb] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        >
          {uploading ? (
            <>
              <Loader size={22} className="animate-spin" />
              <span className="text-[13px] font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon size={24} strokeWidth={1.5} />
              <span className="text-[13px] font-medium">Click to upload image</span>
              <span className="text-[11px] text-[#9ca3af]">PNG, JPG up to 5MB</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-[12px] text-red-600 mt-1.5">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
