'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Radio, Search, Play, Eye, Clock, ExternalLink,
  Calendar, X, Loader2, Check, Users, Video, Copy,
  CheckCheck, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/use-auth'
import { sendEmail } from '@/lib/emails/send-email'

// ─── Types ───────────────────────────────────────────

interface WebinarEvent {
  id: string
  title: string
  slug: string
  description_plain: string | null
  starts_at: string
  ends_at: string | null
  event_type: string
  stream_type: string | null
  zoom_url: string | null
  zoom_meeting_id: string | null
  zoom_passcode: string | null
  vimeo_live_embed_url: string | null
  access_level: string | null
  capacity: number | null
  featured_image_url: string | null
  subspecialties: string[] | null
  auto_approve: boolean
  speakers: string[]
  booking?: { id: string; status: string } | null
  booking_count: number
}

interface WebinarVideo {
  id: string
  title: string
  thumbnail_url: string | null
  vimeo_plays: number
  duration_seconds: number
}

// ─── Helpers ─────────────────────────────────────────

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const formatDateTime = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const getCountdown = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Starting soon'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

const STREAMING_TYPES = ['Webinar', 'Online Lecture', 'Hybrid']

// ─── Page ────────────────────────────────────────────

export default function LiveWebinars() {
  const { user, profile } = useAuth()
  const supabase = createClient()

  const [events, setEvents] = useState<WebinarEvent[]>([])
  const [videos, setVideos] = useState<WebinarVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [registeringId, setRegisteringId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // ── Load data ──────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return

    // Fetch webinar-type events
    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title, slug, description_plain, starts_at, ends_at, event_type, stream_type, zoom_url, zoom_meeting_id, zoom_passcode, vimeo_live_embed_url, access_level, capacity, featured_image_url, subspecialties, auto_approve')
      .eq('status', 'published')
      .in('event_type', STREAMING_TYPES)
      .order('starts_at', { ascending: false })

    if (!eventsData) { setLoading(false); return }

    // Fetch user's bookings for these events
    const eventIds = eventsData.map(e => e.id)
    const { data: bookings } = await supabase
      .from('event_bookings')
      .select('id, event_id, status')
      .eq('user_id', user.id)
      .in('event_id', eventIds)
      .neq('status', 'cancelled')

    // Fetch booking counts per event
    const { data: bookingCounts } = await supabase
      .from('event_bookings')
      .select('event_id')
      .in('event_id', eventIds)
      .in('status', ['approved', 'confirmed', 'pending'])

    const countMap: Record<string, number> = {}
    bookingCounts?.forEach((b: any) => {
      countMap[b.event_id] = (countMap[b.event_id] || 0) + 1
    })

    // Fetch faculty/speakers for each event
    const { data: facultyData } = await supabase
      .from('event_faculty')
      .select('event_id, faculty:faculty_id(full_name)')
      .in('event_id', eventIds)

    const speakerMap: Record<string, string[]> = {}
    facultyData?.forEach((f: any) => {
      const name = f.faculty?.full_name
      if (name) {
        if (!speakerMap[f.event_id]) speakerMap[f.event_id] = []
        speakerMap[f.event_id].push(name)
      }
    })

    // Merge
    const enriched: WebinarEvent[] = eventsData.map(e => ({
      ...e,
      speakers: speakerMap[e.id] || [],
      booking: bookings?.find((b: any) => b.event_id === e.id) || null,
      booking_count: countMap[e.id] || 0,
    }))

    setEvents(enriched)

    // Fetch webinar recordings from videos table
    const { data: vids } = await supabase
      .from('videos')
      .select('id, title, thumbnail_url, vimeo_plays, duration_seconds')
      .eq('category', 'Webinar')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20)

    setVideos(vids || [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // ── Register for webinar ───────────────────────────

  const handleRegister = async (event: WebinarEvent) => {
    if (!user || !profile) return
    setRegisteringId(event.id)

    const status = event.auto_approve ? 'approved' : 'pending'

    const { data: booking, error } = await supabase.from('event_bookings').insert({
      event_id: event.id,
      user_id: user.id,
      applicant_name: profile.full_name || user.email?.split('@')[0] || 'Unknown',
      applicant_email: user.email || '',
      applicant_training_level: profile.training_stage || '',
      applicant_hospital: (profile as any)?.hospital || '',
      applicant_deanery: profile.region || '',
      status,
    }).select('id, status').single()

    if (!error && booking) {
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, booking: { id: booking.id, status: booking.status }, booking_count: e.booking_count + 1 } : e
      ))

      // Send confirmation email (non-blocking)
      const eventDate = new Date(event.starts_at).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
      sendEmail({
        type: 'booking_confirmation',
        to: user.email || '',
        data: {
          name: profile.full_name || 'Member',
          eventTitle: event.title,
          eventDate,
          eventLocation: 'Online',
          status,
        },
      }).catch(err => console.error('Booking email failed:', err))
    }

    setRegisteringId(null)
  }

  // ── Cancel booking ─────────────────────────────────

  const handleCancel = async (event: WebinarEvent) => {
    if (!event.booking) return
    setCancellingId(event.id)

    const { error } = await supabase
      .from('event_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', event.booking.id)

    if (!error) {
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, booking: null, booking_count: Math.max(0, e.booking_count - 1) } : e
      ))
    }

    setCancellingId(null)
  }

  // ── Copy to clipboard ──────────────────────────────

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── Filtering ──────────────────────────────────────

  const toggleTag = (tag: string) =>
    setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag])

  const now = new Date()

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    events.forEach(e => e.subspecialties?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [events])

  const filtered = useMemo(() => {
    return events.filter(e => {
      const s = search.toLowerCase()
      const matchesSearch = !s || e.title.toLowerCase().includes(s) || e.speakers.some(sp => sp.toLowerCase().includes(s))
      const isUpcoming = new Date(e.starts_at) >= now
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'upcoming' ? isUpcoming : !isUpcoming)
      const matchesTags = selectedTags.length === 0 || selectedTags.some(t => e.subspecialties?.includes(t))
      return matchesSearch && matchesStatus && matchesTags
    })
  }, [events, search, statusFilter, selectedTags])

  const upcoming = filtered.filter(e => new Date(e.starts_at) >= now).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  const past = filtered.filter(e => new Date(e.starts_at) < now)

  // ── Loading / empty states ─────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Live Webinars</h1>
        <p className="text-muted-foreground mt-1">Join live educational sessions and watch past recordings</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search webinars..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(['all', 'upcoming', 'past'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s ? 'bg-navy text-navy-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground font-medium">Tags:</span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  selectedTags.includes(tag) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button onClick={() => setSelectedTags([])} className="text-xs text-primary hover:underline flex items-center gap-1">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Webinars */}
      {(statusFilter === 'all' || statusFilter === 'upcoming') && upcoming.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Upcoming Webinars</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {upcoming.map(event => {
              const isApproved = event.booking && ['approved', 'confirmed'].includes(event.booking.status)
              const isPending = event.booking?.status === 'pending'
              const hasBooking = !!event.booking
              const spotsLeft = event.capacity ? event.capacity - event.booking_count : null

              return (
                <Card key={event.id} className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground leading-snug">{event.title}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {event.stream_type === 'vimeo_live' ? 'Vimeo Live' : event.stream_type === 'hybrid' ? 'Hybrid' : 'Zoom'}
                      </Badge>
                    </div>

                    {event.speakers.length > 0 && (
                      <p className="text-xs text-muted-foreground">{event.speakers.join(', ')}</p>
                    )}

                    {event.description_plain && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{event.description_plain}</p>
                    )}

                    {event.subspecialties && event.subspecialties.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {event.subspecialties.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar size={12} />
                        <span>{formatDateTime(event.starts_at)}</span>
                      </div>
                      <Badge className="text-[10px] bg-gold/10 text-gold border-gold/30" variant="outline">
                        <Clock size={10} className="mr-1" /> {getCountdown(event.starts_at)}
                      </Badge>
                    </div>

                    {/* Capacity */}
                    {spotsLeft !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users size={12} />
                        <span>{spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'Full'}</span>
                      </div>
                    )}

                    {/* CTA section */}
                    <div className="space-y-2">
                      {/* Zoom/Vimeo join details for approved attendees */}
                      {isApproved && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Check size={13} className="text-green-600" /> You&apos;re registered
                          </p>

                          {event.zoom_url && (
                            <a
                              href={event.zoom_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-navy text-navy-foreground text-sm font-semibold hover:bg-navy/90 transition-colors"
                            >
                              <ExternalLink size={14} /> Join on Zoom
                            </a>
                          )}

                          {event.zoom_meeting_id && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Meeting ID: <span className="font-mono text-foreground">{event.zoom_meeting_id}</span></span>
                              <button onClick={() => handleCopy(event.zoom_meeting_id!, `mid-${event.id}`)} className="text-muted-foreground hover:text-foreground">
                                {copiedField === `mid-${event.id}` ? <CheckCheck size={13} className="text-green-600" /> : <Copy size={13} />}
                              </button>
                            </div>
                          )}

                          {event.zoom_passcode && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Passcode: <span className="font-mono text-foreground">{event.zoom_passcode}</span></span>
                              <button onClick={() => handleCopy(event.zoom_passcode!, `pc-${event.id}`)} className="text-muted-foreground hover:text-foreground">
                                {copiedField === `pc-${event.id}` ? <CheckCheck size={13} className="text-green-600" /> : <Copy size={13} />}
                              </button>
                            </div>
                          )}

                          {event.vimeo_live_embed_url && !event.zoom_url && (
                            <a
                              href={event.vimeo_live_embed_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-navy text-navy-foreground text-sm font-semibold hover:bg-navy/90 transition-colors"
                            >
                              <Play size={14} /> Watch Live
                            </a>
                          )}

                          <button
                            onClick={() => handleCancel(event)}
                            disabled={cancellingId === event.id}
                            className="text-[11px] text-destructive hover:underline"
                          >
                            {cancellingId === event.id ? 'Cancelling...' : 'Cancel registration'}
                          </button>
                        </div>
                      )}

                      {/* Pending status */}
                      {isPending && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                            <Clock size={13} /> Registration pending approval
                          </p>
                          <button
                            onClick={() => handleCancel(event)}
                            disabled={cancellingId === event.id}
                            className="text-[11px] text-destructive hover:underline"
                          >
                            {cancellingId === event.id ? 'Cancelling...' : 'Cancel registration'}
                          </button>
                        </div>
                      )}

                      {/* Register button */}
                      {!hasBooking && (
                        <Button
                          onClick={() => handleRegister(event)}
                          disabled={registeringId === event.id || (spotsLeft !== null && spotsLeft <= 0)}
                          className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
                          size="sm"
                        >
                          {registeringId === event.id ? (
                            <><Loader2 size={14} className="animate-spin mr-1.5" /> Registering...</>
                          ) : spotsLeft !== null && spotsLeft <= 0 ? (
                            'Full'
                          ) : (
                            'Register for Webinar'
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Past Webinars */}
      {(statusFilter === 'all' || statusFilter === 'past') && past.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Past Webinars</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map(event => {
              // Try to find a matching video recording
              const matchingVideo = videos.find(v =>
                v.title.toLowerCase().includes(event.title.toLowerCase().slice(0, 20)) ||
                event.title.toLowerCase().includes(v.title.toLowerCase().slice(0, 20))
              )

              return (
                <Card key={event.id} className="border overflow-hidden hover:shadow-md transition-shadow group">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-navy flex items-center justify-center">
                    {event.featured_image_url || matchingVideo?.thumbnail_url ? (
                      <img
                        src={event.featured_image_url || matchingVideo?.thumbnail_url || ''}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    {matchingVideo && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play size={32} className="text-white/80 group-hover:text-white transition-colors" />
                      </div>
                    )}
                    {!matchingVideo && !event.featured_image_url && (
                      <Radio size={32} className="text-navy-foreground/40" />
                    )}
                    {matchingVideo && (
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                        {formatDuration(matchingVideo.duration_seconds)}
                      </span>
                    )}
                  </div>

                  <CardContent className="p-4">
                    {event.subspecialties && event.subspecialties.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        {event.subspecialties.slice(0, 3).map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">{event.title}</h3>
                    {event.speakers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{event.speakers.join(', ')}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{formatDate(event.starts_at)}</span>
                      {matchingVideo && (
                        <span className="flex items-center gap-1"><Eye size={12} /> {matchingVideo.vimeo_plays}</span>
                      )}
                    </div>

                    {matchingVideo ? (
                      <Link
                        href={`/members/videos?v=${matchingVideo.id}`}
                        className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <Video size={13} /> Watch Recording
                      </Link>
                    ) : (
                      <p className="mt-3 text-center text-[11px] text-muted-foreground/60">Recording coming soon</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Radio size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No webinars found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {events.length === 0 ? 'No webinars have been scheduled yet. Check back soon!' : 'Try adjusting your filters'}
          </p>
          {events.length > 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(''); setStatusFilter('all'); setSelectedTags([]) }}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
