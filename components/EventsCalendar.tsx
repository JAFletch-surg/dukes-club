'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react'

// ── Types ────────────────────────────────────────
interface DukesEvent {
  id: string
  title: string
  slug: string
  starts_at: string
  ends_at?: string | null
  location: string
  event_type: string
  price_pence: number | null
}

interface CalendarDate {
  id: string
  title: string
  description?: string | null
  start_date: string
  end_date?: string | null
  category: string
  url?: string | null
  is_members_only: boolean
}

interface EventsCalendarProps {
  events: DukesEvent[]
  calendarDates: CalendarDate[]
  isLoggedIn?: boolean
  theme?: 'dark' | 'light'
}

// ── Helpers ──────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function isInRange(date: Date, start: Date, end: Date | null) {
  if (!end) return isSameDay(date, start)
  const d = date.getTime()
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return d >= s && d <= e
}

function formatPrice(pence: number | null) {
  if (!pence || pence === 0) return 'Free'
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}

// ── Category styles ──────────────────────────────
const catStyles: Record<string, { bg: string; text: string; border: string; label: string; barColor: string }> = {
  dukes:      { bg: 'bg-gold/15',       text: 'text-gold',        border: 'border-gold/30',      label: "Dukes' Club",  barColor: 'bg-gold' },
  exam:       { bg: 'bg-red-500/15',    text: 'text-red-500',     border: 'border-red-500/30',   label: 'FRCS Exam',    barColor: 'bg-red-500' },
  deadline:   { bg: 'bg-amber-500/15',  text: 'text-amber-500',   border: 'border-amber-500/30', label: 'Deadline',     barColor: 'bg-amber-500' },
  conference: { bg: 'bg-blue-500/15',   text: 'text-blue-500',    border: 'border-blue-500/30',  label: 'Conference',   barColor: 'bg-blue-500' },
  external:   { bg: 'bg-purple-500/15', text: 'text-purple-500',  border: 'border-purple-500/30',label: 'External',     barColor: 'bg-purple-500' },
}

function getStyle(cat: string) {
  return catStyles[cat] || catStyles.external
}

// ── Theme tokens ─────────────────────────────────
const themes = {
  dark: {
    wrapper: 'rounded-xl border border-navy-foreground/20 bg-navy-foreground/[0.03]',
    headerBorder: 'border-navy-foreground/10',
    title: 'text-navy-foreground',
    todayBtn: 'text-gold hover:text-gold/80',
    navBtn: 'hover:bg-navy-foreground/10 text-navy-foreground/50 hover:text-navy-foreground',
    legendDot: 'border',
    legendText: 'text-navy-foreground/40',
    dayHeader: 'text-navy-foreground/25',
    dayNum: 'text-navy-foreground/50',
    dayNumToday: 'text-gold',
    cellHover: 'hover:bg-navy-foreground/[0.06]',
    cellToday: 'bg-navy-foreground/[0.06]',
    cellSelected: 'bg-gold/15 ring-1 ring-gold/50',
    overflow: 'text-navy-foreground/30',
    detailDate: 'text-navy-foreground/30',
    detailMeta: 'text-navy-foreground/40',
  },
  light: {
    wrapper: 'rounded-xl border border-border bg-background',
    headerBorder: 'border-border',
    title: 'text-foreground',
    todayBtn: 'text-gold hover:text-gold/80',
    navBtn: 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
    legendDot: 'border',
    legendText: 'text-muted-foreground',
    dayHeader: 'text-muted-foreground/50',
    dayNum: 'text-foreground/60',
    dayNumToday: 'text-gold',
    cellHover: 'hover:bg-muted/30',
    cellToday: 'bg-muted/30',
    cellSelected: 'bg-gold/10 ring-1 ring-gold/40',
    overflow: 'text-muted-foreground/50',
    detailDate: 'text-muted-foreground',
    detailMeta: 'text-muted-foreground',
  },
}

// ── Component ────────────────────────────────────
export default function EventsCalendar({ events, calendarDates, isLoggedIn = false, theme = 'dark' }: EventsCalendarProps) {
  const t = themes[theme]
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelectedDate(null)
  }

  // Build unified items
  const allItems = useMemo(() => {
    const items: { type: 'dukes' | 'calendar'; date: Date; endDate: Date | null; category: string; data: any }[] = []

    events.forEach(ev => {
      items.push({ type: 'dukes', date: new Date(ev.starts_at), endDate: ev.ends_at ? new Date(ev.ends_at) : null, category: 'dukes', data: ev })
    })

    calendarDates
      .filter(cd => !cd.is_members_only || isLoggedIn)
      .forEach(cd => {
        items.push({
          type: 'calendar',
          date: new Date(cd.start_date + 'T00:00:00'),
          endDate: cd.end_date ? new Date(cd.end_date + 'T00:00:00') : null,
          category: cd.category,
          data: cd,
        })
      })

    return items
  }, [events, calendarDates, isLoggedIn])

  const getItemsForDay = (day: number) => {
    const date = new Date(year, month, day)
    return allItems.filter(item => isInRange(date, item.date, item.endDate))
  }

  const selectedItems = selectedDate ? allItems.filter(item => isInRange(selectedDate, item.date, item.endDate)) : []

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  return (
    <div className={t.wrapper + ' overflow-hidden'}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b ${t.headerBorder}`}>
        <div className="flex items-center gap-3">
          <h3 className={`text-base font-bold ${t.title}`}>{MONTHS[month]} {year}</h3>
          <button onClick={goToday} className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${t.todayBtn}`}>
            Today
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={prev} className={`p-1.5 rounded-md transition-colors ${t.navBtn}`}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} className={`p-1.5 rounded-md transition-colors ${t.navBtn}`}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className={`px-4 sm:px-5 py-2 border-b ${t.headerBorder} flex flex-wrap gap-3 sm:gap-5`}>
        {Object.entries(catStyles).map(([key, style]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${style.bg} ${style.border} ${t.legendDot}`} />
            <span className={`text-[10px] font-medium ${t.legendText}`}>{style.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="p-2 sm:p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className={`text-center text-[10px] font-bold uppercase tracking-wider py-1 ${t.dayHeader}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-px">
          {/* Empty cells */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[72px]" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const date = new Date(year, month, day)
            const isToday = isSameDay(date, today)
            const items = getItemsForDay(day)
            const hasItems = items.length > 0
            const isSelected = selectedDate && isSameDay(date, selectedDate)

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(hasItems ? (isSelected ? null : date) : null)}
                className={`min-h-[60px] sm:min-h-[72px] p-1 rounded-lg transition-all duration-150 text-left flex flex-col
                  ${isSelected ? t.cellSelected : ''}
                  ${isToday && !isSelected ? t.cellToday : ''}
                  ${hasItems ? `cursor-pointer ${t.cellHover}` : 'cursor-default'}
                `}
              >
                {/* Day number */}
                <span className={`text-xs leading-none mb-0.5 px-0.5 font-medium
                  ${isToday ? `font-bold ${t.dayNumToday}` : t.dayNum}
                  ${isSelected ? `${t.dayNumToday} font-bold` : ''}
                `}>
                  {day}
                </span>

                {/* Event chips */}
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {items.slice(0, 2).map((item, idx) => {
                    const style = getStyle(item.category)
                    return (
                      <div
                        key={idx}
                        className={`${style.bg} ${style.text} border ${style.border} rounded px-1 py-px truncate text-[9px] sm:text-[10px] font-semibold leading-tight ${idx >= 1 ? 'hidden sm:block' : ''}`}
                      >
                        {item.data.title}
                      </div>
                    )
                  })}
                  {items.length > 2 && (
                    <span className={`text-[9px] font-medium px-0.5 hidden sm:block ${t.overflow}`}>
                      +{items.length - 2} more
                    </span>
                  )}
                  {items.length > 1 && (
                    <span className={`text-[9px] font-medium px-0.5 sm:hidden ${t.overflow}`}>
                      +{items.length - 1}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected date detail panel */}
      {selectedDate && selectedItems.length > 0 && (
        <div className={`border-t ${t.headerBorder} px-4 sm:px-5 py-4 space-y-2.5`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${t.detailDate}`}>
            {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {selectedItems.map((item, i) => {
            const style = getStyle(item.category)

            if (item.type === 'dukes') {
              const ev = item.data as DukesEvent
              return (
                <Link
                  key={`d-${i}`}
                  href={`/events/${ev.slug}`}
                  className={`flex items-center gap-3 p-3 rounded-lg ${style.bg} border ${style.border} hover:opacity-80 transition-opacity`}
                >
                  <div className={`w-1 h-8 rounded-full ${style.barColor} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${style.text} truncate`}>{ev.title}</p>
                    <div className={`flex items-center gap-2 text-[11px] mt-0.5 ${t.detailMeta}`}>
                      <span>{ev.event_type}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><MapPin size={9} />{ev.location?.split(',')[0]}</span>
                      {ev.price_pence != null && <><span>·</span><span>{formatPrice(ev.price_pence)}</span></>}
                    </div>
                  </div>
                </Link>
              )
            } else {
              const cd = item.data as CalendarDate
              const inner = (
                <div className={`flex items-center gap-3 p-3 rounded-lg ${style.bg} border ${style.border} ${cd.url ? 'hover:opacity-80 transition-opacity' : ''}`}>
                  <div className={`w-1 h-8 rounded-full ${style.barColor} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${style.text} truncate`}>{cd.title}</p>
                      {cd.url && <ExternalLink size={11} className={style.text} />}
                    </div>
                    <div className={`flex items-center gap-2 text-[11px] mt-0.5 ${t.detailMeta}`}>
                      <span>{getStyle(cd.category).label}</span>
                      {cd.end_date && cd.end_date !== cd.start_date && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(cd.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {new Date(cd.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
              return cd.url ? (
                <a key={`c-${i}`} href={cd.url} target="_blank" rel="noopener noreferrer">{inner}</a>
              ) : (
                <div key={`c-${i}`}>{inner}</div>
              )
            }
          })}
        </div>
      )}
    </div>
  )
}