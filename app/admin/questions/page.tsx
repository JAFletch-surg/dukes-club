'use client'

import { useState, useRef, useEffect } from 'react'
import { FileText, Plus, Edit, Trash2, Save, Loader, X, ImageIcon, Flag, Check, Eye, ChevronDown, MessageSquare, Search, Filter, Copy } from 'lucide-react'
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

const FLAG_REASONS: Record<string, { label: string; color: string; bg: string }> = {
  incorrect_answer: { label: 'Incorrect Answer', color: '#DC2626', bg: '#FEF2F2' },
  outdated_info: { label: 'Outdated Info', color: '#C2410C', bg: '#FFF7ED' },
  unclear_wording: { label: 'Unclear Wording', color: '#A16207', bg: '#FEFCE8' },
  wrong_topic: { label: 'Wrong Topic', color: '#7C3AED', bg: '#F5F3FF' },
  duplicate: { label: 'Duplicate', color: '#0369A1', bg: '#F0F9FF' },
  other: { label: 'Other', color: '#504F58', bg: '#F3F4F6' },
}

const S = {
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  select: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif' } as React.CSSProperties,
  textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 14, color: '#000', background: '#fff', outline: 'none', fontFamily: 'Montserrat, sans-serif', minHeight: 100, resize: 'vertical' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#181820', marginBottom: 6 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#888', marginTop: 4 } as React.CSSProperties,
  badge: (bg: string, fg: string) => ({ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color: fg }) as React.CSSProperties,
  btn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#0F1F3D', color: '#F5F8FC', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  btnOutline: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#fff', color: '#504F58', border: '1.5px solid #D1D1D6', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
}

/* ── Image upload ───────────────────────────────── */
function ImageUploadBox({ value, onChange, folder, label, height = 160 }: { value: string; onChange: (url: string) => void; folder: string; label: string; height?: number }) {
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
          <img src={value} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{ width: '100%', height: Math.max(height - 40, 80), border: '2px dashed #D1D1D6', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#504F58', background: '#fff', cursor: uploading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 500 }}>
          {uploading ? <><Loader size={20} className="animate-spin" />Uploading...</> : <><ImageIcon size={22} strokeWidth={1.5} />Click to upload image<span style={{ fontSize: 11, color: '#999' }}>PNG, JPG up to 5MB</span></>}
        </button>
      )}
      {error && <p style={{ fontSize: 12, color: '#DB2424', marginTop: 6 }}>{error}</p>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

/* ── Options editor ─────────────────────────────── */
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

/* ── Preview panel ─────────────────────────────── */
function QuestionPreview({ form, topics, onClose }: { form: any; topics: any[]; onClose: () => void }) {
  const topicName = topics.find(t => t.id === form.topic_id)?.name || 'No topic'
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 640, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px', padding: 32, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F1F3D' }}>Question Preview</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <span style={S.badge('#F3F4F6', '#504F58')}>{topicName}</span>
          <span style={S.badge(form.difficulty === 'easy' ? '#f0fdf4' : form.difficulty === 'hard' ? '#FEF2F2' : '#FFF7ED', form.difficulty === 'easy' ? '#16a34a' : form.difficulty === 'hard' ? '#DC2626' : '#C2410C')}>{form.difficulty}</span>
        </div>
        {form.image_url && <img src={form.image_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 12, marginBottom: 16, background: '#f8f8f8' }} />}
        <p style={{ fontSize: 15, fontWeight: 600, color: '#181820', lineHeight: 1.6, marginBottom: 20 }}>{form.question_text || 'No question text'}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {form.options.filter((o: string) => o.trim()).map((opt: string, i: number) => (
            <div key={i} style={{
              padding: '12px 16px', borderRadius: 10, border: '2px solid',
              borderColor: i === form.correct_answer ? '#16a34a' : '#E4E4E8',
              background: i === form.correct_answer ? '#f0fdf4' : '#fff',
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 14,
            }}>
              <span style={{ fontWeight: 700, color: '#888' }}>{String.fromCharCode(65 + i)}.</span>
              <span style={{ color: '#181820' }}>{opt}</span>
              {i === form.correct_answer && <Check size={16} style={{ marginLeft: 'auto', color: '#16a34a' }} />}
            </div>
          ))}
        </div>
        {form.explanation && (
          <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: '#F8F6F0', borderLeft: '4px solid #C49A6C' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F1F3D', marginBottom: 6 }}>Explanation</p>
            <p style={{ fontSize: 13, color: '#504F58', lineHeight: 1.6 }}>{form.explanation}</p>
            {form.explanation_image_url && (
              <img src={form.explanation_image_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginTop: 12, background: '#fff' }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuestionsAdmin() {
  const { data: questions, loading, create, update, remove } = useSupabaseTable<any>('questions', 'created_at', false)
  const [topics, setTopics] = useState<any[]>([])
  const [flags, setFlags] = useState<any[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterDiff, setFilterDiff] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showFlags, setShowFlags] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const showToast = (msg: string, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  // Load topics and reported issues
  useEffect(() => {
    const supabase = createClient()
    supabase.from('question_topics').select('*').order('sort_order').then(({ data }: { data: any }) => setTopics(data || []))
    supabase.from('question_flags')
      .select('*, question:questions(question_text, image_url)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) console.error('[Admin] Failed to load reported issues:', error.message)
        setFlags(data || [])
      })
  }, [])

  const emptyForm = {
    question_text: '', options: ['', '', '', '', ''] as string[],
    correct_answer: 0, explanation: '',
    topic_id: '', subtopic: '', difficulty: 'medium',
    question_type: 'single_best_answer', source: '',
    image_url: '', explanation_image_url: '', status: 'draft', reviewed: false,
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
      explanation_image_url: q.explanation_image_url || '',
      status: q.status || 'draft', reviewed: q.reviewed || false,
    })
    setEditing(q.id)
  }

  const duplicateQuestion = (q: any) => {
    const opts = Array.isArray(q.options) ? q.options : ['', '', '', '', '']
    setForm({
      question_text: q.question_text || '', options: opts,
      correct_answer: q.correct_answer ?? 0, explanation: q.explanation || '',
      topic_id: q.topic_id || '', subtopic: q.subtopic || '',
      difficulty: q.difficulty || 'medium', question_type: q.question_type || 'single_best_answer',
      source: q.source || '', image_url: q.image_url || '',
      explanation_image_url: q.explanation_image_url || '',
      status: 'draft', reviewed: false,
    })
    setEditing('new')
    showToast('Duplicated — edit and save as new question')
  }

  const handleSave = async () => {
    if (!form.question_text) { showToast('Question text is required', 'error'); return }
    const validOpts = form.options.filter(o => o.trim())
    if (validOpts.length < 2) { showToast('At least 2 options required', 'error'); return }
    if (form.correct_answer >= validOpts.length) { showToast('Please select a valid correct answer', 'error'); return }
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
        explanation_image_url: form.explanation_image_url || null,
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
    if (!confirm('Delete this question? This cannot be undone.')) return
    setDeleting(id)
    try { await remove(id); showToast('Question deleted') } catch (err: any) { showToast(err.message, 'error') }
    setDeleting(null)
  }

  const resolveFlag = async (flagId: string, note?: string) => {
    const supabase = createClient()
    await supabase.from('question_flags').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      admin_notes: note || null,
    }).eq('id', flagId)
    setFlags(flags.filter(f => f.id !== flagId))
    setExpandedFlag(null)
    setAdminNote('')
    showToast('Issue resolved')
  }

  const dismissFlag = async (flagId: string, note?: string) => {
    const supabase = createClient()
    await supabase.from('question_flags').update({
      status: 'dismissed',
      resolved_at: new Date().toISOString(),
      admin_notes: note || null,
    }).eq('id', flagId)
    setFlags(flags.filter(f => f.id !== flagId))
    setExpandedFlag(null)
    setAdminNote('')
    showToast('Issue dismissed')
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
    if (filterStatus && q.status !== filterStatus) return false
    return true
  })

  const counts = {
    published: questions.filter((q: any) => q.status === 'published').length,
    draft: questions.filter((q: any) => q.status === 'draft').length,
    archived: questions.filter((q: any) => q.status === 'archived').length,
    withImages: questions.filter((q: any) => q.image_url).length,
  }

  // Build a set of question IDs that have open flags for inline marking
  const flaggedQuestionIds = new Set(flags.map((f: any) => f.question_id))

  return (
    <div style={{ fontFamily: 'Montserrat, -apple-system, sans-serif' }}>
      {toast && <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 200, padding: '12px 20px', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: toast.type === 'ok' ? '#16a34a' : '#DB2424' }}>{toast.msg}</div>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F1F3D' }}>Question Bank</h1>
          <p style={{ fontSize: 14, color: '#504F58', marginTop: 4 }}>
            {questions.length} questions · {counts.published} published · {counts.draft} drafts · {counts.withImages} with images
          </p>
        </div>
        <button onClick={openNew} className="hidden sm:flex" style={{ ...S.btn }}><Plus size={16} strokeWidth={2.5} /> Add Question</button>
      </div>

      {/* ══ REPORTED ISSUES BANNER ══════════════════════════════════ */}
      {/* Always visible when flags exist — impossible to miss */}
      {flags.length > 0 && (
        <div style={{ marginBottom: 24, borderRadius: 16, border: '2px solid #FECACA', background: '#FEF2F2', overflow: 'hidden' }}>
          {/* Banner header — always visible */}
          <button
            onClick={() => setShowFlags(!showFlags)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flag size={18} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#991B1B' }}>
                  {flags.length} Reported Issue{flags.length > 1 ? 's' : ''} Requiring Review
                </p>
                <p style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                  Members have reported {flags.length} question{flags.length > 1 ? 's' : ''} as having issues — click to expand and review
                </p>
              </div>
            </div>
            <ChevronDown size={20} style={{ color: '#DC2626', transition: 'transform 0.2s', transform: showFlags ? 'rotate(180deg)' : 'rotate(0)' }} />
          </button>

          {/* Expanded flag list */}
          {showFlags && (
            <div style={{ borderTop: '1px solid #FECACA', padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                {flags.map((f: any) => {
                  const reason = FLAG_REASONS[f.reason] || FLAG_REASONS.other
                  const isExpanded = expandedFlag === f.id
                  return (
                    <div key={f.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E4E4E8', overflow: 'hidden' }}>
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={S.badge(reason.bg, reason.color)}>{reason.label}</span>
                          </div>
                          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{new Date(f.created_at).toLocaleDateString('en-GB')}</span>
                        </div>

                        <p style={{ fontSize: 14, color: '#181820', marginBottom: 6, fontWeight: 500 }}>
                          {f.question?.image_url && <ImageIcon size={14} style={{ display: 'inline', marginRight: 6, color: '#C49A6C', verticalAlign: 'text-bottom' }} />}
                          {f.question?.question_text?.slice(0, 150)}{(f.question?.question_text?.length || 0) > 150 ? '...' : ''}
                        </p>

                        {f.details && (
                          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F9FAFB', border: '1px solid #E4E4E8', marginBottom: 12 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#504F58', marginBottom: 4 }}>User&apos;s report:</p>
                            <p style={{ fontSize: 13, color: '#181820', lineHeight: 1.5 }}>{f.details}</p>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => {
                            const q = questions.find((x: any) => x.id === f.question_id)
                            if (q) openEdit(q)
                          }} style={S.btnOutline}>
                            <Edit size={14} /> Edit Question
                          </button>
                          <button onClick={() => { setExpandedFlag(isExpanded ? null : f.id); setAdminNote('') }}
                            style={{ ...S.btnOutline, color: isExpanded ? '#DC2626' : '#504F58' }}>
                            <MessageSquare size={14} /> {isExpanded ? 'Cancel' : 'Respond'}
                          </button>
                          <button onClick={() => resolveFlag(f.id)} style={{ ...S.btnOutline, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>
                            <Check size={14} /> Resolve
                          </button>
                          <button onClick={() => dismissFlag(f.id)} style={{ ...S.btnOutline, color: '#888' }}>
                            Dismiss
                          </button>
                        </div>
                      </div>

                      {/* Expanded admin response */}
                      {isExpanded && (
                        <div style={{ padding: '16px 16px', borderTop: '1px solid #E4E4E8', background: '#FAFAFA' }}>
                          <label style={{ ...S.label, fontSize: 12 }}>Admin Note (optional — visible to the reporting user)</label>
                          <textarea
                            style={{ ...S.textarea, minHeight: 70 }}
                            value={adminNote}
                            onChange={e => setAdminNote(e.target.value)}
                            placeholder="e.g. 'Thanks for reporting — the correct answer has been updated to B' or 'This is actually correct per NICE guidelines CG131...'"
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button onClick={() => resolveFlag(f.id, adminNote)} style={{ ...S.btn, background: '#16a34a', fontSize: 13, padding: '8px 16px' }}>
                              <Check size={14} /> Resolve with Note
                            </button>
                            <button onClick={() => dismissFlag(f.id, adminNote)} style={{ ...S.btnOutline, fontSize: 13 }}>
                              Dismiss with Note
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ FILTERS ════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 340 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input style={{ ...S.input, paddingLeft: 36 }} placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
        <select style={{ ...S.select, maxWidth: 150 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'published' ? counts.published : s === 'draft' ? counts.draft : counts.archived})</option>)}
        </select>
        {(search || filterTopic || filterDiff || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterTopic(''); setFilterDiff(''); setFilterStatus('') }}
            style={{ ...S.btnOutline, color: '#DC2626', borderColor: '#FCA5A5' }}>
            <X size={14} /> Clear Filters
          </button>
        )}
      </div>

      {/* ══ QUESTIONS TABLE ════════════════════════════════════════ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Loader className="animate-spin" size={28} color="#D1D1D6" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', padding: '80px 20px', textAlign: 'center' }}>
          <FileText size={40} color="#D1D1D6" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#181820' }}>No questions found</p>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{search || filterTopic || filterDiff || filterStatus ? 'Try adjusting your filters' : 'Add your first question to get started'}</p>
        </div>
      ) : (
        {/* Desktop table */}
        <div className="hidden md:block" style={{ background: '#fff', borderRadius: 16, border: '1px solid #D1D1D6', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #F1F1F3' }}>
                {['Question', 'Topic', 'Difficulty', 'Type', 'Stats', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#504F58', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((q: any) => {
                const isFlagged = flaggedQuestionIds.has(q.id)
                return (
                  <tr key={q.id}
                    style={{
                      borderBottom: '1px solid #F1F1F3',
                      background: isFlagged ? '#FEF2F2' : undefined,
                    }}
                    onDoubleClick={() => openEdit(q)}
                  >
                    <td style={{ padding: '14px 16px', maxWidth: 300 }}>
                      <div style={{ fontWeight: 500, color: '#181820', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isFlagged && <span title="This question has a reported issue from a member"><Flag size={14} style={{ color: '#DC2626', flexShrink: 0 }} /></span>}
                        {q.image_url && <ImageIcon size={14} style={{ color: '#C49A6C', flexShrink: 0 }} />}
                        {q.question_text}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#504F58', fontSize: 13 }}>{getTopicName(q.topic_id)}</td>
                    <td style={{ padding: '14px 16px' }}><span style={diffBadge(q.difficulty)}>{q.difficulty}</span></td>
                    <td style={{ padding: '14px 16px' }}><span style={S.badge('#F5F3FF', '#7C3AED')}>{q.question_type?.replace(/_/g, ' ')}</span></td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#504F58' }}>
                      {q.times_attempted > 0 ? `${q.times_attempted} attempts · ${Math.round(q.average_score || 0)}%` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={S.badge(q.status === 'published' ? '#f0fdf4' : q.status === 'archived' ? '#F3F4F6' : '#fefce8', q.status === 'published' ? '#16a34a' : q.status === 'archived' ? '#666' : '#a16207')}>{q.status}</span>
                        {q.reviewed && <span style={S.badge('#EFF6FF', '#2563EB')}>✓</span>}
                        {isFlagged && <span style={S.badge('#FEF2F2', '#DC2626')}>reported</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <button onClick={() => openEdit(q)} title="Edit" style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Edit size={16} /></button>
                        <button onClick={() => duplicateQuestion(q)} title="Duplicate" style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Copy size={16} /></button>
                        <button onClick={() => handleDelete(q.id)} title="Delete" disabled={deleting === q.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}>
                          {deleting === q.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F1F3', fontSize: 12, color: '#888' }}>
            Showing {filtered.length} of {questions.length} questions
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((q: any) => {
            const isFlagged = flaggedQuestionIds.has(q.id)
            return (
              <div key={q.id} style={{ background: isFlagged ? '#FEF2F2' : '#fff', borderRadius: 12, border: `1px solid ${isFlagged ? '#FECACA' : '#D1D1D6'}`, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: '#181820', fontSize: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {isFlagged && <Flag size={14} style={{ color: '#DC2626', display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />}
                      {q.image_url && <ImageIcon size={14} style={{ color: '#C49A6C', display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />}
                      {q.question_text}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => openEdit(q)} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#504F58' }}><Edit size={16} /></button>
                    <button onClick={() => handleDelete(q.id)} disabled={deleting === q.id} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6' }}>
                      {deleting === q.id ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={diffBadge(q.difficulty)}>{q.difficulty}</span>
                  <span style={S.badge(q.status === 'published' ? '#f0fdf4' : q.status === 'archived' ? '#F3F4F6' : '#fefce8', q.status === 'published' ? '#16a34a' : q.status === 'archived' ? '#666' : '#a16207')}>{q.status}</span>
                  {q.reviewed && <span style={S.badge('#EFF6FF', '#2563EB')}>✓</span>}
                  {isFlagged && <span style={S.badge('#FEF2F2', '#DC2626')}>reported</span>}
                  <span style={{ fontSize: 11, color: '#888' }}>{getTopicName(q.topic_id)}</span>
                </div>
              </div>
            )
          })}
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 8 }}>
            Showing {filtered.length} of {questions.length} questions
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <button onClick={openNew} className="sm:hidden fixed bottom-[4.5rem] right-4 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center" style={{ ...S.btn, padding: 0, borderRadius: '50%' }}>
        <Plus size={24} />
      </button>

      {/* ── Preview ──────────────────────────────── */}
      {previewing && editing !== null && (
        <QuestionPreview form={form} topics={topics} onClose={() => setPreviewing(false)} />
      )}

      {/* ── Edit Modal ─────────────────────────────── */}
      {editing !== null && !previewing && (
        <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #E4E4E8' }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F1F3D' }}>{editing === 'new' ? 'Add Question' : 'Edit Question'}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setPreviewing(true)} style={S.btnOutline} title="Preview how students will see this question">
                  <Eye size={14} /> Preview
                </button>
                <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D1D6', padding: 4 }}><X size={20} /></button>
              </div>
            </div>
            <div className="p-4 sm:px-7 sm:py-6" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

              {/* Question image */}
              <ImageUploadBox value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="questions" label="Question Image (clinical photos, radiology, diagrams)" />

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

              {/* Explanation image */}
              <ImageUploadBox value={form.explanation_image_url} onChange={(url) => setForm({ ...form, explanation_image_url: url })} folder="questions/explanations" label="Explanation Image (optional — diagrams, algorithms, reference images)" height={120} />

              {/* Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3.5 sm:items-end">
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