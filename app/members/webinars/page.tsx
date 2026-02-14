'use client'
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Radio, Mic, Search, Play, Eye, Clock, ExternalLink,
  Download, Calendar, Users, X, Headphones,
} from "lucide-react";
import { mockWebinars } from "@/data/mockMembersData";

const webinarTagOptions = ["Cancer", "Rectal Cancer", "IBD", "Pelvic Floor", "Robotic", "Emergency"];

export default function LiveWebinars() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (tag: string) =>
    setSelectedTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));

  const filtered = useMemo(() => {
    return mockWebinars.filter((w) => {
      const matchesSearch = w.title.toLowerCase().includes(search.toLowerCase()) || w.speaker.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || w.status === statusFilter;
      const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => w.tags.includes(t));
      return matchesSearch && matchesStatus && matchesTags;
    });
  }, [search, statusFilter, selectedTags]);

  const upcoming = filtered.filter((w) => w.status === "upcoming");
  const past = filtered.filter((w) => w.status === "past");

  const getCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "Starting soon";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Live Webinars</h1>
        <p className="text-muted-foreground mt-1">Join live educational sessions and watch past recordings</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search webinars..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            {(["all", "upcoming", "past"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground font-medium">Tags:</span>
          {webinarTagOptions.map((tag) => (
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
          {selectedTags.length > 0 && (
            <button onClick={() => setSelectedTags([])} className="text-xs text-primary hover:underline flex items-center gap-1">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Upcoming */}
      {(statusFilter === "all" || statusFilter === "upcoming") && upcoming.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Upcoming Webinars</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {upcoming.map((webinar) => (
              <Card key={webinar.id} className="border hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{webinar.title}</h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">{webinar.streamType}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{webinar.speaker} · {webinar.duration}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{webinar.description}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {webinar.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar size={12} />
                      <span>{new Date(webinar.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <Badge className="text-[10px] bg-gold/10 text-gold border-gold/30" variant="outline">
                      <Clock size={10} className="mr-1" /> {getCountdown(webinar.date)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={webinar.accessLevel === "Members only" ? "default" : "secondary"} className="text-[10px]">
                      {webinar.accessLevel}
                    </Badge>
                    {webinar.zoomLink ? (
                      <Button size="sm" variant="outline" className="text-xs" asChild>
                        <a href={webinar.zoomLink} target="_blank" rel="noopener noreferrer">
                          Join on Zoom <ExternalLink size={12} className="ml-1" />
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs" disabled>
                        Live Stream
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {(statusFilter === "all" || statusFilter === "past") && past.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Past Webinars</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((webinar) => (
              <Card key={webinar.id} className="border overflow-hidden cursor-pointer hover:shadow-md transition-shadow group">
                <div className="relative aspect-video bg-navy flex items-center justify-center">
                  <Play size={32} className="text-navy-foreground/60 group-hover:text-navy-foreground transition-colors" />
                  <span className="absolute bottom-2 right-2 bg-foreground/70 text-background text-[10px] font-mono px-1.5 py-0.5 rounded">
                    {webinar.duration}
                  </span>
                </div>
                <CardContent className="p-4">
                  <div className="flex gap-1 flex-wrap mb-2">
                    {webinar.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
                    ))}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2">{webinar.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{webinar.speaker}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{new Date(webinar.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {webinar.views && <span className="flex items-center gap-1"><Eye size={12} /> {webinar.views}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Radio size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No webinars found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your filters</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setStatusFilter("all"); setSelectedTags([]); }}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

// =========== PODCASTS ===========

const podcastTagOptions = ["Robotic", "Laparoscopic", "Rectal Cancer", "TAMIS", "IBD", "Proctology"];

