'use client'

import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  MapPin, Clock, Search, Award, Building2, Users, Quote, X, BookOpen,
  Map, Navigation, ArrowRight, GraduationCap, Stethoscope,
  Globe, Briefcase, Star, AlertCircle, Loader, Flame
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mockFellowships as rawMockFellowships } from "@/data/mockMembersData";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
interface Fellowship {
  id: string;
  title: string;
  hospital: string;
  type: "UK" | "International";
  location: string;
  duration: string;
  description: string;
  fullDescription: string;
  supervisors: string[];
  learningOutcomes?: string[];
  operativeVolume?: { procedure: string; volume: string }[];
  onCall?: Record<string, string>;
  applicationProcess: string;
  prerequisites: string;
  salary: string;
  accommodation?: string;
  accreditations: string[];
  subspecialties: string[];
  testimonials?: { quote: string; name: string; year: string }[];
  imageUrl?: string;
  featured?: boolean;
  latitude?: number;
  longitude?: number;
}

/* ═══════════════════════════════════════════
   TRANSFORM SUPABASE → FELLOWSHIP
   Maps the admin CMS column names to the
   shape the frontend card / modal expects.
   ═══════════════════════════════════════════ */
function transformSupabaseRow(row: any): Fellowship {
  const descText = typeof row.description === "object" && row.description?.text
    ? row.description.text
    : typeof row.description === "string"
    ? row.description
    : "";
  const oc = row.on_call || {};
  return {
    id: row.id,
    title: row.name || "Untitled Fellowship",
    hospital: Array.isArray(row.hospitals) ? row.hospitals.join(" / ") : "",
    type: (row.country || "").toLowerCase().includes("united kingdom") ? "UK" : "International",
    location: [row.city, row.country].filter(Boolean).join(", "),
    duration: row.duration || "12 months",
    description: descText.length > 180 ? descText.slice(0, 180) + "…" : descText,
    fullDescription: descText,
    supervisors: Array.isArray(row.supervisors) ? row.supervisors : [],
    learningOutcomes: row.learning_outcomes
      ? row.learning_outcomes.split("\n").map((l: string) => l.trim()).filter(Boolean)
      : undefined,
    operativeVolume: Array.isArray(row.operative_volume) ? row.operative_volume : undefined,
    onCall: Object.keys(oc).length > 0 ? oc : undefined,
    applicationProcess: row.application_process || "",
    prerequisites: row.prerequisites || "",
    salary: row.salary_per_annum ? `£${Number(row.salary_per_annum).toLocaleString("en-GB")}/year` : "Contact for details",
    accommodation: row.accommodation_available
      ? row.accommodation_notes || "Available"
      : undefined,
    accreditations: Array.isArray(row.accreditation) ? row.accreditation : [],
    subspecialties: Array.isArray(row.subspecialties) ? row.subspecialties : [],
    testimonials: Array.isArray(row.testimonials) ? row.testimonials : [],
    imageUrl: row.featured_image_url || undefined,
    featured: row.status === "published" && row.is_active,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

/* ─── Transform the old mock data shape too ─── */
function transformMockRow(m: (typeof rawMockFellowships)[0]): Fellowship {
  return {
    ...m,
    fullDescription: m.fullDescription,
    applicationProcess: m.applicationProcess,
    imageUrl: undefined,
    featured: false,
  };
}

/* ─── Aspirational city/institution images ─── */
const FALLBACK_IMAGES: Record<string, string> = {
  "london":    "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80&auto=format&fit=crop",
  "oxford":    "https://images.unsplash.com/photo-1590058914813-aa015a85a0c5?w=800&q=80&auto=format&fit=crop",
  "ohio":      "https://images.unsplash.com/photo-1564396619414-0cf247af1b81?w=800&q=80&auto=format&fit=crop",
  "cleveland": "https://images.unsplash.com/photo-1564396619414-0cf247af1b81?w=800&q=80&auto=format&fit=crop",
  "edinburgh": "https://images.unsplash.com/photo-1506377585622-bedcbb5f7f65?w=800&q=80&auto=format&fit=crop",
  "manchester":"https://images.unsplash.com/photo-1605462863863-10d9e47e15ee?w=800&q=80&auto=format&fit=crop",
  "birmingham":"https://images.unsplash.com/photo-1597850805773-0db0da08aadb?w=800&q=80&auto=format&fit=crop",
  "glasgow":   "https://images.unsplash.com/photo-1583225173760-7c14a5887817?w=800&q=80&auto=format&fit=crop",
  "default":   "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80&auto=format&fit=crop",
};

function getImageForFellowship(f: Fellowship): string {
  if (f.imageUrl) return f.imageUrl;
  const loc = f.location.toLowerCase();
  for (const [key, url] of Object.entries(FALLBACK_IMAGES)) {
    if (key !== "default" && loc.includes(key)) return url;
  }
  return FALLBACK_IMAGES.default;
}

/* ─── Subspecialty colour tokens (matches Supabase enum) ─── */
const subspecialtyColors: Record<string, string> = {
  "Robotic":                "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25",
  "Laparoscopic":           "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
  "Open":                   "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25",
  "TAMIS":                  "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25",
  "General":                "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/25",
  "Cancer - Colon":         "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
  "Cancer - Rectal":        "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
  "Cancer - Anal":          "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/25",
  "Cancer - Advanced":      "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25",
  "Peritoneal Malignancy":  "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/25",
  "IBD":                    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25",
  "Intestinal Failure":     "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/25",
  "Pelvic Floor":           "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
  "Proctology":             "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
  "Fistula":                "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25",
  "Abdominal Wall":         "bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/25",
  "Emergency":              "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25",
  "Trauma":                 "bg-orange-600/15 text-orange-800 dark:text-orange-200 border-orange-600/25",
  "Endoscopy":              "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25",
  "Research":               "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
  "Training":               "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/25",
  "Radiology":              "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/25",
};
const getSubspecialtyClass = (tag: string) =>
  subspecialtyColors[tag] ?? "bg-muted/50 text-muted-foreground border-border";

/* ─── Full subspecialty list for filter chips (matches Supabase enum) ─── */
const ALL_SUBSPECIALTIES = [
  "Robotic", "Laparoscopic", "Open", "TAMIS", "General",
  "Cancer - Colon", "Cancer - Rectal", "Cancer - Anal", "Cancer - Advanced", "Peritoneal Malignancy",
  "IBD", "Intestinal Failure",
  "Pelvic Floor", "Proctology", "Fistula",
  "Abdominal Wall",
  "Emergency", "Trauma",
  "Endoscopy", "Research", "Training", "Radiology",
];
const durationOptions = ["All", "6 months", "12 months"] as const;

/* ─── Mapbox token ─── */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";


/* ═══════════════════════════════════════════
   MAPBOX MAP COMPONENT
   ═══════════════════════════════════════════ */
const FellowshipMap = ({
  fellowships,
  onSelect,
}: {
  fellowships: Fellowship[];
  onSelect: (f: Fellowship) => void;
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  /* Inject Mapbox CSS via <link> tag (avoids CSS import issues with Next.js) */
  useEffect(() => {
    const MAPBOX_CSS = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    if (!document.querySelector(`link[href="${MAPBOX_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MAPBOX_CSS;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (cancelled) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-2.0, 53.5],
        zoom: 4.5,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;
    };

    initMap();
    return () => { cancelled = true; };
  }, []);

  // Update markers when fellowships change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const loadMarkers = async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      const bounds = new mapboxgl.LngLatBounds();
      let hasPoints = false;

      fellowships.forEach((f) => {
        if (!f.latitude || !f.longitude) return;
        hasPoints = true;

        const isIntl = f.type === "International";
        const el = document.createElement("div");
        el.style.cssText = `
          width: 32px; height: 32px; border-radius: 50%;
          background: ${isIntl ? "#E5A718" : "#7C3AED"};
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s;
        `;
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", (e) => { e.stopPropagation(); onSelect(f); });

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false })
          .setHTML(`
            <div style="font-family:system-ui;padding:2px 0;">
              <strong style="font-size:13px;">${f.title}</strong><br/>
              <span style="font-size:11px;color:#666;">${f.hospital} · ${f.location}</span>
            </div>
          `);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([f.longitude!, f.latitude!])
          .setPopup(popup)
          .addTo(mapRef.current);

        markersRef.current.push(marker);
        bounds.extend([f.longitude!, f.latitude!]);
      });

      if (hasPoints) {
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 10 });
      }
    };

    loadMarkers();
  }, [fellowships, onSelect]);

  return <div ref={mapContainer} className="w-full h-full" />;
};

/* Map placeholder when no token configured */
const MapPlaceholder = ({ distanceSearch }: { distanceSearch: string }) => (
  <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 bg-navy/5">
    <div className="absolute inset-0 opacity-20">
      {[
        { t: "30%", l: "35%", c: "primary", d: "0s" },
        { t: "25%", l: "55%", c: "gold", d: "0.5s" },
        { t: "45%", l: "42%", c: "primary", d: "1s" },
        { t: "60%", l: "48%", c: "gold", d: "0.3s" },
        { t: "35%", l: "65%", c: "primary", d: "0.8s" },
        { t: "50%", l: "30%", c: "gold", d: "1.2s" },
      ].map((p, i) => (
        <div
          key={i}
          className={`absolute w-3 h-3 rounded-full bg-${p.c} animate-pulse`}
          style={{ top: p.t, left: p.l, animationDelay: p.d }}
        />
      ))}
    </div>
    <Map size={36} className="text-muted-foreground/40 z-10" />
    <div className="text-center z-10">
      <p className="text-sm font-semibold text-muted-foreground">
        {MAPBOX_TOKEN ? "Loading map…" : "Add NEXT_PUBLIC_MAPBOX_TOKEN to enable the map"}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
        Fellowship locations will appear as interactive pins.
      </p>
    </div>
    <div className="flex gap-4 text-[11px] text-muted-foreground/50 z-10">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary/40" /> UK</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gold/40" /> International</span>
    </div>
    {distanceSearch && (
      <Badge variant="outline" className="z-10 text-xs mt-1">
        <Navigation size={10} className="mr-1" /> Searching near: {distanceSearch}
      </Badge>
    )}
  </div>
);


/* ═══════════════════════════════════════════
   FELLOWSHIP CARD
   ═══════════════════════════════════════════ */
const FellowshipCard = ({
  fellowship,
  onSelect,
}: {
  fellowship: Fellowship;
  onSelect: (f: Fellowship) => void;
}) => {
  const imageUrl = getImageForFellowship(fellowship);
  const isInternational = fellowship.type === "International";

  return (
    <div
      onClick={() => onSelect(fellowship)}
      className={`group relative cursor-pointer rounded-2xl overflow-hidden bg-card shadow-sm
        hover:shadow-xl transition-all duration-500 hover:-translate-y-1
        ${fellowship.featured
          ? "border-2 border-gold/40 ring-1 ring-gold/10"
          : "border border-border/60"
        }`}
    >
      {/* Featured flame */}
      {fellowship.featured && (
        <div className="absolute top-3 right-3 z-20">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/90 text-navy text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-md">
            <Flame size={10} /> Featured
          </div>
        </div>
      )}

      {/* ─── Image header ─── */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={imageUrl}
          alt={`${fellowship.hospital} – ${fellowship.location}`}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5" />

        {/* Floating badges — top-left */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge
            className={`text-[10px] font-semibold tracking-wide uppercase backdrop-blur-md shadow-sm border-0 ${
              isInternational
                ? "bg-gold/90 text-navy"
                : "bg-navy/90 text-white"
            }`}
          >
            {isInternational && <Globe size={10} className="mr-1" />}
            {fellowship.type}
          </Badge>
          <Badge className="text-[10px] font-medium backdrop-blur-md bg-black/40 text-white border-0 shadow-sm">
            <Clock size={10} className="mr-1" /> {fellowship.duration}
          </Badge>
        </div>

        {/* Bottom overlay text */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-base font-bold text-white leading-tight tracking-tight">
            {fellowship.title}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-white/80 flex items-center gap-1">
              <Building2 size={11} className="shrink-0" /> {fellowship.hospital}
            </span>
            {fellowship.hospital && (
              <span className="text-white/40">·</span>
            )}
            <span className="text-xs text-white/70 flex items-center gap-1">
              <MapPin size={11} className="shrink-0" /> {fellowship.location}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Card body — flex to equalise heights ─── */}
      <div className="p-4 flex flex-col min-h-[180px]">
        {/* Subspecialty tags */}
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {fellowship.subspecialties.map((s) => (
            <span
              key={s}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSubspecialtyClass(s)}`}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Description — fixed 2-line height */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-grow">
          {fellowship.description}
        </p>

        {/* Accreditation pills with background */}
        {fellowship.accreditations.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {fellowship.accreditations.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full"
              >
                <Award size={10} /> {a}
              </span>
            ))}
          </div>
        )}

        {/* Footer — extra top padding for breathing room */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/40">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users size={12} />
            <span>{fellowship.supervisors.length} supervisor{fellowship.supervisors.length !== 1 ? "s" : ""}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all duration-300">
            View details <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
};


/* ═══════════════════════════════════════════
   STAT PILL (modal)
   ═══════════════════════════════════════════ */
const StatPill = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
    <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon size={16} className="text-primary" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  </div>
);


/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
const FellowshipsPage = () => {
  const [fellowships, setFellowships] = useState<Fellowship[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);

  const [search, setSearch] = useState("");
  const [distanceSearch, setDistanceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "UK" | "International">("All");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [durationFilter, setDurationFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Fellowship | null>(null);
  const [showMap, setShowMap] = useState(true);

  /* ─── Fetch from Supabase → fallback to mock ─── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("fellowships")
          .select("*")
          .eq("status", "published")
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setFellowships(data.map(transformSupabaseRow));
          setDbError(false);
        } else {
          // No published fellowships — use mock data
          setFellowships(rawMockFellowships.map(transformMockRow));
          setDbError(false);
        }
      } catch {
        // Supabase unavailable — use mock data silently
        setFellowships(rawMockFellowships.map(transformMockRow));
        setDbError(true);
      }
      setLoading(false);
    };
    load();
  }, []);

  const toggleTag = (tag: string) =>
    setSelectedTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));

  const filtered = fellowships.filter((f) => {
    const s = search.toLowerCase();
    const matchesSearch = !s ||
      f.title.toLowerCase().includes(s) ||
      f.location.toLowerCase().includes(s) ||
      f.hospital.toLowerCase().includes(s);
    const matchesType = typeFilter === "All" || f.type === typeFilter;
    const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => f.subspecialties.includes(t));
    const matchesDuration = durationFilter === "All" || f.duration === durationFilter;
    return matchesSearch && matchesType && matchesTags && matchesDuration;
  });

  // Sort: featured first
  const sorted = [...filtered].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  const activeFilterCount = (typeFilter !== "All" ? 1 : 0) + selectedTags.length + (durationFilter !== "All" ? 1 : 0);

  const handleSelect = useCallback((f: Fellowship) => setSelected(f), []);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-gold/20 flex items-center justify-center">
          <GraduationCap size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fellowship Database</h1>
          <p className="text-sm text-muted-foreground">Explore colorectal surgery fellowship opportunities across the UK and internationally</p>
        </div>
      </div>

      {/* DB status notice */}
      {dbError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs">
          <AlertCircle size={14} />
          <span>Showing sample data — connect to Supabase to see live fellowships.</span>
        </div>
      )}

      {/* ─── Filters ─── */}
      <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/40">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, hospital, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/60"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["All", "UK", "International"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  typeFilter === type
                    ? "bg-navy text-navy-foreground shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-muted border border-border/60"
                }`}
              >
                {type === "International" && <Globe size={11} className="inline mr-1 -mt-px" />}
                {type}
              </button>
            ))}
            <div className="w-px bg-border/60 mx-1 hidden sm:block" />
            {durationOptions.map((d) => (
              <button
                key={d}
                onClick={() => setDurationFilter(d)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  durationFilter === d
                    ? "bg-navy text-navy-foreground shadow-sm"
                    : "bg-background text-muted-foreground hover:bg-muted border border-border/60"
                }`}
              >
                {d === "All" ? "Any duration" : d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Subspecialty</span>
          {ALL_SUBSPECIALTIES.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-200 ${
                selectedTags.includes(tag)
                  ? getSubspecialtyClass(tag)
                  : "bg-background text-muted-foreground border-border/60 hover:border-primary/30"
              }`}
            >
              {tag}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setTypeFilter("All"); setSelectedTags([]); setDurationFilter("All"); }}
              className="text-xs text-primary hover:underline flex items-center gap-1 ml-2"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* ─── Distance search + map toggle ─── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="relative flex-1 max-w-md">
          <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by distance from address (e.g. Manchester M1 1AA)..."
            value={distanceSearch}
            onChange={(e) => setDistanceSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowMap(!showMap)}>
          <Map size={14} className="mr-1.5" /> {showMap ? "Hide Map" : "Show Map"}
        </Button>
      </div>

      {/* ─── Map ─── */}
      {showMap && (
        <div className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-border/60">
          {MAPBOX_TOKEN ? (
            <FellowshipMap fellowships={sorted} onSelect={handleSelect} />
          ) : (
            <MapPlaceholder distanceSearch={distanceSearch} />
          )}
        </div>
      )}

      {/* ─── Results count ─── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-2"><Loader size={14} className="animate-spin" /> Loading fellowships…</span>
          ) : (
            <><span className="font-semibold text-foreground">{sorted.length}</span> fellowship{sorted.length !== 1 ? "s" : ""} found</>
          )}
        </p>
      </div>

      {/* ═══ CARDS ═══ */}
      {!loading && (
        <div className="grid sm:grid-cols-2 gap-5">
          {sorted.map((fellowship) => (
            <FellowshipCard key={fellowship.id} fellowship={fellowship} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 overflow-hidden">
              <div className="h-48 bg-muted/40 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-muted/40 rounded-full animate-pulse" />
                  <div className="h-5 w-20 bg-muted/40 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!loading && sorted.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border/60">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-lg font-semibold text-muted-foreground">No fellowships found</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">Try adjusting your search or filters</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearch(""); setTypeFilter("All"); setSelectedTags([]); setDurationFilter("All"); }}
          >
            Clear all filters
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          DETAIL MODAL
         ═══════════════════════════════════════════ */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {selected && (
            <>
              {/* ─── Hero image ─── */}
              <div className="relative h-52 sm:h-64 overflow-hidden">
                <img
                  src={getImageForFellowship(selected)}
                  alt={selected.hospital}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {selected.featured && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/90 text-navy text-[10px] font-bold uppercase tracking-wide shadow-sm">
                      <Flame size={10} /> Featured
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className={`text-[10px] font-semibold uppercase tracking-wide border-0 shadow-sm ${
                      selected.type === "International"
                        ? "bg-gold/90 text-navy"
                        : "bg-navy/90 text-white"
                    }`}>
                      {selected.type === "International" && <Globe size={10} className="mr-1" />}
                      {selected.type}
                    </Badge>
                    <Badge className="text-[10px] font-medium bg-black/40 text-white border-0 backdrop-blur-sm">
                      <Clock size={10} className="mr-1" /> {selected.duration}
                    </Badge>
                  </div>
                  <DialogHeader className="text-left">
                    <DialogTitle className="text-xl font-bold text-white tracking-tight">{selected.title}</DialogTitle>
                    <DialogDescription className="text-white/80 text-sm flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1"><Building2 size={13} /> {selected.hospital}</span>
                      {selected.hospital && <span className="text-white/40">·</span>}
                      <span className="flex items-center gap-1"><MapPin size={13} /> {selected.location}</span>
                    </DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              {/* ─── Body ─── */}
              <div className="p-6 space-y-6">
                <p className="text-sm text-foreground leading-relaxed">{selected.fullDescription}</p>

                <div className="grid grid-cols-2 gap-3">
                  <StatPill icon={Briefcase} label="Salary" value={selected.salary} />
                  <StatPill icon={Users} label="Supervisors" value={selected.supervisors.join(", ") || "—"} />
                </div>

                {/* Learning Outcomes */}
                {selected.learningOutcomes && selected.learningOutcomes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <GraduationCap size={13} /> Learning Outcomes
                    </h4>
                    <div className="grid gap-2">
                      {selected.learningOutcomes.map((lo, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 text-[10px] font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{lo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accreditations */}
                {selected.accreditations.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {selected.accreditations.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gold bg-gold/10 border border-gold/20 px-2.5 py-1 rounded-full"
                      >
                        <Award size={11} /> {a}
                      </span>
                    ))}
                  </div>
                )}

                {/* On-Call */}
                {selected.onCall && Object.keys(selected.onCall).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">On-Call Commitment</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(selected.onCall).map(([key, val]) => (
                        <div key={key} className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{key.replace(/_/g, " ")}</p>
                          <p className="text-xs font-semibold text-foreground mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operative Volume */}
                {selected.operativeVolume && selected.operativeVolume.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Stethoscope size={13} /> Expected Operative Volume
                    </h4>
                    <div className="border border-border/60 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="text-left p-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Procedure</th>
                            <th className="text-right p-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Volume/Year</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.operativeVolume.map((row, i) => (
                            <tr key={i} className="border-t border-border/40">
                              <td className="p-3 text-foreground">{row.procedure}</td>
                              <td className="p-3 text-right font-semibold text-foreground tabular-nums">{row.volume}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Info panels */}
                <div className="space-y-3">
                  {selected.prerequisites && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Prerequisites</p>
                      <p className="text-sm text-foreground leading-relaxed">{selected.prerequisites}</p>
                    </div>
                  )}
                  {selected.applicationProcess && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Application Process</p>
                      <p className="text-sm text-foreground leading-relaxed">{selected.applicationProcess}</p>
                    </div>
                  )}
                  {selected.accommodation && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Accommodation</p>
                      <p className="text-sm text-foreground leading-relaxed">{selected.accommodation}</p>
                    </div>
                  )}
                </div>

                {/* Testimonials */}
                {selected.testimonials && selected.testimonials.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star size={13} /> Testimonials
                    </h4>
                    <div className="space-y-3">
                      {selected.testimonials.map((t, i) => (
                        <div key={i} className="relative p-4 rounded-xl bg-gradient-to-br from-gold/5 to-transparent border border-gold/15">
                          <Quote size={20} className="absolute top-3 right-3 text-gold/20" />
                          <p className="text-sm text-foreground italic leading-relaxed pr-8">&ldquo;{t.quote}&rdquo;</p>
                          <p className="text-xs text-muted-foreground mt-2.5 font-semibold">
                            {t.name} <span className="font-normal text-muted-foreground/60">· {t.year}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subspecialties footer */}
                <div className="flex gap-2 flex-wrap pt-3 border-t border-border/40">
                  {selected.subspecialties.map((s) => (
                    <span key={s} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${getSubspecialtyClass(s)}`}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FellowshipsPage;