'use client'
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, Search, Clock, Calendar, X, Headphones, ChevronDown, ChevronUp, Loader } from "lucide-react";
import { useSupabaseTable } from "@/lib/use-supabase-table";
import { createClient } from "@/lib/supabase/client";

const podcastTagOptions = ["Cancer", "IBD", "Pelvic Floor", "Robotic", "Emergency", "Education", "Research"];

function getSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/spotify\.com\/(?:embed\/)?episode\/([a-zA-Z0-9]+)/)
  return match ? `https://open.spotify.com/embed/episode/${match[1]}?utm_source=generator` : null
}

function fmtDuration(seconds: number): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Podcasts() {
  const { data: allPodcasts, loading } = useSupabaseTable<any>('podcasts', 'created_at', false)
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [podcastGuestNames, setPodcastGuestNames] = useState<Record<string, string>>({});

  // Load podcast_faculty with faculty names
  useEffect(() => {
    const supabase = createClient()
    supabase.from('podcast_faculty').select('podcast_id, faculty:faculty_id(full_name)').then(({ data }: any) => {
      const map: Record<string, string[]> = {}
      ;(data || []).forEach((pf: any) => {
        const name = pf.faculty?.full_name
        if (!name) return
        if (!map[pf.podcast_id]) map[pf.podcast_id] = []
        map[pf.podcast_id].push(name)
      })
      const nameMap: Record<string, string> = {}
      for (const [id, names] of Object.entries(map)) {
        nameMap[id] = names.join(', ')
      }
      setPodcastGuestNames(nameMap)
    })
  }, [])

  const getGuestDisplay = (podcast: any) => podcastGuestNames[podcast.id] || podcast.guest_name || '';

  const toggleTag = (tag: string) =>
    setSelectedTags((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));

  const podcasts = useMemo(() => {
    return allPodcasts
      .filter((p: any) => p.status === 'published')
      .filter((p: any) => {
        const guestDisplay = getGuestDisplay(p)
        const matchesSearch = !search ||
          p.title?.toLowerCase().includes(search.toLowerCase()) ||
          guestDisplay.toLowerCase().includes(search.toLowerCase());
        const matchesTags = selectedTags.length === 0 ||
          selectedTags.some((t) => (p.subspecialties || []).includes(t));
        return matchesSearch && matchesTags;
      });
  }, [allPodcasts, search, selectedTags, podcastGuestNames]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Podcasts</h1>
        <p className="text-muted-foreground mt-1">Listen to our podcast series on colorectal surgery topics</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by title or guest..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
        {podcasts.map((podcast: any) => {
          const embedUrl = getSpotifyEmbedUrl(podcast.spotify_url)
          const isExpanded = expandedId === podcast.id
          return (
            <Card key={podcast.id} className="border hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-navy flex items-center justify-center shrink-0">
                    <Headphones size={20} className="text-navy-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {podcast.episode_number && (
                          <p className="text-xs text-muted-foreground font-medium mb-0.5">Episode {podcast.episode_number}</p>
                        )}
                        <h3 className="text-sm font-semibold text-foreground">{podcast.title}</h3>
                      </div>
                      {embedUrl && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : podcast.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent transition-colors shrink-0"
                        >
                          <Headphones size={12} />
                          {isExpanded ? 'Hide' : 'Listen'}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                      {getGuestDisplay(podcast) && <span>{getGuestDisplay(podcast)}</span>}
                      {getGuestDisplay(podcast) && podcast.published_at && <span>·</span>}
                      {podcast.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(podcast.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                      {podcast.duration_seconds > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {fmtDuration(podcast.duration_seconds)}</span>
                        </>
                      )}
                    </div>
                    {podcast.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{podcast.description}</p>
                    )}
                    {(podcast.subspecialties || []).length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {podcast.subspecialties.map((t: string) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                    {/* Spotify embed */}
                    {isExpanded && embedUrl && (
                      <div className="mt-4" style={{ borderRadius: 12, overflow: 'hidden' }}>
                        <iframe
                          src={embedUrl}
                          width="100%"
                          height="352"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          style={{ borderRadius: 12 }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {podcasts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Mic size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No podcasts found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filters</p>
          {(search || selectedTags.length > 0) && (
            <button
              className="mt-3 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
              onClick={() => { setSearch(""); setSelectedTags([]); }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
