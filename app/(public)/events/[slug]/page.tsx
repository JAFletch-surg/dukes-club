'use client'
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, MapPin, PoundSterling, Users, User, Clock,
  ArrowLeft, ExternalLink, Globe, Loader2, Check, X as XIcon,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendEmail } from "@/lib/emails/send-email";

const supabase = createClient();

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatPrice = (pence: number | null) => {
  if (!pence || pence === 0) return "Free";
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
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
      const supabase = createClient();
      const { error } = await supabase.from('event_bookings').insert({
        event_id: event.id,
        user_id: user.id,
        applicant_name: profile?.full_name || user.email?.split('@')[0] || 'Unknown',
        applicant_email: user.email || '',
        applicant_training_level: profile?.training_stage || '',
        applicant_hospital: (profile as any)?.hospital || '',
        applicant_deanery: profile?.region || '',
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

  const isApplicationEvent = event?.applications_enabled && ['Practical Workshop', 'In Person Course'].includes(event?.event_type);
  const deadlinePassed = event?.application_deadline && new Date(event.application_deadline) < new Date();
  const questions: { question: string; required: boolean }[] = event?.application_questions || [];

  const startDate = event ? formatDate(event.starts_at) : '';
  const startTime = event ? formatTime(event.starts_at) : '';
  const endTime = event?.ends_at ? formatTime(event.ends_at) : null;
  const price = event ? formatPrice(event.price_pence) : '';
  const memberPrice = event?.member_price_pence != null ? formatPrice(event.member_price_pence) : null;
  const timetable = event?.timetable_data as { time: string; title: string }[] | null;

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
              <span className="text-sm font-medium">{price}{memberPrice && memberPrice !== price && ` / ${memberPrice} members`}</span>
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
                <div className="prose prose-invert max-w-none">
                  {event.description_plain?.split("\n").map((paragraph: string, i: number) => (
                    <p key={i} className="text-navy-foreground/80 leading-relaxed mb-4">{paragraph}</p>
                  ))}
                </div>
              </AnimatedSection>

              {/* Timetable */}
              {timetable && timetable.length > 0 && (
                <AnimatedSection className="mt-12" delay={100}>
                  <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">Timetable</h2>
                  <div className="space-y-0">
                    {timetable.map((item, i) => (
                      <div key={i} className={cn("flex items-start gap-4 py-4 border-b border-navy-foreground/10", i === 0 && "border-t")}>
                        <span className="text-gold font-semibold text-sm w-16 shrink-0 pt-0.5">{item.time}</span>
                        <span className="text-navy-foreground/80 text-sm">{item.title}</span>
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
                      {memberPrice && memberPrice !== price && (
                        <p className="text-sm text-gold mt-1">{memberPrice} for Dukes&apos; Club members</p>
                      )}
                    </div>

                    {/* Action Button */}
                    {isApplicationEvent ? (
                      /* ── Application-based event ── */
                      <div className="mb-6">
                        {existingBooking ? (
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
                              {existingBooking.status === 'cancelled' && <><XIcon size={14} /> Cancelled</>}
                            </div>
                            {existingBooking.status === 'approved' && event.confirmation_message && (
                              <p className="text-xs text-navy-foreground/60 mt-3 text-left">{event.confirmation_message}</p>
                            )}
                            <Link href="/members" className="block mt-3">
                              <p className="text-xs text-gold hover:text-gold/80 transition-colors">View in dashboard →</p>
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
                        {event.eligibility_criteria && !existingBooking && (
                          <div className="mt-4 p-3 rounded-lg bg-navy-foreground/5 border border-navy-foreground/10">
                            <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">Eligibility</p>
                            <p className="text-xs text-navy-foreground/70 leading-relaxed">{event.eligibility_criteria}</p>
                          </div>
                        )}

                        {event.places_available && !existingBooking && (
                          <p className="text-xs text-navy-foreground/40 mt-2 text-center">
                            {event.places_available} places available
                          </p>
                        )}
                      </div>
                    ) : (
                      /* ── Standard booking (webinars, external URL) ── */
                      <>
                    {user ? (
                      <>
                        {event.booking_url ? (
                          <a href={event.booking_url} target="_blank" rel="noopener noreferrer" className="block mb-6">
                            <Button variant="gold" size="lg" className="w-full">
                              {['Webinar', 'Online Lecture'].includes(event.event_type) ? 'Register Now' : 'Book Now'} <ExternalLink size={14} className="ml-2" />
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
                          Log in to {['Webinar', 'Online Lecture'].includes(event.event_type) ? 'Register' : 'Book'}
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
      </section>
    </div>
  );
};

export default EventDetailPage;