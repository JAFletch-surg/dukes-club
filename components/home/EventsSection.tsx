'use client'
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { ArrowRight, CalendarDays, MapPin, PoundSterling, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const formatPrice = (pence: number | null) => {
  if (!pence || pence === 0) return "Free";
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const EventsSection = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      const supabase = createClient();
      const { data } = await supabase
        .from('events')
        .select('title, slug, event_type, starts_at, location, price_pence, description_plain, featured_image_url')
        .eq('status', 'published')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(3);
      setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  return (
    <section className="py-20 bg-navy">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
          <div>
            <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-2">
              Courses and Webinars
            </p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground">
              Upcoming Events
            </h2>
            <p className="mt-3 text-navy-foreground/80 max-w-2xl text-sm md:text-base">
              Upcoming Webinars and Courses: Join us for a series of informative sessions and
              engaging courses designed to enhance your knowledge and skills.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link href="/events">
              <Button variant="hero" size="lg">
                View all
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-navy-foreground/60 text-center py-12">
            No upcoming events at the moment — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
            {events.map((event) => (
              <Link key={event.slug} href={`/events/${event.slug}`} className="block group">
                {/* Mobile: compact horizontal card */}
                <div className="md:hidden flex rounded-lg border-2 border-navy-foreground overflow-hidden bg-navy hover:border-gold/40 transition-colors">
                  <div className="w-24 shrink-0 overflow-hidden">
                    {event.featured_image_url ? (
                      <img src={event.featured_image_url} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-navy-foreground/10 flex items-center justify-center">
                        <CalendarDays size={20} className="text-gold/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
                    <span className="text-[10px] font-semibold text-gold uppercase tracking-wide">{event.event_type}</span>
                    <h3 className="text-sm font-sans font-semibold text-navy-foreground leading-tight line-clamp-2">{event.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-navy-foreground/60">
                      <span className="flex items-center gap-1"><CalendarDays size={11} className="text-gold" />{formatDate(event.starts_at)}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} className="text-gold" />{event.location}</span>
                    </div>
                    <span className="text-xs text-navy-foreground/60 flex items-center gap-1"><PoundSterling size={11} className="text-gold" />{formatPrice(event.price_pence)}</span>
                  </div>
                  <div className="flex items-center pr-3">
                    <ArrowRight size={16} className="text-navy-foreground/30 group-hover:text-gold transition-colors" />
                  </div>
                </div>
                {/* Desktop: vertical card */}
                <div className="hidden md:flex md:flex-col rounded-lg border-2 border-navy-foreground overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-navy h-full">
                  <div className="aspect-[4/3] overflow-hidden shrink-0">
                    {event.featured_image_url ? (
                      <img src={event.featured_image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-navy-foreground/10 flex items-center justify-center">
                        <CalendarDays size={32} className="text-gold/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-3">{event.title}</h3>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                        <CalendarDays size={14} className="text-gold shrink-0" />
                        <span>{formatDate(event.starts_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                        <MapPin size={14} className="text-gold shrink-0" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                        <PoundSterling size={14} className="text-gold shrink-0" />
                        <span>{formatPrice(event.price_pence)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-navy-foreground/70 mb-4 flex-1 line-clamp-3">{event.description_plain}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gold group-hover:text-gold/80 transition-colors">
                      Read more <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default EventsSection;
