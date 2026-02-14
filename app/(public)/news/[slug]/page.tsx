'use client'
import Link from "next/link";
import { useParams } from "next/navigation";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ArrowLeft,
  User,
  Clock,
  Eye,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";


// Placeholder mock — will be replaced with Supabase query by slug
const mockPost = {
  id: "1",
  title: "2026 Annual Weekend Registration Now Open",
  slug: "2026-annual-weekend-registration-now-open",
  author: { name: "Mr James Richardson", role: "President" },
  published_at: "2026-02-10T09:00:00Z",
  subspecialties: ["Training", "General"],
  content_plain: `Early bird registration is now available for the Dukes' Club Annual Weekend 2026. This is the premier colorectal surgery training event of the year, bringing together trainees, consultants, and leading experts from across the United Kingdom.

This year's programme includes:

• Keynote lectures from internationally renowned faculty
• Hands-on simulation workshops covering robotic, laparoscopic, and open techniques
• Case-based discussion panels on complex colorectal conditions
• Research presentations and poster sessions
• The annual Dukes' Club dinner and networking reception

The Annual Weekend is an unmissable opportunity for trainees at all stages of their career. Whether you are early in your training or approaching CCT, the programme has been designed to offer something for everyone.

Members receive priority booking and discounted rates. Non-members are welcome to attend at the standard rate, or can join the Dukes' Club at the same time to take advantage of the member discount.

Spaces are limited, so we encourage early registration to avoid disappointment. The early bird discount is available until 15 March 2026.

We look forward to welcoming you to what promises to be our best Annual Weekend yet.`,
  featured_image_url: "",
  is_featured: true,
  view_count: 342,
  category: "Announcement",
  created_at: "2026-02-10T09:00:00Z",
};

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
  // TODO: Replace with Supabase query: select * from posts where slug = slug
  const post = mockPost;

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-3xl font-sans font-bold text-navy-foreground mb-4">
            Post Not Found
          </h1>
          <p className="text-navy-foreground/70 mb-8">
            The article you're looking for doesn't exist or has been removed.
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

  const publishedDate = formatDate(post.published_at);
  const readTime = estimateReadTime(post.content_plain || "");

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
              {post.category}
            </Badge>
            {post.subspecialties.map((sub) => (
              <Badge
                key={sub}
                variant="outline"
                className="border-navy-foreground/30 text-navy-foreground/70"
              >
                {sub}
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
            {post.author && (
              <div className="flex items-center gap-2">
                <User size={16} className="text-gold" />
                <span className="text-sm font-medium">{post.author.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-gold" />
              <span className="text-sm font-medium">{publishedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gold" />
              <span className="text-sm font-medium">{readTime} min read</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-gold" />
              <span className="text-sm font-medium">{post.view_count} views</span>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-background py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <AnimatedSection>
                <article className="prose max-w-none">
                  {post.content_plain?.split("\n").map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-foreground/80 leading-relaxed mb-4"
                    >
                      {paragraph}
                    </p>
                  ))}
                </article>
              </AnimatedSection>
            </div>

            {/* Stock Image */}
            <div className="lg:col-span-1">
              <AnimatedSection delay={100}>
                <img
                  src="/images/blog-stock.jpg"
                  alt="Surgical team in discussion"
                  className="rounded-lg w-full object-cover aspect-[3/4] shadow-sm"
                />
              </AnimatedSection>
            </div>
          </div>

          {/* Author Card */}
          {post.author && (
            <AnimatedSection delay={150} className="mt-16">
              <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="text-foreground/40" size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {post.author.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {post.author.role}
                  </p>
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
