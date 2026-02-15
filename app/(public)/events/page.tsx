'use client'
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { CalendarDays, MapPin, PoundSterling, Search, ArrowRight, X, SlidersHorizontal, ChevronDown, Star, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const subspecialties = [
  "Cancer - Colon", "Cancer - Rectal", "Cancer - Anal", "Cancer - Advanced",
  "Peritoneal Malignancy", "IBD", "Abdominal Wall", "Pelvic Floor",
  "Proctology", "Fistula", "Intestinal Failure", "Emergency", "Trauma",
  "Research", "Endoscopy", "Training", "Radiology", "Robotic",
  "Laparoscopic", "Open", "TAMIS", "General",
] as const;

const eventTypes = ["Conference", "Workshop", "Webinar", "Course", "Masterclass", "In Person Course", "Online Lecture", "Hybrid", "Practical Workshop"] as const;

const EVENTS_PER_PAGE = 6;
type SortOption = "date" | "price" | "dateAdded";

const formatPrice = (pence: number | null) => {
  if (!pence || pence === 0) return "Free";
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const EventCard = ({ event }: { event: any }) => (
  <div className="group rounded-lg border-2 border-navy-foreground overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-navy">
    <Link href={`/events/${event.slug}`} className="block">
      <div className="h-24 md:h-auto md:aspect-[4/3] overflow-hidden">
        {event.featured_image_url ? (
          <img src={event.featured_image_url} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-navy-foreground/10 flex items-center justify-center">
            <CalendarDays size={32} className="text-gold/40" />
          </div>
        )}
      </div>
    </Link>
    <div className="p-6">
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge className="bg-gold/20 text-gold border-gold/30 hover:bg-gold/30 text-[10px]">
          {event.event_type}
        </Badge>
        {(event.subspecialties || []).slice(0, 3).map((sub: string) => (
          <Badge key={sub} variant="outline" className="border-navy-foreground/30 text-navy-foreground/70 text-[10px]">
            {sub}
          </Badge>
        ))}
      </div>
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
          <span>
            {formatPrice(event.price_pence)}
            {event.member_price_pence != null && event.member_price_pence !== event.price_pence && ` (${formatPrice(event.member_price_pence)} members)`}
          </span>
        </div>
      </div>
      <p className="text-sm text-navy-foreground/70 mb-4 line-clamp-2">{event.description_plain}</p>
      <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold/80 transition-colors">
        Read more <ArrowRight size={14} />
      </Link>
    </div>
  </div>
);

const FilterTagButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
      active
        ? "bg-gold text-gold-foreground border-gold"
        : "bg-navy-foreground/5 text-navy-foreground/60 border-navy-foreground/20 hover:border-gold/50 hover:text-navy-foreground"
    }`}
  >
    {label}
  </button>
);

const EventsPage = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("date");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .order('starts_at', { ascending: true });
      setEvents(data || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const toggleSub = (s: string) => {
    setSelectedSubs((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedSubs([]);
    setSelectedType("all");
    setSort("date");
    setPage(1);
  };

  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.title?.toLowerCase().includes(q) ||
        e.description_plain?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
      );
    }

    if (selectedType !== "all") {
      result = result.filter((e) => e.event_type === selectedType);
    }

    if (selectedSubs.length > 0) {
      result = result.filter((e) =>
        (e.subspecialties || []).some((sub: string) => selectedSubs.includes(sub))
      );
    }

    result.sort((a, b) => {
      if (sort === "date") return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      if (sort === "price") return (a.price_pence || 0) - (b.price_pence || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [events, search, selectedSubs, selectedType, sort]);

  const featuredEvent = filteredEvents.find((e) => e.is_featured);
  const nonFeatured = filteredEvents.filter((e) => !e.is_featured || e !== featuredEvent);
  const totalPages = Math.ceil(nonFeatured.length / EVENTS_PER_PAGE);
  const paginatedEvents = nonFeatured.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

  const activeFilterCount = selectedSubs.length + (selectedType !== "all" ? 1 : 0) + (search ? 1 : 0);

  const filtersContent = (
    <div className="space-y-5">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-foreground/40" />
        <Input
          placeholder="Search events..."
          className="pl-9 bg-navy-foreground/5 border-navy-foreground/20 text-navy-foreground placeholder:text-navy-foreground/40"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Event Type</p>
        <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setPage(1); }}>
          <SelectTrigger className="bg-navy-foreground/5 border-navy-foreground/20 text-navy-foreground">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {eventTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Sort By</p>
        <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(1); }}>
          <SelectTrigger className="bg-navy-foreground/5 border-navy-foreground/20 text-navy-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date (soonest)</SelectItem>
            <SelectItem value="price">Price (lowest)</SelectItem>
            <SelectItem value="dateAdded">Recently added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Subspecialty</p>
        <div className="flex flex-wrap gap-1.5">
          {subspecialties.map((s) => (
            <FilterTagButton key={s} label={s} active={selectedSubs.includes(s)} onClick={() => toggleSub(s)} />
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-navy-foreground/50 hover:text-navy-foreground transition-colors">
          <X size={14} /> Clear all filters
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Video Hero Header */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <video className="w-full h-full object-cover" src="/videos/hero-bg.mp4" muted autoPlay loop playsInline />
          <div className="absolute inset-0 bg-navy/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy" />
        </div>
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3 animate-fade-in">Courses & Webinars</p>
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">Events & Courses</h1>
          <p className="mt-4 text-navy-foreground/80 max-w-2xl text-base md:text-lg animate-fade-in">
            Browse our upcoming webinars, workshops, and courses designed to enhance your surgical knowledge and skills.
          </p>
        </div>
      </section>

      {/* Mobile filter toggle */}
      <div className="lg:hidden bg-navy border-t border-navy-foreground/10">
        <div className="container mx-auto px-4 py-3">
          <Button variant="hero" size="default" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)} className="gap-2 w-full">
            <SlidersHorizontal size={16} />
            Search & Filters
            {activeFilterCount > 0 && (
              <span className="bg-gold text-gold-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>
            )}
            <ChevronDown size={14} className={`transition-transform ml-auto ${mobileFiltersOpen ? "rotate-180" : ""}`} />
          </Button>
          <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <CollapsibleContent className="pt-4 pb-2 animate-accordion-down">{filtersContent}</CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Main content */}
      <section className="bg-navy py-10">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <aside className="hidden lg:block w-72 xl:w-80 shrink-0">
              <div className="sticky top-24">{filtersContent}</div>
            </aside>

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
                      {featuredEvent.featured_image_url ? (
                        <img src={featuredEvent.featured_image_url} alt={featuredEvent.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-navy-foreground/10 flex items-center justify-center">
                          <CalendarDays size={48} className="text-gold/30" />
                        </div>
                      )}
                    </div>
                    <div className="p-6 md:p-8 flex flex-col justify-center">
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <Badge className="bg-gold/20 text-gold border-gold/30 hover:bg-gold/30">{featuredEvent.event_type}</Badge>
                        {(featuredEvent.subspecialties || []).map((sub: string) => (
                          <Badge key={sub} variant="outline" className="border-navy-foreground/30 text-navy-foreground/70">{sub}</Badge>
                        ))}
                      </div>
                      <h2 className="text-xl md:text-2xl font-sans font-bold text-navy-foreground mb-3">{featuredEvent.title}</h2>
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/80">
                          <CalendarDays size={14} className="text-gold shrink-0" /><span>{formatDate(featuredEvent.starts_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/80">
                          <MapPin size={14} className="text-gold shrink-0" /><span>{featuredEvent.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-navy-foreground/80">
                          <PoundSterling size={14} className="text-gold shrink-0" />
                          <span>{formatPrice(featuredEvent.price_pence)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-navy-foreground/70 mb-5">{featuredEvent.description_plain}</p>
                      <div>
                        <Link href={`/events/${featuredEvent.slug}`}>
                          <Button variant="gold" size="lg">Register Now <ArrowRight className="ml-1" size={16} /></Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Events Grid */}
              <div>
                <p className="text-sm text-navy-foreground/50 mb-6">
                  Showing {paginatedEvents.length} of {nonFeatured.length} event{nonFeatured.length !== 1 ? "s" : ""}
                </p>

                {nonFeatured.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-navy-foreground/60 text-lg">No events match your filters.</p>
                    <button onClick={clearFilters} className="mt-4 text-gold hover:text-gold/80 text-sm font-medium">Clear filters</button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {paginatedEvents.map((event) => <EventCard key={event.id} event={event} />)}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-12">
                        <Button variant="hero" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${p === page ? "bg-gold text-gold-foreground" : "text-navy-foreground/60 hover:text-navy-foreground"}`}>{p}</button>
                        ))}
                        <Button variant="hero" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
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