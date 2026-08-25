'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Uploads a file to the `media` storage bucket and hands back its public
 * URL. Content-type agnostic — images for featured photos and image
 * segments, PDFs for programmes and consent forms dropped into a
 * description.
 */
export function useFileUpload(bucket = 'media') {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const upload = async (file: File, folder = 'uploads'): Promise<string | null> => {
    setUploading(true)
    setError(null)

    try {
      const ext = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      setUploading(false)
      return publicUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
      return null
    }
  }

  return { upload, uploading, error }
}
