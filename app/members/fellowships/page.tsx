'use client'
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MapPin, Clock, Search, Award, Building2, Users, Quote, X, BookOpen, Map, Navigation } from "lucide-react";
import { mockFellowships } from "@/data/mockMembersData";

type Fellowship = typeof mockFellowships[0];

const subspecialtyFilterOptions = ["Pelvic Floor", "IBD", "Robotic", "Laparoscopic", "Cancer", "TAMIS"];
const durationOptions = ["All", "6 months", "12 months"] as const;

const FellowshipsPage = () => {
  const [search, setSearch] = useState("");
  const [distanceSearch, setDistanceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "UK" | "International">("All");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [durationFilter, setDurationFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Fellowship | null>(null);
  const [showMap, setShowMap] = useState(true);

  const toggleTag = (tag: string) =>
    setSelectedTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));

  const filtered = mockFellowships.filter((f) => {
    const matchesSearch = f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.location.toLowerCase().includes(search.toLowerCase()) ||
      f.hospital.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "All" || f.type === typeFilter;
    const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => f.subspecialties.includes(t));
    const matchesDuration = durationFilter === "All" || f.duration === durationFilter;
    return matchesSearch && matchesType && matchesTags && matchesDuration;
  });

  const activeFilterCount = (typeFilter !== "All" ? 1 : 0) + selectedTags.length + (durationFilter !== "All" ? 1 : 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fellowship Database</h1>
        <p className="text-muted-foreground mt-1">Explore colorectal surgery fellowship opportunities</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, hospital, or location..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["All", "UK", "International"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  typeFilter === type ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {type}
              </button>
            ))}
            {durationOptions.map((d) => (
              <button
                key={d}
                onClick={() => setDurationFilter(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  durationFilter === d ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {d === "All" ? "Any duration" : d}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground font-medium">Subspecialty:</span>
          {subspecialtyFilterOptions.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                selectedTags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {tag}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setTypeFilter("All"); setSelectedTags([]); setDurationFilter("All"); }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Distance Search */}
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
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setShowMap(!showMap)}
        >
          <Map size={14} className="mr-1.5" /> {showMap ? "Hide Map" : "Show Map"}
        </Button>
      </div>

      {/* Map Placeholder */}
      {showMap && (
        <Card className="border overflow-hidden">
          <div className="relative w-full h-64 sm:h-80 bg-navy/5 flex flex-col items-center justify-center gap-3">
            {/* Decorative dots representing fellowship locations */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-[30%] left-[35%] w-3 h-3 rounded-full bg-primary animate-pulse" />
              <div className="absolute top-[25%] left-[55%] w-3 h-3 rounded-full bg-gold animate-pulse" style={{ animationDelay: "0.5s" }} />
              <div className="absolute top-[45%] left-[42%] w-3 h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: "1s" }} />
              <div className="absolute top-[60%] left-[48%] w-3 h-3 rounded-full bg-gold animate-pulse" style={{ animationDelay: "0.3s" }} />
              <div className="absolute top-[35%] left-[65%] w-3 h-3 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.8s" }} />
              <div className="absolute top-[50%] left-[30%] w-3 h-3 rounded-full bg-gold animate-pulse" style={{ animationDelay: "1.2s" }} />
            </div>
            <Map size={36} className="text-muted-foreground/40" />
            <div className="text-center z-10">
              <p className="text-sm font-semibold text-muted-foreground">Interactive Map Coming Soon</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                Search fellowships by distance from your location. Powered by Mapbox.
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
        </Card>
      )}

      {/* Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((fellowship) => (
          <Card key={fellowship.id} className="border hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(fellowship)}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{fellowship.title}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Building2 size={11} /> {fellowship.hospital}
                  </p>
                </div>
                <Badge variant={fellowship.type === "UK" ? "default" : "secondary"} className="text-[10px] shrink-0">
                  {fellowship.type}
                </Badge>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><MapPin size={12} /> {fellowship.location}</p>
                <p className="flex items-center gap-1.5"><Clock size={12} /> {fellowship.duration}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {fellowship.subspecialties.map((s) => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{s}</span>
                ))}
              </div>
              {fellowship.accreditations.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {fellowship.accreditations.map((a) => (
                    <Badge key={a} variant="outline" className="text-[10px] border-gold/30 text-gold">
                      <Award size={8} className="mr-0.5" /> {a}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground line-clamp-2">{fellowship.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No fellowships found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters</p>
          <Button variant="outline" size="sm" className="mt-3"
            onClick={() => { setSearch(""); setTypeFilter("All"); setSelectedTags([]); setDurationFilter("All"); }}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle>{selected.title}</DialogTitle>
                  <Badge variant={selected.type === "UK" ? "default" : "secondary"}>{selected.type}</Badge>
                </div>
                <DialogDescription className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1"><Building2 size={14} /> {selected.hospital}</span>
                  <span className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><MapPin size={14} /> {selected.location}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {selected.duration}</span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-foreground leading-relaxed">{selected.fullDescription}</p>

                {/* Learning Outcomes */}
                {selected.learningOutcomes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Learning Outcomes</p>
                    <ul className="space-y-1">
                      {selected.learningOutcomes.map((lo, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span> {lo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Accreditations */}
                {selected.accreditations.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {selected.accreditations.map((a) => (
                      <Badge key={a} variant="outline" className="text-xs border-gold/30 text-gold">
                        <Award size={10} className="mr-1" /> {a}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Supervisors</p>
                    <p className="text-sm text-foreground">{selected.supervisors.join(", ")}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Salary</p>
                    <p className="text-sm text-foreground">{selected.salary}</p>
                  </div>
                </div>

                {/* On-Call */}
                {selected.onCall && typeof selected.onCall === "object" && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">On-Call Commitment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(selected.onCall).map(([key, val]) => (
                        <div key={key} className="p-2 rounded-lg bg-muted/30 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                          <p className="text-xs font-medium text-foreground">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operative Volume */}
                {selected.operativeVolume && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Expected Operative Volume</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30">
                            <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Procedure</th>
                            <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">Volume/Year</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.operativeVolume.map((row, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="p-2.5 text-foreground">{row.procedure}</td>
                              <td className="p-2.5 text-right font-medium text-foreground">{row.volume}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Prerequisites & Application */}
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prerequisites</p>
                  <p className="text-sm text-foreground">{selected.prerequisites}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Application Process</p>
                  <p className="text-sm text-foreground">{selected.applicationProcess}</p>
                </div>
                {selected.accommodation && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Accommodation</p>
                    <p className="text-sm text-foreground">{selected.accommodation}</p>
                  </div>
                )}

                {/* Testimonials */}
                {selected.testimonials && selected.testimonials.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Testimonials</p>
                    <div className="space-y-3">
                      {selected.testimonials.map((t, i) => (
                        <Card key={i} className="border">
                          <CardContent className="p-4">
                            <div className="flex gap-3">
                              <Quote size={18} className="text-gold shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm text-foreground italic leading-relaxed">"{t.quote}"</p>
                                <p className="text-xs text-muted-foreground mt-2 font-medium">{t.name} · {t.year}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subspecialties */}
                <div className="flex gap-2 flex-wrap">
                  {selected.subspecialties.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
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
