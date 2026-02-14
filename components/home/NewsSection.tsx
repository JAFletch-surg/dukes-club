'use client'
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { ArrowRight, Newspaper } from "lucide-react";

const newsItems = [
  {
    title: "2026 Annual Weekend Registration Now Open",
    slug: "2026-annual-weekend-registration-now-open",
    tag: "Announcement",
    date: "10 Feb 2026",
    description:
      "Early bird registration is available for the Dukes' Club Annual Weekend. Secure your place at the premier colorectal surgery training event of the year.",
  },
  {
    title: "New FRCS Revision Course Launched",
    slug: "new-frcs-revision-course-launched",
    tag: "Education",
    date: "28 Jan 2026",
    description:
      "A comprehensive online revision course for Section 2 FRCS is now available to all Dukes' Club members, featuring mock vivas and structured question banks.",
  },
  {
    title: "Fellowship Applications: Deadline Approaching",
    slug: "fellowship-applications-deadline-approaching",
    tag: "Careers",
    date: "15 Jan 2026",
    description:
      "Applications for the 2026–27 colorectal fellowship posts close on 28 February. Visit the fellowships directory for full details and eligibility criteria.",
  },
];

const NewsSection = () => {
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
              Stay informed with the latest news, announcements, and updates from the Dukes' Club community.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {newsItems.map((item) => (
            <div
              key={item.title}
              className="group rounded-lg border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card"
            >
              <div className="bg-navy p-6 flex items-center justify-center aspect-[4/2]">
                <Newspaper className="text-navy-foreground/40 group-hover:text-gold transition-colors" size={48} />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/10 text-gold">
                    {item.tag}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                </div>
                <h3 className="text-lg font-sans font-semibold text-card-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                <Link
                  href={`/news/${item.slug}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold/80 transition-colors"
                >
                  Read more <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
