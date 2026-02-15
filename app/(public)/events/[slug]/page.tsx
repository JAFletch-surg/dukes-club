'use client'
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays, MapPin, PoundSterling, Users, User, Clock,
  ArrowLeft, ExternalLink, Globe, Loader2,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

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
  const { user } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const startDate = formatDate(event.starts_at);
  const startTime = formatTime(event.starts_at);
  const endTime = event.ends_at ? formatTime(event.ends_at) : null;
  const price = formatPrice(event.price_pence);
  const memberPrice = event.member_price_pence != null ? formatPrice(event.member_price_pence) : null;
  const timetable = event.timetable_data as { time: string; title: string }[] | null;

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

                    {/* Action Button - gated behind login */}
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