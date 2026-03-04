'use client'
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Newspaper, Loader, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NewsItem = {
  title: string;
  slug: string;
  category: string;
  date: string;
  description: string;
  imageUrl?: string;
  authorName?: string;
  authorPhoto?: string;
};

const NewsSection = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("posts")
          .select("title, slug, category, published_at, excerpt, content_plain, featured_image_url, author_name, author_photo_url")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        if (data) {
          setItems(data.map((p: any) => ({
            title: p.title || "",
            slug: p.slug || "",
            category: p.category || "General",
            date: p.published_at
              ? new Date(p.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "",
            description: p.excerpt || p.content_plain?.replace(/<[^>]+>/g, '').slice(0, 160) || "",
            imageUrl: p.featured_image_url || undefined,
            authorName: p.author_name || undefined,
            authorPhoto: p.author_photo_url || undefined,
          })));
        }
      } catch {
        setItems([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14">
          <div>
            <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-2">
              Latest Updates
            </p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground">
              News &amp; Announcements
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl text-sm md:text-base">
              Stay informed with the latest news, announcements, and updates from the Dukes&apos; Club community.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link href="/news">
              <Button variant="outline" size="lg">
                View all
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Newspaper size={36} className="mx-auto mb-3 opacity-40" />
            <p>No news published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.slug}
                className="group rounded-lg border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card"
              >
                <div className="relative h-48 overflow-hidden bg-navy">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper className="text-navy-foreground/40 group-hover:text-gold transition-colors" size={48} />
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
                          ? <img src={item.authorPhoto} alt="" className="w-5 h-5 rounded-full object-cover" />
                          : <User size={12} className="text-muted-foreground" />
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default NewsSection;