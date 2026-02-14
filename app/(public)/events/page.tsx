'use client'
import { useState, useMemo } from "react";


import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { CalendarDays, MapPin, PoundSterling, Search, ArrowRight, X, SlidersHorizontal, ChevronDown, Star } from "lucide-react";
import Link from "next/link";




const subspecialties = [
  "Cancer - Colon", "Cancer - Rectal", "Cancer - Anal", "Cancer - Advanced",
  "Peritoneal Malignancy", "IBD", "Abdominal Wall", "Pelvic Floor",
  "Proctology", "Fistula", "Intestinal Failure", "Emergency", "Trauma",
  "Research", "Endoscopy", "Training", "Radiology", "Robotic",
  "Laparoscopic", "Open", "TAMIS", "General",
] as const;

const eventTypes = ["Conference", "Workshop", "Webinar", "Course", "Masterclass"] as const;

type EventItem = {
  title: string;
  slug: string;
  eventType: (typeof eventTypes)[number];
  subspecialties: (typeof subspecialties)[number][];
  date: string;
  sortDate: string;
  location: string;
  price: string;
  priceValue: number;
  description: string;
  image: string;
  dateAdded: string;
  featured?: boolean;
};

const allEvents: EventItem[] = [
  {
    title: "Intestinal Failure & Abdominal Wall Day",
    slug: "intestinal-failure-abdominal-wall-day",
    eventType: "Conference",
    subspecialties: ["Intestinal Failure", "Abdominal Wall"],
    date: "15 Mar 2026",
    sortDate: "2026-03-15",
    location: "Royal College of Surgeons, London",
    price: "Free",
    priceValue: 0,
    description: "Lecture-based course on complex herniae, intestinal failure, and abdominal wall management. Featuring expert faculty from leading UK centres with case-based discussions and interactive Q&A sessions.",
    image: "/images/events/awr-yellow.png",
    dateAdded: "2025-12-01",
    featured: true,
  },
  {
    title: "ACPGBI 2026: Advanced IBD Surgery Course",
    slug: "acpgbi-2026-advanced-ibd-surgery-course",
    eventType: "Workshop",
    subspecialties: ["IBD", "Laparoscopic"],
    date: "22–23 Apr 2026",
    sortDate: "2026-04-22",
    location: "Birmingham NEC",
    price: "£250",
    priceValue: 250,
    description: "Hands on wet lab workshops on Ileo-anal Pouch and formation of Kono-S anastomosis. Expert consultant faculty.",
    image: "/images/events/ibd-yellow.png",
    dateAdded: "2025-11-15",
  },
  {
    title: "Robotic Cadaveric CME Course",
    slug: "robotic-cadaveric-cme-course",
    eventType: "Workshop",
    subspecialties: ["Robotic", "Cancer - Rectal"],
    date: "10 May 2026",
    sortDate: "2026-05-10",
    location: "Guy's Hospital, London",
    price: "£450 (£300 members)",
    priceValue: 450,
    description: "Hands-on cadaveric training with evening Zoom masterclass.",
    image: "/images/events/robot.png",
    dateAdded: "2026-01-10",
  },
  {
    title: "Pelvic Floor Masterclass",
    slug: "pelvic-floor-masterclass",
    eventType: "Masterclass",
    subspecialties: ["Pelvic Floor", "Proctology"],
    date: "18 Jun 2026",
    sortDate: "2026-06-18",
    location: "St Mark's Hospital, London",
    price: "£175",
    priceValue: 175,
    description: "Comprehensive masterclass covering advanced pelvic floor assessment and management techniques.",
    image: "/images/events/awr-yellow.png",
    dateAdded: "2026-01-20",
  },
  {
    title: "Emergency Colorectal Surgery Webinar",
    slug: "emergency-colorectal-surgery-webinar",
    eventType: "Webinar",
    subspecialties: ["Emergency", "General"],
    date: "5 Jul 2026",
    sortDate: "2026-07-05",
    location: "Online",
    price: "Free",
    priceValue: 0,
    description: "Interactive webinar covering acute management of colorectal emergencies with expert panel discussion.",
    image: "/images/events/ibd-yellow.png",
    dateAdded: "2026-02-01",
  },
  {
    title: "TAMIS & Transanal Surgery Course",
    slug: "tamis-transanal-surgery-course",
    eventType: "Course",
    subspecialties: ["TAMIS", "Cancer - Rectal", "Endoscopy"],
    date: "12 Sep 2026",
    sortDate: "2026-09-12",
    location: "Royal London Hospital",
    price: "£350",
    priceValue: 350,
    description: "Practical course on transanal minimally invasive surgery techniques with live demonstrations.",
    image: "/images/events/robot.png",
    dateAdded: "2026-02-10",
  },
];

const EVENTS_PER_PAGE = 6;

type SortOption = "date" | "price" | "dateAdded";

const EventCard = ({ event }: { event: EventItem }) => (
  <div className="group rounded-lg border-2 border-navy-foreground overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-navy">
    <Link href={`/events/${event.slug}`} className="block">
      <div className="h-24 md:h-auto md:aspect-[4/3] overflow-hidden">
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
    </Link>
    <div className="p-6">
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge className="bg-gold/20 text-gold border-gold/30 hover:bg-gold/30 text-[10px]">
          {event.eventType}
        </Badge>
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
      <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-3">
        {event.title}
      </h3>
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
      <p className="text-sm text-navy-foreground/70 mb-4 line-clamp-2">{event.description}</p>
      <Link
        href={`/events/${event.slug}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold/80 transition-colors"
      >
        Read more <ArrowRight size={14} />
      </Link>
    </div>
  </div>
);

const FilterTagButton = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
      active
        ? "bg-gold text-gold-foreground border-gold shadow-sm"
        : "bg-navy-foreground/5 text-navy-foreground/60 border-navy-foreground/15 hover:border-gold/40 hover:text-navy-foreground/80"
    }`}
  >
    {label}
  </button>
);

const EventsPage = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [selectedSubspecialties, setSelectedSubspecialties] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const toggleFilter = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    setPage(1);
  };

  const featuredEvent = allEvents.find((e) => e.featured);
  const nonFeaturedEvents = allEvents.filter((e) => !e.featured);

  const filteredEvents = useMemo(() => {
    let events = [...nonFeaturedEvents];

    if (search.trim()) {
      const q = search.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.subspecialties.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (selectedSubspecialties.length > 0) {
      events = events.filter((e) =>
        e.subspecialties.some((s) => selectedSubspecialties.includes(s))
      );
    }

    if (selectedEventTypes.length > 0) {
      events = events.filter((e) => selectedEventTypes.includes(e.eventType));
    }

    events.sort((a, b) => {
      if (sortBy === "date") return a.sortDate.localeCompare(b.sortDate);
      if (sortBy === "price") return a.priceValue - b.priceValue;
      return b.dateAdded.localeCompare(a.dateAdded);
    });

    return events;
  }, [search, sortBy, selectedSubspecialties, selectedEventTypes, nonFeaturedEvents]);

  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

  const clearFilters = () => {
    setSearch("");
    setSelectedSubspecialties([]);
    setSelectedEventTypes([]);
    setSortBy("date");
    setPage(1);
  };

  const activeFilterCount = selectedSubspecialties.length + selectedEventTypes.length;
  const hasActiveFilters = search || activeFilterCount > 0;

  const filtersContent = (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Search</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-foreground/40" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pt-3 pb-1 bg-navy-foreground/10 border-navy-foreground/20 text-navy-foreground placeholder:text-navy-foreground/40 focus:border-gold/50 focus:ring-gold/20"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Sort by</p>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full bg-navy-foreground/10 border-navy-foreground/20 text-navy-foreground">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date (soonest)</SelectItem>
            <SelectItem value="price">Price (lowest)</SelectItem>
            <SelectItem value="dateAdded">Recently added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Event Type</p>
        <div className="flex flex-wrap gap-1.5">
          {eventTypes.map((type) => (
            <FilterTagButton
              key={type}
              label={type}
              active={selectedEventTypes.includes(type)}
              onClick={() => toggleFilter(type, selectedEventTypes, setSelectedEventTypes)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Subspecialty</p>
        <div className="flex flex-wrap gap-1.5">
          {subspecialties.map((sub) => (
            <FilterTagButton
              key={sub}
              label={sub}
              active={selectedSubspecialties.includes(sub)}
              onClick={() => toggleFilter(sub, selectedSubspecialties, setSelectedSubspecialties)}
            />
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold/80 transition-colors font-medium"
        >
          <X size={14} /> Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      

      {/* Video Hero Header */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <video
            className="w-full h-full object-cover"
            src="/videos/hero-bg.mp4"
            muted
            autoPlay
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-navy/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy" />
        </div>
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3 animate-fade-in">
            Courses & Webinars
          </p>
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            Events & Courses
          </h1>
          <p className="mt-4 text-navy-foreground/80 max-w-2xl text-base md:text-lg animate-fade-in">
            Browse our upcoming webinars, workshops, and courses designed to enhance your surgical knowledge and skills.
          </p>
        </div>
      </section>

      {/* Mobile filter toggle */}
      <div className="lg:hidden bg-navy border-t border-navy-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <Button
            variant="hero"
            size="default"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="gap-2 w-full"
          >
            <SlidersHorizontal size={16} />
            Search & Filters
            {activeFilterCount > 0 && (
              <span className="bg-gold text-gold-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ml-auto ${mobileFiltersOpen ? "rotate-180" : ""}`} />
          </Button>
          <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <CollapsibleContent className="pt-4 pb-2 animate-accordion-down">
              {filtersContent}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Main content: sidebar + right column */}
      <section className="bg-navy py-10">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">

            {/* Left Sidebar - Desktop only */}
            <aside className="hidden lg:block w-72 xl:w-80 shrink-0">
              <div className="sticky top-24">
                {filtersContent}
              </div>
            </aside>

            {/* Right Column - Featured + Grid */}
            <div className="flex-1 min-w-0 space-y-10">

              {/* Featured Event */}
              {featuredEvent && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={16} className="text-gold fill-gold" />
                    <p className="text-gold font-semibold text-sm tracking-widest uppercase">Featured Event</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-lg border-2 border-navy-foreground overflow-hidden bg-navy">
                    <div className="aspect-[4/3] md:aspect-auto overflow-hidden">
                      <img
                        src={featuredEvent.image}
                        alt={featuredEvent.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <Badge className="bg-gold/20 text-gold border-gold/30 hover:bg-gold/30">
                          {featuredEvent.eventType}
                        </Badge>
                        {featuredEvent.subspecialties.map((sub) => (
                          <Badge
                            key={sub}
                            variant="outline"
                            className="border-navy-foreground/30 text-navy-foreground/70"
                          >
                            {sub}
                          </Badge>
                        ))}
                      </div>
                      <h2 className="text-xl md:text-2xl font-sans font-bold text-navy-foreground mb-3">
                        {featuredEvent.title}
                      </h2>
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/80">
                          <CalendarDays size={14} className="text-gold shrink-0" />
                          <span>{featuredEvent.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/80">
                          <MapPin size={14} className="text-gold shrink-0" />
                          <span>{featuredEvent.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/80">
                          <PoundSterling size={14} className="text-gold shrink-0" />
                          <span>{featuredEvent.price}</span>
                        </div>
                      </div>
                      <p className="text-sm text-navy-foreground/70 mb-5">{featuredEvent.description}</p>
                      <div>
                        <Link href={`/events/${featuredEvent.slug}`}>
                          <Button variant="gold" size="lg">
                            Register Now <ArrowRight className="ml-1" size={16} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Events Grid */}
              <div>
                <p className="text-sm text-navy-foreground/50 mb-6">
                  Showing {paginatedEvents.length} of {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
                </p>

                {filteredEvents.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-navy-foreground/60 text-lg">No events match your filters.</p>
                    <button onClick={clearFilters} className="mt-4 text-gold hover:text-gold/80 text-sm font-medium">
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {paginatedEvents.map((event) => (
                        <EventCard key={event.title} event={event} />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-12">
                        <Button
                          variant="hero"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                              p === page
                                ? "bg-gold text-gold-foreground"
                                : "text-navy-foreground/60 hover:text-navy-foreground"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <Button
                          variant="hero"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default EventsPage;
