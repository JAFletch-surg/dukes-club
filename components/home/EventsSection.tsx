'use client'
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { ArrowRight, CalendarDays, MapPin, PoundSterling } from "lucide-react";




const upcomingEvents = [
  {
    title: "Intestinal Failure & Abdominal Wall Day",
    slug: "intestinal-failure-abdominal-wall-day",
    tag: "Conference",
    date: "15 Mar 2026",
    location: "Royal College of Surgeons, London",
    price: "Free",
    description:
      "Lecture-based course on complex herniae, intestinal failure, and abdominal wall management.",
    image: "/images/events/awr-yellow.png",
  },
  {
    title: "ACPGBI 2026: Advanced IBD Surgery Course",
    slug: "advanced-ibd-surgery-course",
    tag: "Workshop",
    date: "22–23 Apr 2026",
    location: "Birmingham NEC",
    price: "£250",
    description:
      "Hands on wet lab workshops on Ileo-anal Pouch and formation of Kono-S anastomosis. Expert consultant faculty.",
    image: "/images/events/ibd-yellow.png",
  },
  {
    title: "Robotic Cadaveric CME Course",
    slug: "robotic-cadaveric-cme-course",
    tag: "Workshop",
    date: "10 May 2026",
    location: "Guy's Hospital, London",
    price: "£450 (£300 members)",
    description:
      "Hands-on cadaveric training with evening Zoom masterclass.",
    image: "/images/events/robot.png",
  },
];

const EventsSection = () => {
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
          {upcomingEvents.map((event) => (
            <Link key={event.title} href={`/events/${event.slug}`} className="block group">
              {/* Mobile: compact horizontal card */}
              <div className="md:hidden flex rounded-lg border-2 border-navy-foreground overflow-hidden bg-navy hover:border-gold/40 transition-colors">
                <div className="w-24 shrink-0 overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
                  <span className="text-[10px] font-semibold text-gold uppercase tracking-wide">{event.tag}</span>
                  <h3 className="text-sm font-sans font-semibold text-navy-foreground leading-tight line-clamp-2">{event.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-navy-foreground/60">
                    <span className="flex items-center gap-1"><CalendarDays size={11} className="text-gold" />{event.date}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} className="text-gold" />{event.location}</span>
                  </div>
                  <span className="text-xs text-navy-foreground/60 flex items-center gap-1"><PoundSterling size={11} className="text-gold" />{event.price}</span>
                </div>
                <div className="flex items-center pr-3">
                  <ArrowRight size={16} className="text-navy-foreground/30 group-hover:text-gold transition-colors" />
                </div>
              </div>
              {/* Desktop: vertical card */}
              <div className="hidden md:block rounded-lg border-2 border-navy-foreground overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-navy">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={event.image} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-3">{event.title}</h3>
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                      <CalendarDays size={14} className="text-gold shrink-0" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                      <MapPin size={14} className="text-gold shrink-0" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-navy-foreground/70">
                      <PoundSterling size={14} className="text-gold shrink-0" />
                      <span>{event.price}</span>
                    </div>
                  </div>
                  <p className="text-sm text-navy-foreground/70 mb-4">{event.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-gold group-hover:text-gold/80 transition-colors">
                    Read more <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventsSection;
