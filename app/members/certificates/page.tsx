'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Award, Download, Loader2, Calendar, MapPin, ExternalLink, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/use-auth'

interface Certificate {
  id: string
  event_id: string
  attendee_name: string
  event_title: string
  event_date: string
  certificate_title: string
  cpd_points: number | null
  verification_code: string
  issued_at: string
  downloaded_at: string | null
}

interface PendingEvent {
  id: string
  event_id: string
  event: {
    id: string
    title: string
    starts_at: string
    location: string | null
    event_type: string | null
  } | null
}

export default function MyCertificatesPage() {
  const { user, loading: authLoading } = useAuth()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [pendingFeedback, setPendingFeedback] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadCertificates() {
      const supabase = createClient()

      // Fetch issued certificates
      const { data: certs, error } = await supabase
        .from('event_certificates')
        .select('*')
        .eq('user_id', user!.id)
        .order('issued_at', { ascending: false })

      if (!error && certs) setCertificates(certs)

      // Fetch past approved bookings that don't yet have feedback (eligible for certificates)
      const { data: bookings } = await supabase
        .from('event_bookings')
        .select('id, event_id, feedback_completed_at, events!event_bookings_event_id_fkey(id, title, starts_at, location, event_type)')
        .eq('user_id', user!.id)
        .in('status', ['approved', 'confirmed'])
        .is('feedback_completed_at', null)

      if (bookings) {
        // Only show past events
        const past = bookings.filter((b: any) => {
          const eventDate = b.events?.starts_at
          return eventDate && new Date(eventDate) < new Date()
        })
        setPendingFeedback(past.map((b: any) => ({ id: b.id, event_id: b.event_id, event: b.events })))
      }

      setLoading(false)
    }

    loadCertificates()
  }, [user])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Award size={24} className="text-gold" />
          My Certificates
        </h1>
        <p className="text-muted-foreground mt-1">
          Download your certificates of attendance for completed events
        </p>
      </div>

      {/* Pending Feedback Banner */}
      {pendingFeedback.length > 0 && (
        <Card className="border-gold/30 bg-gold/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                <FileText size={16} className="text-gold" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Feedback Required</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete feedback for these events to unlock your certificate
                </p>
              </div>
            </div>
            <div className="space-y-2 ml-12">
              {pendingFeedback.map(item => (
                <Link
                  key={item.id}
                  href={`/members/events/${item.event_id}/feedback`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gold/20 bg-white hover:border-gold/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-gold transition-colors">
                      {item.event?.title || 'Unknown Event'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {item.event?.starts_at && <span>{formatDate(item.event.starts_at)}</span>}
                      {item.event?.location && (
                        <>
                          <span>·</span>
                          <span>{item.event.location.split(',')[0]}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gold shrink-0 ml-4">
                    Give Feedback →
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificates List */}
      {certificates.length > 0 ? (
        <div className="space-y-3">
          {certificates.map(cert => (
            <Card key={cert.id} className="border overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-5">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-navy/5 flex items-center justify-center shrink-0">
                    <Award size={22} className="text-navy" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {cert.event_title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cert.certificate_title}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={11} />
                        {formatDate(cert.event_date)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Issued {formatDate(cert.issued_at)}
                      </span>
                      {cert.cpd_points && (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                          {cert.cpd_points} CPD Points
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Download */}
                  <a
                    href={`/api/certificates/download?id=${cert.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy text-navy-foreground text-xs font-semibold hover:bg-navy/90 transition-colors shrink-0"
                  >
                    <Download size={14} />
                    Download
                  </a>
                </div>

                {/* Verification footer */}
                <div className="px-5 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono tracking-wider">
                    Verification: {cert.verification_code}
                  </span>
                  {cert.downloaded_at && (
                    <span className="text-[10px] text-muted-foreground">
                      Last downloaded {formatDate(cert.downloaded_at)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Award size={28} className="text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No certificates yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Certificates are issued after you attend an event and complete the feedback form. Check the events page for upcoming opportunities.
            </p>
            <Link href="/members">
              <Button variant="outline" size="sm" className="mt-5">
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Total count */}
      {certificates.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {certificates.length} certificate{certificates.length !== 1 ? 's' : ''} issued
        </p>
      )}
    </div>
  )
}