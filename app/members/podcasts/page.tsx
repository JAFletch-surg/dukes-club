'use client'
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Search, Play, Clock, Download, Calendar, X, Headphones } from "lucide-react";
import { mockPodcasts } from "@/data/mockMembersData";

const podcastTagOptions = ["Cancer", "IBD", "Pelvic Floor", "Robotic", "Emergency", "Education", "Research"];
export default function Podcasts() {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<"newest" | "most-played">("newest");

  const toggleTag = (tag: string) =>
    setSelectedTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));

  const filtered = useMemo(() => {
    let result = mockPodcasts.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.guest.toLowerCase().includes(search.toLowerCase());
      const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => p.tags.includes(t));
      return matchesSearch && matchesTags;
    });
    if (sort === "most-played") result.sort((a, b) => b.plays - a.plays);
    else result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [search, selectedTags, sort]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Podcasts</h1>
        <p className="text-muted-foreground mt-1">Listen to our podcast series on colorectal surgery topics</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by title or guest..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "most-played")}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="newest">Newest</option>
            <option value="most-played">Most Played</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground font-medium">Tags:</span>
          {podcastTagOptions.map((tag) => (
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

      {/* Podcast list */}
      <div className="space-y-4">
        {filtered.map((podcast) => (
          <Card key={podcast.id} className="border hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-navy flex items-center justify-center shrink-0">
                  <Headphones size={20} className="text-navy-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">Episode {podcast.episode}</p>
                      <h3 className="text-sm font-semibold text-foreground">{podcast.title}</h3>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs">
                        <Play size={12} className="mr-1" /> Play
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <Download size={12} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{podcast.guest}</span>
                    <span>·</span>
                    <span>{new Date(podcast.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {podcast.duration}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{podcast.description}</p>
                  {podcast.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {podcast.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                    <Headphones size={10} /> {podcast.plays} plays
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Mic size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No podcasts found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setSelectedTags([]); }}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};
