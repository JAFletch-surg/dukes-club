'use client'
import Link from "next/link";
import { useParams } from "next/navigation";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  MapPin,
  PoundSterling,
  Users,
  User,
  Clock,
  ArrowLeft,
  ExternalLink,
  Globe,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";

// Placeholder mock — will be replaced with Supabase query by slug
const mockEvent = {
  id: "1",
  title: "Intestinal Failure & Abdominal Wall Day",
  slug: "intestinal-failure-abdominal-wall-day",
  starts_at: "2026-03-15T09:00:00Z",
  ends_at: "2026-03-15T17:00:00Z",
  location: "Royal College of Surgeons, London",
  address: "35-43 Lincoln's Inn Fields, London WC2A 3PE",
  latitude: 51.5163,
  longitude: -0.1175,
  description_plain:
    "Lecture-based course on complex herniae, intestinal failure, and abdominal wall management. Featuring expert faculty from leading UK centres with case-based discussions and interactive Q&A sessions.\n\nThis comprehensive day will cover:\n\n• Complex abdominal wall reconstruction techniques\n• Intestinal failure pathophysiology and management\n• Nutritional support in the surgical patient\n• Case-based discussions with expert panel\n• Interactive Q&A sessions throughout\n\nDesigned for colorectal surgical trainees at all levels, this event provides an excellent opportunity to learn from leading specialists and network with peers.",
  featured_image_url: "",
  event_type: "In Person Course",
  subspecialties: ["Intestinal Failure", "Abdominal Wall"],
  booking_url: "https://example.com/book",
  capacity: 80,
  price_pence: 0,
  member_price_pence: null,
  is_free: true,
  timetable_data: [
    { time: "09:00", title: "Registration & Coffee" },
    { time: "09:30", title: "Welcome & Introduction" },
    { time: "10:00", title: "Complex Abdominal Wall Reconstruction" },
    { time: "11:00", title: "Coffee Break" },
    { time: "11:30", title: "Intestinal Failure: Pathophysiology" },
    { time: "12:30", title: "Lunch & Networking" },
    { time: "13:30", title: "Nutritional Support in the Surgical Patient" },
    { time: "14:30", title: "Case-Based Discussions" },
    { time: "15:30", title: "Tea Break" },
    { time: "16:00", title: "Expert Panel Q&A" },
    { time: "17:00", title: "Close" },
  ],
  faculty: [
    { name: "Mr James Richardson", role: "Course Director", institution: "St Mark's Hospital, London" },
    { name: "Miss Sarah Thompson", role: "Faculty", institution: "Oxford University Hospitals" },
    { name: "Mr David Clarke", role: "Faculty", institution: "Leeds Teaching Hospitals" },
    { name: "Miss Priya Patel", role: "Faculty", institution: "John Radcliffe Hospital, Oxford" },
  ],
  status: "published",
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatPrice = (pence: number) => {
  if (pence === 0) return "Free";
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
};

const AnimatedSection = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const { ref, isVisible } = useScrollAnimation(0.1);
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const EventDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  // TODO: Replace with Supabase query: select * from events where slug = slug
  const event = mockEvent;

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-3xl font-sans font-bold text-navy-foreground mb-4">
            Event Not Found
          </h1>
          <p className="text-navy-foreground/70 mb-8">
            The event you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/events">
            <Button variant="gold">
              <ArrowLeft size={16} className="mr-2" /> Back to Events
            </Button>
          </Link>
        </div>
        
      </div>
    );
  }

  const startDate = formatDate(event.starts_at);
  const startTime = formatTime(event.starts_at);
  const endTime = event.ends_at ? formatTime(event.ends_at) : null;
  const price = formatPrice(event.price_pence);
  const memberPrice = event.member_price_pence
    ? formatPrice(event.member_price_pence)
    : null;
  const timetable = event.timetable_data as { time: string; title: string }[] | null;
  const faculty = event.faculty as { name: string; role: string; institution: string }[] | null;

  return (
    <div className="min-h-screen bg-background">
      

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          {event.featured_image_url ? (
            <img
              src={event.featured_image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              className="w-full h-full object-cover"
              src="/videos/hero-bg.mp4"
              muted
              autoPlay
              loop
              playsInline
            />
          )}
          <div className="absolute inset-0 bg-navy/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy" />
        </div>
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-gold hover:text-gold/80 text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Events
          </Link>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-gold/20 text-gold border-gold/30">
              {event.event_type}
            </Badge>
            {event.subspecialties.map((sub) => (
              <Badge
                key={sub}
                variant="outline"
                className="border-navy-foreground/30 text-navy-foreground/70"
              >
                {sub}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            {event.title}
          </h1>
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
              <span className="text-sm font-medium">
                {startTime}
                {endTime && ` – ${endTime}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-gold" />
              <span className="text-sm font-medium">{event.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <PoundSterling size={18} className="text-gold" />
              <span className="text-sm font-medium">
                {price}
                {memberPrice && ` (${memberPrice} members)`}
              </span>
            </div>
            {event.capacity && (
              <div className="flex items-center gap-2">
                <Users size={18} className="text-gold" />
                <span className="text-sm font-medium">
                  {event.capacity} places
                </span>
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
                <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">
                  About This Event
                </h2>
                <div className="prose prose-invert max-w-none">
                  {event.description_plain?.split("\n").map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-navy-foreground/80 leading-relaxed mb-4"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </AnimatedSection>

              {/* Timetable */}
              {timetable && timetable.length > 0 && (
                <AnimatedSection className="mt-12" delay={100}>
                  <h2 className="text-2xl font-sans font-bold text-navy-foreground mb-6">
                    Timetable
                  </h2>
                  <div className="space-y-0">
                    {timetable.map((item, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-start gap-4 py-4 border-b border-navy-foreground/10",
                          i === 0 && "border-t"
                        )}
                      >
                        <span className="text-gold font-semibold text-sm w-16 shrink-0 pt-0.5">
                          {item.time}
                        </span>
                        <span className="text-navy-foreground/80 text-sm">
                          {item.title}
                        </span>
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
                  {/* Price */}
                  <div className="mb-6 text-center">
                    <p className="text-3xl font-bold text-navy-foreground">
                      {price}
                    </p>
                    {memberPrice && (
                      <p className="text-sm text-gold mt-1">
                        {memberPrice} for Dukes' Club members
                      </p>
                    )}
                  </div>

                  {/* Book Button */}
                  {event.booking_url && (
                    <a
                      href={event.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mb-6"
                    >
                      <Button variant="gold" size="lg" className="w-full">
                        Book Now <ExternalLink size={14} className="ml-2" />
                      </Button>
                    </a>
                  )}

                  {/* Details */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                        Date
                      </p>
                      <p className="text-sm text-navy-foreground">{startDate}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                        Time
                      </p>
                      <p className="text-sm text-navy-foreground">
                        {startTime}
                        {endTime && ` – ${endTime}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                        Location
                      </p>
                      <p className="text-sm text-navy-foreground">
                        {event.location}
                      </p>
                      {event.address && (
                        <p className="text-xs text-navy-foreground/60 mt-1">
                          {event.address}
                        </p>
                      )}
                    </div>
                    {event.capacity && (
                      <div>
                        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                          Capacity
                        </p>
                        <p className="text-sm text-navy-foreground">
                          {event.capacity} places
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                        Event Type
                      </p>
                      <p className="text-sm text-navy-foreground">
                        {event.event_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-1">
                        Subspecialties
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {event.subspecialties.map((sub) => (
                          <Badge
                            key={sub}
                            variant="outline"
                            className="border-navy-foreground/30 text-navy-foreground/70 text-[10px]"
                          >
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Map link */}
                  {event.latitude && event.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold/80 transition-colors mt-6 font-medium"
                    >
                      <Globe size={14} /> View on Google Maps
                    </a>
                  )}
                </div>

                {/* Faculty */}
                {faculty && faculty.length > 0 && (
                  <div className="mt-6 rounded-lg border-2 border-navy-foreground/20 bg-navy-foreground/5 p-6">
                    <h3 className="text-sm font-semibold text-navy-foreground uppercase tracking-wider mb-4">
                      Faculty
                    </h3>
                    <div className="space-y-4">
                      {faculty.map((member, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-navy-foreground/10 flex items-center justify-center shrink-0">
                            <User className="text-gold/60" size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-navy-foreground leading-tight">
                              {member.name}
                            </p>
                            <p className="text-xs text-navy-foreground/60">
                              {member.role} · {member.institution}
                            </p>
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
