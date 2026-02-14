'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useImageUpload(bucket = 'media') {
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
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      setUploading(false)
      return publicUrl
    } catch (err: any) {
      setError(err.message)
      setUploading(false)
      return null
    }
  }

  return { upload, uploading, error }
}
