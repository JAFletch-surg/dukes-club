'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i

/**
 * Lists previously uploaded images so an admin can reuse one instead of
 * re-uploading. Two sources are merged:
 *   1. files in `<folder>/` of the storage bucket (everything uploaded here)
 *   2. images already attached to a row in `table.column`
 *
 * (2) is the fallback: storage list permissions depend on the project's
 * storage.objects policies, so if list() is blocked we still show the images
 * that are demonstrably in use rather than an empty grid.
 */
export function useMediaLibrary({
  folder = 'events',
  bucket = 'media',
  table,
  column,
}: {
  folder?: string
  bucket?: string
  table?: string
  column?: string
} = {}) {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const urls: string[] = []

    try {
      const { data } = await supabase.storage.from(bucket).list(folder, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      for (const file of data || []) {
        if (!IMAGE_EXT.test(file.name)) continue
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(`${folder}/${file.name}`)
        urls.push(publicUrl)
      }
    } catch {
      // storage list blocked by policy — fall back to in-use images below
    }

    if (table && column) {
      try {
        const { data } = await supabase.from(table).select(column).not(column, 'is', null)
        const rows = (data ?? []) as unknown as Record<string, unknown>[]
        for (const row of rows) {
          const url = row[column]
          if (typeof url === 'string' && url.trim()) urls.push(url.trim())
        }
      } catch {
        // ignore — the storage listing above may still have produced results
      }
    }

    setImages([...new Set(urls)])
    setLoading(false)
  }, [bucket, folder, table, column])

  useEffect(() => { load() }, [load])

  return { images, loading, refresh: load }
}
