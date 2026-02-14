'use client'
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Play, Search, Eye, Video, X } from "lucide-react";
import { mockVideos } from "@/data/mockMembersData";

const categories = ["All", "Operative", "Complications", "Webinar", "Education", "Lecture"];
const sortOptions = ["Newest", "Most Viewed", "Duration"] as const;
const tagOptions = ["Cancer", "Rectal Cancer", "IBD", "Pelvic Floor", "Robotic", "Laparoscopic", "TAMIS", "Emergency", "Fistula", "Proctology", "Peritoneal Malignancy"];

const VideoArchive = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<typeof sortOptions[number]>("Newest");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filtered = useMemo(() => {
    let result = mockVideos.filter((v) => {
      const matchesSearch =
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.speaker.toLowerCase().includes(search.toLowerCase()) ||
        v.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = category === "All" || v.category === category;
      const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => v.tags.includes(t));
      return matchesSearch && matchesCategory && matchesTags;
    });

    if (sort === "Most Viewed") result.sort((a, b) => b.views - a.views);
    else if (sort === "Duration") {
      const toSec = (d: string) => { const [m, s] = d.split(":").map(Number); return m * 60 + s; };
      result.sort((a, b) => toSec(b.duration) - toSec(a.duration));
    } else result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return result;
  }, [search, category, sort, selectedTags]);

  const activeFilterCount = (category !== "All" ? 1 : 0) + selectedTags.length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Video Library</h1>
        <p className="text-muted-foreground mt-1">Educational videos, operative recordings, and lectures</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, speaker, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sortOptions[number])}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            {sortOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                category === cat
                  ? "bg-navy text-navy-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tag pills */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground font-medium">Tags:</span>
          {tagOptions.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {tag}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setCategory("All"); setSelectedTags([]); }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((video) => (
          <Card key={video.id} className="border overflow-hidden cursor-pointer hover:shadow-md transition-shadow group">
            <div className="relative aspect-video bg-navy flex items-center justify-center">
              <Play size={32} className="text-navy-foreground/60 group-hover:text-navy-foreground transition-colors" />
              <Badge className="absolute top-2 left-2 text-[10px]" variant="secondary">
                {video.category}
              </Badge>
              <span className="absolute bottom-2 right-2 bg-foreground/70 text-background text-[10px] font-mono px-1.5 py-0.5 rounded">
                {video.duration}
              </span>
            </div>
            <CardContent className="p-4">
              {video.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {video.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{video.title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5">{video.speaker}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{new Date(video.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="flex items-center gap-1"><Eye size={12} /> {video.views}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Video size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No videos found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => { setSearch(""); setCategory("All"); setSelectedTags([]); }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

export default VideoArchive;
