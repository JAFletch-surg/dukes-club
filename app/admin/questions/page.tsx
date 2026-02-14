'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText, Plus, Edit, Trash2, Save, Loader, X, ImageIcon, Flag, AlertTriangle, Check } from 'lucide-react'
import { useSupabaseTable } from '@/lib/use-supabase-table'
import { useImageUpload } from '@/lib/use-image-upload'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['draft', 'published', 'archived']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const QUESTION_TYPES = ['mcq', 'single_best_answer', 'extended_matching']

const TOPIC_CATEGORIES: Record<string, string[]> = {
  Colorectal: ['Colorectal Cancer', 'Rectal Cancer', 'Anal Cancer', 'IBD', 'Intestinal Failure', 'Pelvic Floor', 'Proctology', 'Fistula', 'Stoma'],
  'General Surgery': ['Upper GI', 'HPB', 'Trauma', 'Endocrine', 'Breast', 'Paediatric', 'Vascular', 'Gynaecology/Urology', 'Emergency Surgery'],
  Foundations: ['Anatomy', 'Physiology', 'Pathology', 'Radiology', 'Perioperative Care', 'Research & Audit', 'Nutrition', 'Genetics'],
}

const S = {
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif', minHeight: 100, resize: 'vertical' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  btn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
}

/* ── Image upload ───────────────────────────────────── */
function ImageUploadBox({ value, onChange, folder, label }: { value: string; onChange: (url: string) => void; folder: string; label: string }) {
  const { upload, uploading, error } = useImageUpload()
  const ref = useRef<HTMLInputElement>(null)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await upload(file, folder)
    if (url) onChange(url)
    e.target.value = ''
  }
  return (
    <div>
      <label style={S.label}>{label}</label>
      {value ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #ddd' }}>
          <img src={value} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{ width: '100%', height: 120, border: '2px dashed #D1D1D6', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#504F58', background: '#fff', cursor: uploading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500 }}>
          {uploading ? <><Loader size={20} className="animate-spin" />Uploading...</> : <><ImageIcon size={22} strokeWidth={1.5} />Click to upload image<span style={{ fontSize: 11, color: '#999' }}>PNG, JPG up to 5MB — clinical images, diagrams, radiology</span></>}
        </button>
      )}
      {error && <p style={{ fontSize: 12, color: '#DB2424', marginTop: 6 }}>{error}</p>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

/* ── Options editor ─────────────────────────────────── */
function OptionsEditor({ options, correct, onChange, onCorrectChange }: {
  options: string[]; correct: number;
  onChange: (opts: string[]) => void; onCorrectChange: (i: number) => void
}) {
  const addOption = () => { if (options.length < 6) onChange([...options, '']) }
  const removeOption = (i: number) => {
    const newOpts = options.filter((_, idx) => idx !== i)
    onChange(newOpts)
    if (correct >= newOpts.length) onCorrectChange(0)
    else if (correct > i) onCorrectChange(correct - 1)
  }
  return (
    <div>
      <label style={S.label}>Answer Options *</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => onCorrectChange(i)}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: '2px solid',
                borderColor: correct === i ? '#16a34a' : '#D1D1D6',
                background: correct === i ? '#f0fdf4' : '#fff',
                color: correct === i ? '#16a34a' : '#D1D1D6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, fontSize: 13, fontWeight: 700,
              }}>
              {correct === i ? <Check size={16} /> : String.fromCharCode(65 + i)}
            </button>
            <input style={{ ...S.input, flex: 1 }} value={opt}
              onChange={(e) => { const n = [...options]; n[i] = e.target.value; onChange(n) }}
              placeholder={`Option ${String.fromCharCode(65 + i)}`} />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)}
                style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}><X size={16} /></button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button type="button" onClick={addOption}
          style={{ marginTop: 8, padding: '6px 14px', border: '1.5px dashed #D1D1D6', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: '#504F58' }}>
          + Add Option
        </button>
      )}
      <p style={S.hint}>Click the circle to mark the correct answer (green = correct)</p>
    </div>
  )
}

export default function QuestionsAdmin() {
  const { data: questions, loading, create, update, remove } = useSupabaseTable<any>('questions', 'created_at', false)
  const [topics, setTopics] = useState<any[]>([])
  const [flags, setFlags] = useState<any[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [tab, setTab] = useState<'questions' | 'flags'>('questions')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  // Load topics and flags
  useEffect(() => {
    const supabase = createClient()
    supabase.from('question_topics').select('*').order('sort_order').then(({ data }) => setTopics(data || []))
    supabase.from('question_flags').select('*, question:questions(question_text)').eq('status', 'open').order('created_at', { ascending: false }).then(({ data }) => setFlags(data || []))
  }, [])

  const emptyForm = {
    question_text: '', options: ['', '', '', '', ''] as string[],
    correct_answer: 0, explanation: '',
    topic_id: '', subtopic: '', difficulty: 'medium',
    question_type: 'single_best_answer', source: '',
    image_url: '', status: 'draft', reviewed: false,
  }
  const [form, setForm] = useState(emptyForm)

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (q: any) => {
    const opts = Array.isArray(q.options) ? q.options : ['', '', '', '', '']
    setForm({
      question_text: q.question_text || '', options: opts,
      correct_answer: q.correct_answer ?? 0, explanation: q.explanation || '',
      topic_id: q.topic_id || '', subtopic: q.subtopic || '',
      difficulty: q.difficulty || 'medium', question_type: q.question_type || 'single_best_answer',
      source: q.source || '', image_url: q.image_url || '',
      status: q.status || 'draft', reviewed: q.reviewed || false,
    })
    setEditing(q.id)
  }

  const handleSave = async () => {
    if (!form.question_text) { showToast('Question text is required', 'error'); return }
    const validOpts = form.options.filter(o => o.trim())
    if (validOpts.length < 2) { showToast('At least 2 options required', 'error'); return }
    setSaving(true)
    try {
      const payload: any = {
        question_text: form.question_text,
        options: validOpts,
        correct_answer: form.correct_answer,
        explanation: form.explanation || null,
        topic_id: form.topic_id || null,
        subtopic: form.subtopic || null,
        difficulty: form.difficulty,
        question_type: form.question_type,
        source: form.source || null,
        image_url: form.image_url || null,
        status: form.status,
        reviewed: form.reviewed,
      }
      if (editing === 'new') { await create(payload); showToast('Question created') }
      else { await update(editing!, payload); showToast('Question updated') }
      setEditing(null)
    } catch (err: any) { showToast(err.message, 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return
    setDeleting(id)
    try { await remove(id); showToast('Question deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const resolveFlag = async (flagId: string) => {
    const supabase = createClient()
    await supabase.from('question_flags').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', flagId)
    setFlags(flags.filter(f => f.id !== flagId))
    showToast('Flag resolved')
  }

  const getTopicName = (id: string) => topics.find(t => t.id === id)?.name || '—'
  const diffBadge = (d: string) => {
    const m: Record<string, [string, string]> = { easy: ['#f0fdf4', '#16a34a'], medium: ['#FFF7ED', '#C2410C'], hard: ['#FEF2F2', '#DC2626'] }
    const [bg, fg] = m[d] || ['#F3F4F6', '#666']
    return S.badge(bg, fg)
  }

  const filtered = questions.filter((q: any) => {
    if (search && !q.question_text?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterTopic && q.topic_id !== filterTopic) return false
    if (filterDiff && q.difficulty !== filterDiff) return false
    return true
  })

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Question Bank</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>{questions.length} questions · {flags.length} open flags</p>
        </div>
        <button onClick={openNew} style={S.btn}><Plus size={16} strokeWidth={2.5} /> Add Question</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['questions', 'flags'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#0F1F3D' : '#fff', color: tab === t ? '#fff' : '#504F58', border: tab === t ? 'none' : '1px solid #D1D1D6' }}>
            {t === 'questions' ? `Questions (${questions.length})` : `Flagged (${flags.length})`}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <input style={{ ...S.input, maxWidth: 300 }} placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select style={{ ...S.select, maxWidth: 200 }} value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}>
              <option value="">All Topics</option>
              {Object.entries(TOPIC_CATEGORIES).map(([cat, tops]) => (
                <optgroup key={cat} label={cat}>
                  {tops.map(t => {
                    const topic = topics.find(x => x.name === t)
                    return topic ? <option key={topic.id} value={topic.id}>{t}</option> : null
                  })}
                </optgroup>
              ))}
            </select>
            <select style={{ ...S.select, maxWidth: 140 }} value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
              <option value="">All Difficulties</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '80px 20px', textAlign: 'center' }}>
              <FileText size={40} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No questions found</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #F1F1F3' }}>
                    {['Question', 'Topic', 'Difficulty', 'Type', 'Stats', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q: any) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #F1F1F3' }}>
                      <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                        <div style={{ fontWeight: 500, color: '#181820', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.image_url && <ImageIcon size={14} style={{ display: 'inline', marginRight: 6, color: '#C49A6C' }} />}
                          {q.question_text}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#504F58', fontSize: 13 }}>{getTopicName(q.topic_id)}</td>
                      <td style={{ padding: '14px 16px' }}><span style={diffBadge(q.difficulty)}>{q.difficulty}</span></td>
                      <td style={{ padding: '14px 16px' }}><span style={S.badge('#F5F3FF', '#7C3AED')}>{q.question_type?.replace('_', ' ')}</span></td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#504F58' }}>
                        {q.times_attempted > 0 ? `${q.times_attempted} attempts · ${Math.round(q.average_score || 0)}%` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={S.badge(q.status === 'published' ? '#f0fdf4' : '#fefce8', q.status === 'published' ? '#16a34a' : '#a16207')}>{q.status}</span>
                        {q.reviewed && <span style={{ marginLeft: 4, ...S.badge('#EFF6FF', '#2563EB') }}>✓</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          <button onClick={() => openEdit(q)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Edit size={16} /></button>
                          <button onClick={() => handleDelete(q.id)} disabled={deleting === q.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}>
                            {deleting === q.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Flags tab */}
      {tab === 'flags' && (
        <div>
          {flags.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '60px 20px', textAlign: 'center' }}>
              <Check size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No open flags</p>
              <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>All flagged questions have been reviewed</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {flags.map((f: any) => (
                <div key={f.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #D1D1D6', padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Flag size={16} color="#DC2626" />
                      <span style={S.badge('#FEF2F2', '#DC2626')}>{f.reason}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#888' }}>{new Date(f.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#181820', marginBottom: 6, fontWeight: 500 }}>{f.question?.question_text?.slice(0, 120)}...</p>
                  {f.details && <p style={{ fontSize: 13, color: '#504F58', marginBottom: 12 }}>{f.details}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      const q = questions.find((x: any) => x.id === f.question_id)
                      if (q) openEdit(q)
                    }} style={{ padding: '6px 14px', border: '1.5px solid #D1D1D6', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#504F58' }}>
                      Edit Question
                    </button>
                    <button onClick={() => resolveFlag(f.id)} style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Resolve Flag
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit Modal ─────────────────────────────────── */}
      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #E4E4E8' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Add Question' : 'Edit Question'}</h2>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Image upload */}
              <ImageUploadBox value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="questions" label="Question Image (optional — clinical photos, radiology, diagrams)" />

              {/* Question text */}
              <div>
                <label style={S.label}>Question Text *</label>
                <textarea style={{ ...S.textarea, minHeight: 100 }} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                  placeholder="A 62-year-old presents with..." />
              </div>

              {/* Options */}
              <OptionsEditor
                options={form.options}
                correct={form.correct_answer}
                onChange={(opts) => setForm({ ...form, options: opts })}
                onCorrectChange={(i) => setForm({ ...form, correct_answer: i })}
              />

              {/* Explanation */}
              <div>
                <label style={S.label}>Explanation</label>
                <textarea style={S.textarea} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                  placeholder="Explain why the correct answer is correct and why others are wrong..." />
              </div>

              {/* Classification */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.label}>Topic</label>
                  <select style={S.select} value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })}>
                    <option value="">Select topic...</option>
                    {Object.entries(TOPIC_CATEGORIES).map(([cat, tops]) => (
                      <optgroup key={cat} label={cat}>
                        {tops.map(t => {
                          const topic = topics.find(x => x.name === t)
                          return topic ? <option key={topic.id} value={topic.id}>{t}</option> : null
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div><label style={S.label}>Subtopic (optional)</label><input style={S.input} value={form.subtopic} onChange={(e) => setForm({ ...form, subtopic: e.target.value })} placeholder="e.g. TNM Staging, Lynch Syndrome" /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.label}>Difficulty</label>
                  <select style={S.select} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Question Type</label>
                  <select style={S.select} value={form.question_type} onChange={(e) => setForm({ ...form, question_type: e.target.value })}>
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end' }}>
                <div><label style={S.label}>Source</label><input style={S.input} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Original, Past Paper 2024, Contributed" /></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#181820', cursor: 'pointer', paddingBottom: 8 }}>
                  <input type="checkbox" checked={form.reviewed} onChange={(e) => setForm({ ...form, reviewed: e.target.checked })} style={{ width: 18, height: 18 }} />
                  Reviewed
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '18px 28px', borderTop: '1px solid #E4E4E8', background: '#FAFAFA', borderRadius: '0 0 20px 20px' }}>
              <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: '#504F58', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn, opacity: saving ? 0.5 : 1 }}>
                {saving ? <Loader className="animate-spin" size={15} /> : <Save size={15} />}
                {editing === 'new' ? 'Create Question' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
