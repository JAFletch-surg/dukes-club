'use client'
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, MapPin, PoundSterling, Users, User, Clock, Lock,
  ArrowLeft, ExternalLink, Globe, Loader2, Check, X as XIcon, Copy, CheckCheck,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { canBookEvent } from "@/lib/membership-gates";
import { sendEmail } from "@/lib/emails/send-email";
import { isStreamingEvent, registerForEvent } from "@/lib/events";
import { richTextToHtml } from "@/lib/rich-text";
import { eventSummary, formatPrice, isRefundableDeposit, REFUNDABLE_DEPOSIT_LABEL } from "@/lib/event-display";

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const AnimatedSection = ({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const { ref, isVisible } = useScrollAnimation(0.1);
  return (
    <div ref={ref} className={cn("transition-all duration-700 ease-out", isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const EventDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [event, setEvent] = useState<any>(null);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [applyError, setApplyError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bookingCount, setBookingCount] = useState(0);

  useEffect(() => {
    async function fetchEvent() {
      // Fetch event by slug
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (eventData) {
        setEvent(eventData);

        // Check if user has already applied
        if (user) {
          const { data: booking } = await supabase
            .from('event_bookings')
            .select('*')
            .eq('event_id', eventData.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (booking) setExistingBooking(booking);
        }

        // Active booking count, for spots-left display on streaming events
        if (isStreamingEvent(eventData.event_type)) {
          const { count } = await supabase
            .from('event_bookings')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventData.id)
            .in('status', ['approved', 'confirmed', 'pending']);
          setBookingCount(count || 0);
        }

        // Fetch faculty via junction table (two-step to avoid FK join issues)
        const { data: efData } = await supabase
          .from('event_faculty')
          .select('faculty_id, role')
          .eq('event_id', eventData.id);

        if (efData && efData.length > 0) {
          const facultyIds = efData.map((ef: any) => ef.faculty_id);
          const { data: facultyRows } = await supabase
            .from('faculty')
            .select('id, full_name, position_title, hospital, photo_url')
            .in('id', facultyIds);

          if (facultyRows) {
            setFaculty(efData.map((ef: any) => {
              const f = facultyRows.find((fr: any) => fr.id === ef.faculty_id);
              return {
                name: f?.full_name || '',
                role: ef.role || f?.position_title || 'Faculty',
                institution: f?.hospital || '',
                photo_url: f?.photo_url || '',
              };
            }));
          }
        }
      }

      setLoading(false);
    }
    if (slug) fetchEvent();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gold" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-3xl font-sans font-bold text-navy-foreground mb-4">Event Not Found</h1>
          <p className="text-navy-foreground/70 mb-8">The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href="/events"><Button variant="gold"><ArrowLeft size={16} className="mr-2" /> Back to Events</Button></Link>
        </div>
      </div>
    );
  }

  const handleApply = async () => {
    if (!user || !event) return;
    setApplying(true);
    setApplyError('');
    try {
      const { error } = await registerForEvent(supabase, {
        eventId: event.id,
        userId: user.id,
        applicantName: profile?.full_name || user.email?.split('@')[0] || 'Unknown',
        applicantEmail: user.email || '',
        applicantTrainingLevel: profile?.training_stage || '',
        applicantHospital: (profile as any)?.hospital || '',
        applicantDeanery: profile?.region || '',
        motivation,
        answers,
        status: event.auto_approve ? 'approved' : 'pending',
      });
      if (error) {
        if (error.code === '23505') setApplyError('You have already applied for this event.');
        else throw error;
      } else {
        setApplySuccess(true);
        setShowApplyForm(false);
        setExistingBooking({ status: event.auto_approve ? 'approved' : 'pending' });

        // Send booking confirmation email (non-blocking)
        const eventDate = new Date(event.starts_at).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        sendEmail({
          type: 'booking_confirmation',
          to: user.email || '',
          data: {
            name: profile?.full_name || user.email?.split('@')[0] || 'Member',
            eventTitle: event.title,
            eventDate,
            eventLocation: event.location || 'TBC',
            status: event.auto_approve ? 'approved' : 'pending',
          },
        }).catch(err => console.error('Booking email failed:', err));
      }
    } catch (e: any) {
      setApplyError(e.message || 'Failed to submit application');
    }
    setApplying(false);
  };

  const handleRegister = async () => {
    if (!user || !event) return;

    // Open synchronously, in the same click gesture, so browsers don't block the popup —
    // once we `await` below, it's no longer treated as a direct user interaction.
    if (event.booking_url) {
      window.open(event.booking_url, '_blank', 'noopener,noreferrer');
    }

    setRegistering(true);
    try {
      const status = event.auto_approve ? 'approved' : 'pending';
      const { booking, error } = await registerForEvent(supabase, {
        eventId: event.id,
        userId: user.id,
        applicantName: profile?.full_name || user.email?.split('@')[0] || 'Unknown',
        applicantEmail: user.email || '',
        applicantTrainingLevel: profile?.training_stage || '',
        applicantHospital: (profile as any)?.hospital || '',
        applicantDeanery: profile?.region || '',
        status,
      });

      if (!error && booking) {
        setExistingBooking(booking);
        setBookingCount((c) => c + 1);

        const eventDate = new Date(event.starts_at).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        sendEmail({
          type: 'booking_confirmation',
          to: user.email || '',
          data: {
            name: profile?.full_name || user.email?.split('@')[0] || 'Member',
            eventTitle: event.title,
            eventDate,
            eventLocation: 'Online',
            status,
          },
        }).catch(err => console.error('Booking email failed:', err));
      }
    } catch (e) {
      console.error('Registration failed:', e);
    }
    setRegistering(false);
  };

  const handleCancel = async () => {
    if (!existingBooking?.id) return;
    setCancelling(true);
    const { error } = await supabase
      .from('event_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', existingBooking.id);
    if (!error) {
      setExistingBooking(null);
      setBookingCount((c) => Math.max(0, c - 1));
    }
    setCancelling(false);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isApplicationEvent = event?.applications_enabled;
  const isOnlineEvent = isStreamingEvent(event?.event_type);
  const spotsLeft = event?.capacity ? event.capacity - bookingCount : null;
  const deadlinePassed = event?.application_deadline && new Date(event.application_deadline) < new Date();
  const questions: { question: string; required: boolean }[] = event?.application_questions || [];

  const startDate = event ? formatDate(event.starts_at) : '';
  const startTime = event ? formatTime(event.starts_at) : '';
  const endTime = event?.ends_at ? formatTime(event.ends_at) : null;
  const price = event ? formatPrice(event.price_pence) : '';
  const memberPrice = event?.member_price_pence != null ? formatPrice(event.member_price_pence) : null;
  const isDeposit = event ? isRefundableDeposit(event) : false;
  // Only an admin-written summary earns a line under the title; the
  // description fallback would just repeat the paragraph below it.
  const summary = event?.summary?.trim() ? eventSummary(event) : '';
  // Support both legacy flat format and new multi-day format
  const rawTimetable = event?.timetable_data as any[] | null;
  const isMultiDay = rawTimetable && rawTimetable.length > 0 && rawTimetable[0] && 'entries' in rawTimetable[0];
  const timetableDays = isMultiDay
    ? (rawTimetable as { day: string; label?: string; entries: { time: string; title: string }[] }[])
    : rawTimetable && rawTimetable.length > 0
      ? [{ day: '', label: '', entries: rawTimetable as { time: string; title: string }[] }]
      : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          {event.featured_image_url ? (
            <img src={event.featured_image_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <video className="w-full h-full object-cover" src="/videos/hero-bg.mp4" muted autoPlay loop playsInline />
          )}
          <div className="absolute inset-0 bg-navy/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy" />
        </div>
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <Link href="/events" className="inline-flex items-center gap-1.5 text-gold hover:text-gold/80 text-sm font-medium mb-6 transition-colors">
            <ArrowLeft size={14} /> Back to Events
          </Link>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-gold/20 text-gold border-gold/30">{event.event_type}</Badge>
            {(event.subspecialties || []).map((sub: string) => (
              <Badge key={sub} variant="outline" className="border-navy-foreground/30 text-navy-foreground/70">{sub}</Badge>
            ))}
          </div>
          <h1 className="text-3xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">{event.title}</h1>
          {summary && (
            <p className="mt-4 max-w-2xl text-base md:text-lg text-navy-foreground/80 animate-fade-in">{summary}</p>
          )}
        </div>
      </section>

      {/* Key Details Bar */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-6 md:gap-10 items-center justify-center text-navy-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-gold" />
              <span className="text-sm font-medium">{startDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-gold" />
              <span className="text-sm font-medium">{startTime}{endTime && ` – ${endTime}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-gold" />
              <span className="text-sm font-medium">{event.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <PoundSterling size={18} className="text-gold" />
              <span className="text-sm font-medium">
                {price}{memberPrice && memberPrice !== price && ` / ${memberPrice} members`}
                {isDeposit && ` ${REFUNDABLE_DEPOSIT_LABEL}`}
              </span>
            </div>
            {event.capacity && (
              <div className="flex items-center gap-2">
                <Users size={18} className="text-gold" />
                <span className="text-sm font-medium">{event.capacity} places</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-navy py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <AnimatedSection>
                <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">About This Event</h2>
                {/* description_html carries the admin's HTML; older events fall
                    back to their plain text, which converts to the same shape. */}
                <div
                  className="event-content"
                  dangerouslySetInnerHTML={{ __html: richTextToHtml(event.description_html || event.description_plain) }}
                />
              </AnimatedSection>

              {/* Timetable */}
              {timetableDays && timetableDays.length > 0 && (
                <AnimatedSection className="mt-12" delay={100}>
                  <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">Timetable</h2>
                  <div className="space-y-8">
                    {timetableDays.map((dayGroup, di) => (
                      <div key={di}>
                        {/* Show day heading if multi-day or has label */}
                        {(timetableDays.length > 1 || dayGroup.label) && (
                          <div className="mb-3">
                            <h3 className="text-lg font-semibold text-navy-foreground">
                              {dayGroup.label || `Day ${di + 1}`}
                            </h3>
                            {dayGroup.day && (
                              <p className="text-sm text-navy-foreground/60">
                                {new Date(dayGroup.day + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="space-y-0">
                          {dayGroup.entries.map((item, i) => (
                            <div key={i} className={cn("flex items-start gap-4 py-4 border-b border-navy-foreground/10", i === 0 && "border-t")}>
                              <span className="text-gold font-semibold text-sm w-16 shrink-0 pt-0.5">{item.time}</span>
                              <span className="text-navy-foreground/80 text-sm">{item.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AnimatedSection>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <AnimatedSection delay={200}>
                  <div className="rounded-lg border-2 border-navy-foreground/20 bg-navy-foreground/5 p-6">
                    <div className="mb-6 text-center">
                      <p className="text-3xl font-bold text-navy-foreground">{price}</p>
                      {isDeposit && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-gold mt-1">Fully {REFUNDABLE_DEPOSIT_LABEL}</p>
                      )}
                      {memberPrice && memberPrice !== price && (
                        <p className="text-sm text-gold mt-1">{memberPrice} for Dukes&apos; Club members</p>
                      )}
                    </div>

                    {/* Action Button */}
                    {isApplicationEvent ? (
                      /* ── Application-based event ── */
                      <div className="mb-6">
                        {existingBooking && existingBooking.status !== 'cancelled' ? (
                          <div className="text-center">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                              existingBooking.status === 'approved' || existingBooking.status === 'confirmed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : existingBooking.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : existingBooking.status === 'rejected'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-gray-500/10 text-gray-400'
                            }`}>
                              {existingBooking.status === 'pending' && <><Clock size={14} /> Application Pending</>}
                              {existingBooking.status === 'approved' && <><Check size={14} /> Application Approved</>}
                              {existingBooking.status === 'confirmed' && <><Check size={14} /> Confirmed</>}
                              {existingBooking.status === 'rejected' && <><XIcon size={14} /> Application Not Successful</>}
                              {existingBooking.status === 'waitlisted' && <><Clock size={14} /> On Waitlist</>}
                            </div>
                            {existingBooking.status === 'approved' && event.confirmation_message && (
                              <div
                                className="event-content event-content-sm text-navy-foreground/60 mt-3 text-left"
                                dangerouslySetInnerHTML={{ __html: richTextToHtml(event.confirmation_message) }}
                              />
                            )}

                            {/* Zoom/Meeting link — shown to approved attendees */}
                            {['approved', 'confirmed'].includes(existingBooking.status) && event.zoom_url && (
                              <a
                                href={event.zoom_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors"
                              >
                                <ExternalLink size={14} /> Join Webinar
                              </a>
                            )}

                            <Link href="/members" className="block mt-3">
                              <p className="text-xs text-gold hover:text-gold/80 transition-colors">View in My Events →</p>
                            </Link>
                          </div>
                        ) : deadlinePassed ? (
                          <div className="text-center py-2">
                            <p className="text-sm text-red-400 font-semibold">Application deadline has passed</p>
                          </div>
                        ) : !user ? (
                          <div>
                            <Link href="/login">
                              <Button variant="gold" size="lg" className="w-full">
                                Log in to Apply
                              </Button>
                            </Link>
                            <p className="text-xs text-center text-navy-foreground/50 mt-2">Members only — <Link href="/register" className="text-gold underline">join now</Link></p>
                          </div>
                        ) : !canBookEvent(profile, event.event_type) ? (
                          <div className="text-center space-y-3 py-2">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold">
                              <Lock size={14} /> Full Members Only
                            </div>
                            <p className="text-xs text-navy-foreground/60 leading-relaxed">
                              In-person courses are available to verified ACPGBI members. Submit your membership number to upgrade.
                            </p>
                            <Link href="/members/profile">
                              <Button variant="gold" size="sm" className="w-full">
                                Add Membership Number
                              </Button>
                            </Link>
                          </div>
                        ) : !showApplyForm ? (
                          <Button variant="gold" size="lg" className="w-full" onClick={() => setShowApplyForm(true)}>
                            Apply for Place
                          </Button>
                        ) : (
                          /* ── Application form ── */
                          <div className="space-y-4 text-left">
                            <div>
                              <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Your Details</p>
                              <div className="text-sm text-navy-foreground space-y-1">
                                <p><span className="text-navy-foreground/50">Name:</span> {profile?.full_name || user.email}</p>
                                <p><span className="text-navy-foreground/50">Email:</span> {user.email}</p>
                                {profile?.training_stage && <p><span className="text-navy-foreground/50">Level:</span> {profile.training_stage}</p>}
                                {(profile as any)?.hospital && <p><span className="text-navy-foreground/50">Hospital:</span> {(profile as any).hospital}</p>}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Why do you want to attend?</label>
                              <textarea
                                value={motivation}
                                onChange={(e) => setMotivation(e.target.value)}
                                placeholder="Brief motivation statement..."
                                className="w-full p-3 rounded-lg bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground text-sm placeholder:text-navy-foreground/40 focus:outline-none focus:border-gold/50"
                                rows={3}
                              />
                            </div>

                            {questions.map((q, i) => (
                              <div key={i}>
                                <label className="block text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                                  {q.question} {q.required && <span className="text-red-400">*</span>}
                                </label>
                                <textarea
                                  value={answers[`q${i}`] || ''}
                                  onChange={(e) => setAnswers({ ...answers, [`q${i}`]: e.target.value })}
                                  className="w-full p-3 rounded-lg bg-navy-foreground/10 border border-navy-foreground/20 text-navy-foreground text-sm placeholder:text-navy-foreground/40 focus:outline-none focus:border-gold/50"
                                  rows={2}
                                />
                              </div>
                            ))}

                            {applyError && <p className="text-xs text-red-400">{applyError}</p>}

                            <div className="flex gap-2">
                              <Button variant="gold" size="lg" className="flex-1" onClick={handleApply} disabled={applying}>
                                {applying ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                                Submit Application
                              </Button>
                              <Button variant="outline" size="lg" onClick={() => setShowApplyForm(false)} className="border-navy-foreground/30 text-navy-foreground">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Eligibility info */}
                        {event.eligibility_criteria && (!existingBooking || existingBooking.status === 'cancelled') && (
                          <div className="mt-4 p-3 rounded-lg bg-navy-foreground/5 border border-navy-foreground/10">
                            <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Eligibility</p>
                            <div
                              className="event-content event-content-sm text-navy-foreground/70"
                              dangerouslySetInnerHTML={{ __html: richTextToHtml(event.eligibility_criteria) }}
                            />
                          </div>
                        )}

                        {event.places_available && (!existingBooking || existingBooking.status === 'cancelled') && (
                          <p className="text-xs text-navy-foreground/40 mt-2 text-center">
                            {event.places_available} places available
                          </p>
                        )}
                      </div>
                    ) : isOnlineEvent ? (
                      /* ── Online event: register on-site ── */
                      <div className="mb-6">
                        {existingBooking && existingBooking.status !== 'cancelled' ? (
                          <div className="text-center">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                              existingBooking.status === 'approved' || existingBooking.status === 'confirmed'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {existingBooking.status === 'pending' && <><Clock size={14} /> Registration Pending</>}
                              {(existingBooking.status === 'approved' || existingBooking.status === 'confirmed') && <><Check size={14} /> You&apos;re Registered</>}
                            </div>

                            {['approved', 'confirmed'].includes(existingBooking.status) && (event.zoom_url || event.vimeo_live_embed_url || event.zoom_meeting_id || event.zoom_passcode) && (
                              <div className="mt-4 text-left space-y-3 rounded-lg border border-navy-foreground/20 bg-navy-foreground/5 p-4">
                                {event.zoom_url && (
                                  <a
                                    href={event.zoom_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors"
                                  >
                                    <ExternalLink size={14} /> Join on Zoom
                                  </a>
                                )}
                                {(event.zoom_meeting_id || event.zoom_passcode) && (
                                  <div className="space-y-1.5">
                                    {event.zoom_meeting_id && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-navy-foreground/60 truncate mr-2">Meeting ID: <span className="font-mono text-navy-foreground">{event.zoom_meeting_id}</span></span>
                                        <button onClick={() => handleCopy(event.zoom_meeting_id, 'mid')} className="text-navy-foreground/60 hover:text-navy-foreground shrink-0">
                                          {copiedField === 'mid' ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                        </button>
                                      </div>
                                    )}
                                    {event.zoom_passcode && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-navy-foreground/60 truncate mr-2">Passcode: <span className="font-mono text-navy-foreground">{event.zoom_passcode}</span></span>
                                        <button onClick={() => handleCopy(event.zoom_passcode, 'pc')} className="text-navy-foreground/60 hover:text-navy-foreground shrink-0">
                                          {copiedField === 'pc' ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {event.vimeo_live_embed_url && !event.zoom_url && (
                                  <a
                                    href={event.vimeo_live_embed_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-gold text-gold-foreground text-sm font-bold hover:bg-gold/90 transition-colors"
                                  >
                                    Watch Live
                                  </a>
                                )}
                              </div>
                            )}

                            <button
                              onClick={handleCancel}
                              disabled={cancelling}
                              className="mt-3 text-xs text-red-400 hover:underline"
                            >
                              {cancelling ? 'Cancelling...' : 'Cancel registration'}
                            </button>
                          </div>
                        ) : !user ? (
                          <div>
                            <Link href="/login">
                              <Button variant="gold" size="lg" className="w-full">
                                Log in to Register
                              </Button>
                            </Link>
                            <p className="text-xs text-center text-navy-foreground/50 mt-2">Members only — <Link href="/register" className="text-gold underline">join now</Link></p>
                          </div>
                        ) : (
                          <Button
                            variant="gold"
                            size="lg"
                            className="w-full"
                            onClick={handleRegister}
                            disabled={registering || (spotsLeft !== null && spotsLeft <= 0)}
                          >
                            {registering ? (
                              <Loader2 size={16} className="animate-spin mr-2" />
                            ) : spotsLeft !== null && spotsLeft <= 0 ? (
                              'Full'
                            ) : (
                              'Register for Webinar'
                            )}
                          </Button>
                        )}

                        {spotsLeft !== null && (!existingBooking || existingBooking.status === 'cancelled') && (
                          <p className="text-xs text-navy-foreground/40 mt-2 text-center">
                            {Math.max(0, spotsLeft)} spot{Math.max(0, spotsLeft) !== 1 ? 's' : ''} left
                          </p>
                        )}

                        {event.booking_url && (!existingBooking || existingBooking.status === 'cancelled') && (
                          <p className="text-xs text-navy-foreground/40 mt-2 text-center">
                            You&apos;ll also be registered on our external platform in a new tab
                          </p>
                        )}
                      </div>
                    ) : (
                      /* ── Standard booking (external URL only) ── */
                      <>
                    {user ? (
                      <>
                        {event.booking_url ? (
                          <a href={event.booking_url} target="_blank" rel="noopener noreferrer" className="block mb-6">
                            <Button variant="gold" size="lg" className="w-full">
                              Book Now <ExternalLink size={14} className="ml-2" />
                            </Button>
                          </a>
                        ) : event.zoom_url ? (
                          <a href={event.zoom_url} target="_blank" rel="noopener noreferrer" className="block mb-6">
                            <Button variant="gold" size="lg" className="w-full">
                              Join Webinar <ExternalLink size={14} className="ml-2" />
                            </Button>
                          </a>
                        ) : null}
                      </>
                    ) : (event.booking_url || event.zoom_url) ? (
                      <Link href="/login" className="block mb-6">
                        <Button variant="gold" size="lg" className="w-full">
                          Log in to Book
                        </Button>
                        <p className="text-xs text-center text-navy-foreground/50 mt-2">Members only — <Link href="/register" className="text-gold underline">join now</Link></p>
                      </Link>
                    ) : null}
                      </>
                    )}

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Date</p>
                        <p className="text-sm text-navy-foreground">{startDate}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Time</p>
                        <p className="text-sm text-navy-foreground">{startTime}{endTime && ` – ${endTime}`}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Location</p>
                        <p className="text-sm text-navy-foreground">{event.location}</p>
                        {event.address && <p className="text-xs text-navy-foreground/60 mt-1">{event.address}</p>}
                      </div>
                      {event.capacity && (
                        <div>
                          <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Capacity</p>
                          <p className="text-sm text-navy-foreground">{event.capacity} places</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Event Type</p>
                        <p className="text-sm text-navy-foreground">{event.event_type}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Subspecialties</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(event.subspecialties || []).map((sub: string) => (
                            <Badge key={sub} variant="outline" className="border-navy-foreground/30 text-navy-foreground/70 text-[10px]">{sub}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {event.latitude && event.longitude && (
                      <a href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold/80 transition-colors mt-6 font-medium">
                        <Globe size={14} /> View on Google Maps
                      </a>
                    )}
                  </div>

                  {/* Faculty */}
                  {faculty.length > 0 && (
                    <div className="mt-6 rounded-lg border-2 border-navy-foreground/20 bg-navy-foreground/5 p-6">
                      <h3 className="text-sm font-semibold text-navy-foreground uppercase tracking-wider mb-4">Faculty</h3>
                      <div className="space-y-4">
                        {faculty.map((member, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {member.photo_url ? (
                              <img src={member.photo_url} alt={member.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-navy-foreground/10 flex items-center justify-center shrink-0">
                                <User className="text-gold/60" size={18} />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-navy-foreground leading-tight">{member.name}</p>
                              <p className="text-xs text-navy-foreground/60">{member.role}{member.institution && ` · ${member.institution}`}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </AnimatedSection>
              </div>
            </div>
          </div>
        </div>

        {/* Styles for admin-authored HTML in the description, eligibility
            and confirmation fields — light type on the navy background. */}
        <style dangerouslySetInnerHTML={{ __html: `
          .event-content {
            color: hsl(210 40% 98% / 0.8);
            font-size: 16px;
            line-height: 1.75;
          }
          .event-content > *:first-child { margin-top: 0; }
          .event-content > *:last-child { margin-bottom: 0; }
          .event-content p { margin-bottom: 1em; }
          .event-content h1, .event-content h2, .event-content h3, .event-content h4 {
            font-family: var(--font-sans, 'Montserrat', sans-serif);
            font-weight: 700;
            color: hsl(210 40% 98%);
            margin: 1.5em 0 0.5em;
            line-height: 1.3;
          }
          .event-content h1 { font-size: 1.55em; }
          .event-content h2 { font-size: 1.3em; }
          .event-content h3 { font-size: 1.12em; }
          .event-content h4 { font-size: 1em; letter-spacing: 0.01em; }
          .event-content strong, .event-content b { color: hsl(210 40% 98%); font-weight: 700; }
          .event-content em, .event-content i { font-style: italic; }
          .event-content a {
            color: hsl(42 87% 55%);
            text-decoration: underline;
            text-underline-offset: 2px;
          }
          .event-content a:hover { color: hsl(42 87% 68%); }
          .event-content ul, .event-content ol { margin: 1em 0; padding-left: 1.4em; }
          .event-content li { margin-bottom: 0.4em; }
          .event-content ul li { list-style-type: disc; }
          .event-content ol li { list-style-type: decimal; }
          .event-content li::marker { color: hsl(42 87% 55%); }
          .event-content blockquote,
          .event-content .callout {
            border-left: 3px solid hsl(42 87% 55%);
            background: hsl(210 40% 98% / 0.06);
            border-radius: 0 10px 10px 0;
            padding: 14px 18px;
            margin: 1.5em 0;
          }
          .event-content blockquote { font-style: italic; }
          .event-content blockquote p:last-child, .event-content .callout p:last-child { margin-bottom: 0; }
          .event-content blockquote cite {
            display: block;
            margin-top: 8px;
            font-style: normal;
            font-size: 0.85em;
            font-weight: 700;
            color: hsl(42 87% 55%);
          }
          .event-content hr {
            border: none;
            height: 1px;
            background: linear-gradient(90deg, transparent, hsl(42 87% 55% / 0.6), transparent);
            margin: 2em 0;
          }
          .event-content img, .event-content iframe, .event-content video {
            max-width: 100%;
            border: none;
            border-radius: 10px;
          }
          .event-content figure { margin: 1.5em 0; }
          .event-content figure img { display: block; margin: 0 auto; }
          .event-content figcaption {
            font-size: 0.8em;
            font-style: italic;
            color: hsl(210 40% 98% / 0.55);
            margin-top: 6px;
            text-align: center;
          }
          /* Uploaded PDFs and documents render as a file chip rather than a
             bare link, so a programme reads as something to open. */
          .event-content .doc-link {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            border: 1px solid hsl(42 87% 55% / 0.4);
            background: hsl(210 40% 98% / 0.06);
            border-radius: 10px;
            padding: 10px 16px;
            margin: 0.4em 0;
            color: hsl(210 40% 98%);
            font-weight: 600;
            font-size: 0.95em;
            transition: background 0.2s, border-color 0.2s;
          }
          .event-content .doc-link::before { content: '📄'; font-size: 1.1em; }
          .event-content .doc-link:hover {
            background: hsl(42 87% 55% / 0.12);
            border-color: hsl(42 87% 55% / 0.8);
            color: hsl(210 40% 98%);
          }
          .event-content table {
            display: block;
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            border-collapse: collapse;
            margin: 1.5em 0;
            font-size: 0.95em;
          }
          .event-content th, .event-content td {
            border: 1px solid hsl(210 40% 98% / 0.15);
            padding: 8px 14px;
            text-align: left;
            vertical-align: top;
          }
          .event-content th {
            background: hsl(210 40% 98% / 0.08);
            color: hsl(210 40% 98%);
            font-family: var(--font-sans, 'Montserrat', sans-serif);
            font-weight: 700;
          }
          .event-content code {
            font-family: 'IBM Plex Mono', Menlo, monospace;
            font-size: 0.9em;
            background: hsl(210 40% 98% / 0.1);
            padding: 1px 5px;
            border-radius: 4px;
          }

          /* Sidebar variant — same markup, smaller type */
          .event-content-sm { font-size: 12px; line-height: 1.65; color: inherit; }
          .event-content-sm p { margin-bottom: 0.6em; }
          .event-content-sm ul, .event-content-sm ol { margin: 0.5em 0; padding-left: 1.2em; }
          .event-content-sm li { margin-bottom: 0.2em; }
          .event-content-sm h1, .event-content-sm h2, .event-content-sm h3, .event-content-sm h4 {
            font-size: 1.05em;
            margin: 0.8em 0 0.3em;
          }
          .event-content-sm blockquote, .event-content-sm .callout { padding: 8px 12px; margin: 0.8em 0; }
          .event-content-sm table { font-size: 0.95em; margin: 0.8em 0; }
          .event-content-sm th, .event-content-sm td { padding: 4px 8px; }
        `}} />
      </section>
    </div>
  );
};

export default EventDetailPage;