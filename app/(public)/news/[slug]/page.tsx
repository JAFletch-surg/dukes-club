'use client'
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ArrowLeft,
  User,
  Clock,
  Eye,
  Loader,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const estimateReadTime = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

const AnimatedSection = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const { ref, isVisible } = useScrollAnimation(0.1);
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const PostDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();

        // Increment view count
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("slug", slug)
          .eq("status", "published")
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          setPost(data);
          // Fire-and-forget view count increment
          supabase.from("posts").update({ view_count: (data.view_count || 0) + 1 }).eq("id", data.id).then();
        }
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-muted-foreground mx-auto mb-3" size={28} />
          <p className="text-sm text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-3xl font-sans font-bold text-navy-foreground mb-4">
            Post Not Found
          </h1>
          <p className="text-navy-foreground/70 mb-8">
            The article you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/news">
            <Button variant="gold">
              <ArrowLeft size={16} className="mr-2" /> Back to News
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const publishedDate = post.published_at ? formatDate(post.published_at) : "";
  const readTime = estimateReadTime(post.content_plain || "");
  const subspecialties = Array.isArray(post.subspecialties) ? post.subspecialties : [];

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          {post.featured_image_url ? (
            <img
              src={post.featured_image_url}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              className="w-full h-full object-cover"
              src="/videos/hero-bg.mp4"
              muted
              autoPlay
              loop
              playsInline
            />
          )}
          <div className="absolute inset-0 bg-navy/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy" />
        </div>
        <div className="relative container mx-auto px-4 py-20 md:py-28 max-w-4xl">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-gold hover:text-gold/80 text-sm font-medium mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to News
          </Link>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge className="bg-gold/20 text-gold border-gold/30">
              {post.category || "General"}
            </Badge>
            {subspecialties.map((tag: string) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-navy-foreground/30 text-navy-foreground/70"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in leading-tight">
            {post.title}
          </h1>
        </div>
      </section>

      {/* Meta Bar */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }}>
        <div className="container mx-auto px-4 py-5 max-w-4xl">
          <div className="flex flex-wrap gap-6 items-center text-navy-foreground">
            {post.author_name && (
              <div className="flex items-center gap-2">
                {post.author_photo_url
                  ? <img src={post.author_photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  : <User size={16} className="text-gold" />
                }
                <span className="text-sm font-medium">{post.author_name}</span>
                {post.author_role && <span className="text-xs text-navy-foreground/60">· {post.author_role}</span>}
              </div>
            )}
            {publishedDate && (
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gold" />
                <span className="text-sm font-medium">{publishedDate}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gold" />
              <span className="text-sm font-medium">{readTime} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-gold" />
              <span className="text-sm font-medium">{post.view_count || 0} views</span>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-background py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <AnimatedSection>
            {post.content_html ? (
              <article
                className="article-content"
                dangerouslySetInnerHTML={{ __html: post.content_html }}
              />
            ) : (
              <article className="article-content">
                {(post.content_plain || "").split("\n").map((paragraph: string, i: number) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </article>
            )}
          </AnimatedSection>

          {/* Article styles — matches site design: Montserrat headings, Cormorant Garamond body */}
          <style dangerouslySetInnerHTML={{ __html: `
            .article-content {
              font-family: var(--font-sans, 'Montserrat', sans-serif);
              font-size: 16px;
              line-height: 1.8;
              color: hsl(240 5% 10%);
              max-width: 720px;
            }
            .article-content p {
              margin-bottom: 1.5em;
              font-size: 16.5px;
              line-height: 1.85;
            }
            .article-content p:first-child {
              font-size: 18px;
              line-height: 1.75;
              color: hsl(240 5% 25%);
            }

            /* ── Headings ── */
            .article-content h1 {
              font-family: var(--font-sans, 'Montserrat', sans-serif);
              font-size: 1.85em;
              font-weight: 800;
              color: hsl(220 60% 15%);
              margin: 2em 0 0.6em;
              line-height: 1.25;
              letter-spacing: -0.01em;
            }
            .article-content h2 {
              font-family: var(--font-sans, 'Montserrat', sans-serif);
              font-size: 1.4em;
              font-weight: 700;
              color: hsl(220 60% 15%);
              margin: 1.75em 0 0.5em;
              line-height: 1.3;
              letter-spacing: -0.005em;
            }

            /* ── Inline formatting ── */
            .article-content a {
              color: hsl(42 87% 45%);
              text-decoration: underline;
              text-decoration-color: hsl(42 87% 75%);
              text-underline-offset: 2px;
              transition: text-decoration-color 0.2s;
            }
            .article-content a:hover {
              text-decoration-color: hsl(42 87% 45%);
            }
            .article-content strong, .article-content b {
              font-weight: 700;
              color: hsl(240 5% 5%);
            }
            .article-content em, .article-content i {
              font-style: italic;
            }

            /* ── Lists ── */
            .article-content ul, .article-content ol {
              margin: 1.25em 0;
              padding-left: 1.5em;
            }
            .article-content li {
              margin-bottom: 0.5em;
              line-height: 1.7;
              padding-left: 0.25em;
            }
            .article-content ul li {
              list-style-type: disc;
            }
            .article-content ul li::marker {
              color: hsl(42 87% 55%);
            }
            .article-content ol li {
              list-style-type: decimal;
            }
            .article-content ol li::marker {
              color: hsl(220 60% 15%);
              font-weight: 700;
            }

            /* ── Images — float right on desktop, full width on mobile ── */
            .article-content img {
              max-width: 100%;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }
            .article-content figure {
              margin: 1.5em 0;
            }
            @media (min-width: 768px) {
              .article-content figure {
                float: right;
                max-width: 48%;
                margin: 0.5em 0 1.25em 2em;
              }
            }
            .article-content figcaption {
              font-size: 0.8em;
              color: hsl(240 5% 50%);
              font-style: italic;
              margin-top: 8px;
              text-align: center;
              padding: 0 4px;
            }

            /* ── Blockquote ── */
            .article-content blockquote {
              border-left: 3px solid hsl(42 87% 55%);
              background: hsl(42 87% 97%);
              border-radius: 0 10px 10px 0;
              padding: 20px 24px;
              margin: 2em 0;
              font-size: 1.05em;
              font-style: italic;
              color: hsl(240 5% 30%);
              line-height: 1.7;
            }
            .article-content blockquote p {
              margin-bottom: 0.5em;
              font-size: inherit;
            }
            .article-content blockquote p:last-child {
              margin-bottom: 0;
            }
            .article-content blockquote cite {
              display: block;
              margin-top: 10px;
              font-size: 0.82em;
              font-weight: 700;
              font-style: normal;
              color: hsl(220 60% 15%);
            }

            /* ── Divider ── */
            .article-content hr {
              border: none;
              height: 1px;
              background: linear-gradient(90deg, transparent, hsl(42 87% 75%), transparent);
              margin: 2.5em 0;
            }

            /* ── Video embed ── */
            .video-embed {
              position: relative;
              padding-bottom: 56.25%;
              height: 0;
              overflow: hidden;
              border-radius: 10px;
              margin: 2em 0;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .video-embed iframe {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              border: none;
            }

            /* ── PDF embed ── */
            .pdf-embed {
              margin: 2em 0;
              clear: both;
            }
            .pdf-embed .pdf-link {
              display: inline-flex;
              align-items: center;
              gap: 12px;
              padding: 16px 24px;
              background: hsl(220 60% 15%);
              border: none;
              border-radius: 10px;
              color: hsl(210 40% 98%);
              font-family: var(--font-sans, 'Montserrat', sans-serif);
              font-weight: 600;
              font-size: 14px;
              text-decoration: none;
              transition: all 0.2s;
              box-shadow: 0 2px 8px rgba(15,31,61,0.15);
            }
            .pdf-embed .pdf-link:hover {
              background: hsl(220 60% 22%);
              box-shadow: 0 4px 16px rgba(15,31,61,0.2);
              transform: translateY(-1px);
            }
            .pdf-embed .pdf-link svg {
              flex-shrink: 0;
              color: hsl(42 87% 55%);
            }

            /* ── Clear floats at end ── */
            .article-content::after {
              content: '';
              display: table;
              clear: both;
            }
          `}} />

          {/* Author Card */}
          {post.author_name && (
            <AnimatedSection delay={150} className="mt-16">
              <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-4">
                {post.author_photo_url ? (
                  <img src={post.author_photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="text-foreground/40" size={24} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {post.author_name}
                  </p>
                  {post.author_role && (
                    <p className="text-xs text-muted-foreground">
                      {post.author_role}
                    </p>
                  )}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Back Link */}
          <AnimatedSection delay={200} className="mt-12">
            <Link
              href="/news"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold/80 transition-colors"
            >
              <ArrowLeft size={14} /> Back to all posts
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
};

export default PostDetailPage;