'use client'
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";

import { Input } from "@/components/ui/input";
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
import { Search, ArrowRight, X, SlidersHorizontal, ChevronDown, Newspaper, Star, User, Loader } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const categories = [
  "Announcement", "Education", "Careers", "Research",
  "Events", "Policy", "Member News", "General",
] as const;

type NewsItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  date: string;
  sortDate: string;
  description: string;
  featured?: boolean;
  imageUrl?: string;
  authorName?: string;
  authorPhoto?: string;
};

const NEWS_PER_PAGE = 6;

type SortOption = "date" | "dateAdded";

const NewsCard = ({ item }: { item: NewsItem }) => (
  <div className="group rounded-lg border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card">
    <div className="relative h-48 overflow-hidden bg-navy">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Newspaper className="text-navy-foreground/40 group-hover:text-gold transition-colors" size={48} />
        </div>
      )}
      {item.featured && (
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/90 text-navy text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-md">
            <Star size={10} className="fill-current" /> Featured
          </span>
        </div>
      )}
    </div>
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/10 text-gold">
          {item.category}
        </span>
        <span className="text-xs text-muted-foreground">{item.date}</span>
      </div>
      <h3 className="text-lg font-sans font-semibold text-card-foreground mb-2">
        {item.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{item.description}</p>
      <div className="flex items-center justify-between">
        {item.authorName && (
          <div className="flex items-center gap-2">
            {item.authorPhoto
              ? <img src={item.authorPhoto} alt="" className="w-6 h-6 rounded-full object-cover" />
              : <User size={14} className="text-muted-foreground" />
            }
            <span className="text-xs text-muted-foreground">{item.authorName}</span>
          </div>
        )}
        <Link
          href={`/news/${item.slug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold/80 transition-colors ml-auto"
        >
          Read more <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  </div>
);

const NewsPage = () => {
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  /* Fetch from Supabase */
  useEffect(() => {
    const load = async () => {
      setDbLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("status", "published")
          .order("published_at", { ascending: false });

        if (error) throw error;
        if (data) {
          setAllNews(data.map((p: any) => ({
            id: p.id,
            title: p.title || "",
            slug: p.slug || "",
            category: p.category || "General",
            date: p.published_at
              ? new Date(p.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "",
            sortDate: p.published_at || p.created_at || "",
            description: p.excerpt || p.content_plain?.slice(0, 200) || "",
            featured: p.is_featured,
            imageUrl: p.featured_image_url || undefined,
            authorName: p.author_name || undefined,
            authorPhoto: p.author_photo_url || undefined,
          })));
        }
      } catch {
        // Fallback: empty state
        setAllNews([]);
      }
      setDbLoading(false);
    };
    load();
  }, []);

  const featuredItem = allNews.find((n) => n.featured);

  const toggleFilter = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setPage(1);
  };

  const nonFeaturedItems = allNews.filter((n) => !n.featured);

  const filteredNews = useMemo(() => {
    let items = [...nonFeaturedItems];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategories.length > 0) {
      items = items.filter((n) => selectedCategories.includes(n.category));
    }

    items.sort((a, b) => {
      if (sortBy === "date") return b.sortDate.localeCompare(a.sortDate);
      return b.sortDate.localeCompare(a.sortDate);
    });

    return items;
  }, [search, sortBy, selectedCategories, nonFeaturedItems]);

  const totalPages = Math.ceil(filteredNews.length / NEWS_PER_PAGE);
  const paginatedNews = filteredNews.slice((page - 1) * NEWS_PER_PAGE, page * NEWS_PER_PAGE);

  const clearFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setSortBy("date");
    setPage(1);
  };

  const activeFilterCount = selectedCategories.length;
  const hasActiveFilters = search || activeFilterCount > 0;

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
            Latest Updates
          </p>
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            News & Blog
          </h1>
          <p className="mt-4 text-navy-foreground/80 max-w-2xl text-base md:text-lg animate-fade-in">
            Stay informed with the latest news, announcements, and updates from the Dukes' Club community.
          </p>
        </div>
      </section>

      {/* Filters & Search — always above content */}
      <section className="bg-navy border-t border-navy-foreground/10 sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-foreground/40" />
              <Input
                placeholder="Search news..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 pt-3 pb-1 bg-navy-foreground/10 border-navy-foreground/20 text-navy-foreground placeholder:text-navy-foreground/40 focus:border-gold/50 focus:ring-gold/20"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-48 bg-navy-foreground/10 border-navy-foreground/20 text-navy-foreground">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (newest)</SelectItem>
                <SelectItem value="dateAdded">Recently added</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="hero"
              size="default"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="gap-2"
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-gold text-gold-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={14} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>

          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent className="pt-4 pb-2 space-y-4 animate-accordion-down">
              <div>
                <p className="text-xs font-semibold text-navy-foreground/50 uppercase tracking-wider mb-2">Category</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleFilter(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                        selectedCategories.includes(cat)
                          ? "bg-gold text-gold-foreground border-gold shadow-sm"
                          : "bg-navy-foreground/5 text-navy-foreground/60 border-navy-foreground/15 hover:border-gold/40 hover:text-navy-foreground/80"
                      }`}
                    >
                      {cat}
                    </button>
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
            </CollapsibleContent>
          </Collapsible>
        </div>
      </section>

      {/* Featured Article */}
      {featuredItem && (
        <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }}>
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center gap-2 mb-6">
              <Star size={16} className="text-white fill-white" />
              <p className="text-white font-semibold text-sm tracking-widest uppercase">Featured Article</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-lg border-2 border-white overflow-hidden bg-card shadow-xl">
              <div className="relative bg-navy flex items-center justify-center overflow-hidden">
                {featuredItem.imageUrl ? (
                  <img src={featuredItem.imageUrl} alt={featuredItem.title} className="w-full h-full object-cover min-h-[240px]" />
                ) : (
                  <Newspaper className="text-navy-foreground/40" size={80} />
                )}
              </div>
              <div className="p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/10 text-gold">
                    {featuredItem.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{featuredItem.date}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-sans font-bold text-card-foreground mb-4">
                  {featuredItem.title}
                </h2>
                <p className="text-muted-foreground mb-6">{featuredItem.description}</p>
                <div>
                  <Link href={`/news/${featuredItem.slug}`}>
                    <Button variant="gold" size="lg">
                      Read Article <ArrowRight className="ml-1" size={16} />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* News Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          {dbLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader className="animate-spin text-muted-foreground mb-3" size={28} />
              <p className="text-sm text-muted-foreground">Loading posts...</p>
            </div>
          ) : (
          <>
          <p className="text-sm text-muted-foreground mb-6">
            Showing {paginatedNews.length} of {filteredNews.length} article{filteredNews.length !== 1 ? "s" : ""}
          </p>

          {filteredNews.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No articles match your filters.</p>
              <button onClick={clearFilters} className="mt-4 text-gold hover:text-gold/80 text-sm font-medium">
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedNews.map((item) => (
                  <NewsCard key={item.title} item={item} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <Button
                    variant="outline"
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
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <Button
                    variant="outline"
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
          </>
          )}
        </div>
      </section>
    </div>
  );
};

export default NewsPage;