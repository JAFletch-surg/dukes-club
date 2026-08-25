'use client'
import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { ArrowRight, CalendarDays, MapPin, PoundSterling, Loader } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { eventSummary, formatEventPriceWithMember } from "@/lib/event-display";

// Static imports rather than string paths: next/image then knows each file's
// intrinsic size and serves a card-sized WebP off a srcset. These sources were
// 2000x1545 PNGs weighing 1.4-2.4MB each, and the mobile card renders them into
// a 96px-wide box.
import awrYellow from "@/public/images/events/awr-yellow.png";
import ibdYellow from "@/public/images/events/ibd-yellow.png";
import robot from "@/public/images/events/robot.png";

// An event that picked one of the admin form's brand images stores it as a
// path into /public. Map those back to the imports above so they keep going
// through the optimiser rather than being served as the full-size PNG.
const BRAND_IMAGES: Record<string, StaticImageData> = {
  "/images/events/awr-yellow.png": awrYellow,
  "/images/events/ibd-yellow.png": ibdYellow,
  "/images/events/robot.png": robot,
};

const HOME_EVENT_COUNT = 3;

// Columns only present once supabase/add-event-summary-and-deposit.sql has
// been run. PostgREST rejects the whole select if one is missing, so the
// fetch below falls back to the columns every database has.
const OPTIONAL_COLUMNS = "summary, price_is_refundable_deposit";
const BASE_COLUMNS =
  "id, title, slug, starts_at, ends_at, location, event_type, price_pence, member_price_pence, description_plain, featured_image_url";

type HomeEvent = {
  id: string;
  title: string;
  slug: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  event_type: string | null;
  price_pence: number | null;
  member_price_pence: number | null;
  price_is_refundable_deposit?: boolean | null;
  summary?: string | null;
  description_plain: string | null;
  featured_image_url: string | null;
};

const dayMonthYear = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "22 Apr 2026", or "22–23 Apr 2026" when the event runs over days. */
const formatDateRange = (startsAt: string, endsAt: string | null) => {
  const start = new Date(startsAt);
  if (!endsAt) return dayMonthYear(start);

  const end = new Date(endsAt);
  if (start.toDateString() === end.toDateString()) return dayMonthYear(start);

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${start.getDate()}–${dayMonthYear(end)}`
    : `${dayMonthYear(start)} – ${dayMonthYear(end)}`;
};

const EventsSection = () => {
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        // Anything still to come, including a multi-day event already under
        // way. A null ends_at makes the first test null rather than true, so
        // a one-day event falls through to its start date — which is what
        // should decide for it.
        const now = new Date().toISOString();
        const query = (columns: string) =>
          supabase
            .from("events")
            .select(columns)
            .eq("status", "published")
            .or(`ends_at.gte.${now},starts_at.gte.${now}`)
            .order("starts_at", { ascending: true })
            .limit(HOME_EVENT_COUNT);

        let { data, error } = await query(`${BASE_COLUMNS}, ${OPTIONAL_COLUMNS}`);
        if (error) ({ data, error } = await query(BASE_COLUMNS));
        if (error) throw error;

        setEvents((data || []) as unknown as HomeEvent[]);
      } catch {
        setEvents([]);
      }
      setLoading(false);
    };
    load();
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

        {/* Reserve the loaded grid's height. These events are fetched from
            Supabase after hydration, so without a floor here the spinner's
            small box is replaced by a full grid and everything below the fold
            jumps — a layout shift charged against the whole page. */}
        <div className="md:min-h-[430px]">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader className="animate-spin text-navy-foreground/60" size={24} />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-navy-foreground/60">
            <CalendarDays size={36} className="mx-auto mb-3 opacity-40" />
            <p>No upcoming events right now — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
            {events.map((event) => {
              const brandImage = event.featured_image_url ? BRAND_IMAGES[event.featured_image_url] : undefined;
              const remoteImage = !brandImage && event.featured_image_url ? event.featured_image_url : null;
              const date = formatDateRange(event.starts_at, event.ends_at);
              const price = formatEventPriceWithMember(event);
              const summary = eventSummary(event);

              return (
                <Link key={event.id} href={`/events/${event.slug}`} className="block group">
                  {/* Mobile: compact horizontal card */}
                  <div className="md:hidden flex rounded-lg border-2 border-navy-foreground overflow-hidden bg-navy hover:border-gold/40 transition-colors">
                    <div className="relative w-24 shrink-0 overflow-hidden">
                      {brandImage ? (
                        <Image src={brandImage} alt={event.title} fill className="object-cover" sizes="96px" />
                      ) : remoteImage ? (
                        <img src={remoteImage} alt={event.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                        <span className="flex items-center gap-1"><CalendarDays size={11} className="text-gold" />{date}</span>
                        {event.location && <span className="flex items-center gap-1 truncate"><MapPin size={11} className="text-gold shrink-0" />{event.location}</span>}
                      </div>
                      <span className="text-xs text-navy-foreground/60 flex items-center gap-1"><PoundSterling size={11} className="text-gold" />{price}</span>
                    </div>
                    <div className="flex items-center pr-3">
                      <ArrowRight size={16} className="text-navy-foreground/30 group-hover:text-gold transition-colors" />
                    </div>
                  </div>
                  {/* Desktop: vertical card */}
                  <div className="hidden md:flex md:flex-col rounded-lg border-2 border-navy-foreground overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-navy h-full">
                    <div className="relative aspect-[4/3] overflow-hidden shrink-0">
                      {brandImage ? (
                        <Image src={brandImage} alt={event.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(min-width: 768px) 33vw, 96px" />
                      ) : remoteImage ? (
                        <img src={remoteImage} alt={event.title} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                          <span>{date}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                            <MapPin size={14} className="text-gold shrink-0" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                          <PoundSterling size={14} className="text-gold shrink-0" />
                          <span>{price}</span>
                        </div>
                      </div>
                      <p className="text-sm text-navy-foreground/70 mb-4 flex-1 line-clamp-3">{summary}</p>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-gold group-hover:text-gold/80 transition-colors">
                        Read more <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </section>
  );
};

export default EventsSection;
