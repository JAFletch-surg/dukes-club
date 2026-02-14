'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSupabaseTable<T extends { id: string }>(
  table: string,
  orderCol = 'created_at',
  ascending = false
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: rows, error: err } = await supabase
      .from(table)
      .select('*')
      .order(orderCol, { ascending })
    if (err) {
      setError(err.message)
      setData([])
    } else {
      setData((rows as T[]) || [])
    }
    setLoading(false)
  }, [table, orderCol, ascending])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const create = async (row: Partial<T>) => {
    const { data: newRow, error: err } = await supabase
      .from(table)
      .insert(row)
      .select('*')
    if (err) throw new Error(err.message)
    const created = (newRow as T[])[0]
    setData((d) => [created, ...d])
    return created
  }

  const update = async (id: string, updates: Partial<T>) => {
    const { data: updated, error: err } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select('*')
    if (err) throw new Error(err.message)
    const updatedRow = (updated as T[])[0]
    setData((d) => d.map((r) => (r.id === id ? updatedRow : r)))
    return updatedRow
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData((d) => d.filter((r) => r.id !== id))
  }

  return { data, loading, error, refetch: fetchData, create, update, remove }
}