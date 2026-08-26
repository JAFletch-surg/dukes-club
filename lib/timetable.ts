/* ══════════════════════════════════════════════════════════════════
   TIMETABLE — event schedules, one row per session

   A row is a time, a session title, and any number of bullet points
   underneath it (the talks or speakers inside that session):

     10:00 – 12:00   Session 2 — The Subspecialty Round-Up
                       • Oroog Ali — Abdominal wall reconstruction
                       • Wes Lai — Proctology and pelvic floor

   Admins type that shape straight into one box — title on the first
   line, bullets on the lines below — so these helpers convert between
   the text an admin edits and the stored `{ time, title, items }`.

   Rows saved before bullets existed have no `items`, and legacy flat
   timetables have no days; normaliseTimetable() lifts both into the
   current shape so callers only ever see one format.
   ══════════════════════════════════════════════════════════════════ */

export interface TimetableEntry {
  time: string
  title: string
  /** Bullet points shown under the title. Absent on older rows. */
  items?: string[]
}

export interface TimetableDay {
  day: string
  label: string
  entries: TimetableEntry[]
}

/* A line that opens with a bullet marker — "-", "•", "1." and friends.
   The marker is dropped; what follows is the bullet's text. */
const BULLET_LINE = /^\s*(?:[-–—*•·▪▫◦o]|\d+[.)])\s+(.*)$/

/* Word and Google Docs flatten a bullet list into one line joined by
   "·" or "•" when it is pasted into a single-line input. Anything that
   still looks like that gets folded back out into separate lines. */
const INLINE_BULLET = /\s+[•·▪▫◦]\s*/g

/* "Tamzin Cumming — Excellence in AIN management" → the name is the
   lead-in and gets emphasis, the talk title is the remainder. Matches
   an em/en dash, a spaced hyphen, or a colon followed by a space. */
const BULLET_LEAD = /^(.{2,60}?)(?:\s*[—–]\s*|\s+-\s*|:\s+)(\S.*)$/

const asText = (v: unknown) => (v == null ? '' : String(v))

const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, '').trim()

/** Split one bullet into its emphasised lead-in and the rest, if it has
 *  one. `lead` is null when the bullet is a single run of text. */
export function splitBulletLead(item: string): { lead: string | null; rest: string } {
  const m = item.match(BULLET_LEAD)
  if (!m) return { lead: null, rest: item }
  return { lead: m[1].trim(), rest: m[2].trim() }
}

/** Text an admin typed into one session box → title + bullets. The
 *  first line is the title unless it is itself bulleted, in which case
 *  the row is all bullets and has no title. */
export function parseEntryText(text: string): { title: string; items: string[] } {
  const lines = text
    .replace(INLINE_BULLET, '\n• ')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return { title: '', items: [] }

  const first = lines[0].match(BULLET_LINE)
  const title = first ? '' : lines[0]
  const rest = first ? lines : lines.slice(1)
  const items = rest
    .map(l => (l.match(BULLET_LINE)?.[1] ?? l).trim())
    .filter(Boolean)

  return { title, items }
}

/** Inverse of parseEntryText — the editable text for one session. */
export function entryToText(entry: TimetableEntry): string {
  const items = entry.items ?? []
  return [entry.title, ...items.map(i => `- ${i}`)].filter(Boolean).join('\n')
}

/** Parse pasted/uploaded `time, title` rows. A row with an empty time
 *  column, or a line that is just a bullet, extends the row above it —
 *  which is how a session with several talks arrives from a CSV. */
export function parseTimetableCSV(text: string): TimetableEntry[] {
  const entries: TimetableEntry[] = []

  const addItems = (items: string[]) => {
    if (items.length === 0) return
    const last = entries[entries.length - 1]
    if (last) last.items = [...(last.items ?? []), ...items]
    else entries.push({ time: '', title: '', items })
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    // A bare bullet line carries no time column at all.
    if (BULLET_LINE.test(line) && !line.includes('\t') && !line.includes(',')) {
      addItems(parseEntryText(line).items)
      continue
    }

    const sep = line.includes('\t') ? '\t' : ','
    const parts = line.split(sep).map(stripQuotes)
    if (parts.length < 2) continue

    const time = parts[0]
    if (/^(time|start)$/i.test(time)) continue

    const cell = parts.slice(1).join(sep === '\t' ? ' ' : ', ')
    const { title, items } = parseEntryText(cell)

    // No time means this row belongs to the session above it.
    if (!time) {
      addItems([title, ...items].filter(Boolean))
      continue
    }

    entries.push(items.length > 0 ? { time, title, items } : { time, title })
  }

  return entries
}

/** Coerce one stored row into the current shape, whatever its age. */
function normaliseEntry(raw: unknown): TimetableEntry {
  const row = (raw ?? {}) as Record<string, unknown>
  const items = Array.isArray(row.items)
    ? row.items.map(i => asText(i).trim()).filter(Boolean)
    : []
  const entry: TimetableEntry = { time: asText(row.time), title: asText(row.title) }
  if (items.length > 0) entry.items = items
  return entry
}

/** Stored timetable → days. Accepts the multi-day shape, the legacy
 *  flat list of rows (wrapped into a single day), and null. */
export function normaliseTimetable(raw: unknown, startsAt?: string): TimetableDay[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const rows = raw as unknown[]

  const first = rows[0]
  if (first && typeof first === 'object' && 'entries' in first) {
    return rows.map(r => {
      const d = (r ?? {}) as Record<string, unknown>
      return {
        day: asText(d.day),
        label: asText(d.label),
        entries: Array.isArray(d.entries) ? d.entries.map(normaliseEntry) : [],
      }
    })
  }

  const day = startsAt ? startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  return [{ day, label: '', entries: rows.map(normaliseEntry) }]
}

/** Days ready for storage — blank rows and blank days dropped. Returns
 *  null for an empty timetable so the column stays clean. */
export function serialiseTimetable(days: TimetableDay[]): TimetableDay[] | null {
  const cleaned = days
    .map(d => ({
      ...d,
      entries: d.entries
        .map(normaliseEntry)
        .filter(e => e.time || e.title || (e.items?.length ?? 0) > 0),
    }))
    .filter(d => d.entries.length > 0)

  return cleaned.length > 0 ? cleaned : null
}
