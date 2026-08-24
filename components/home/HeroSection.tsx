'use client'
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { ArrowRight } from "lucide-react";

import logoHero from "@/public/images/logo-hero.png";

/**
 * Decides whether this visitor should get the scroll-scrubbed video at all.
 *
 * The video is a decorative flourish, and paying for it is not something we can
 * ask of every visitor: it is the largest asset on the site, and scrubbing it
 * means continuous seek-and-decode work for as long as the hero is on screen.
 * Phones, metered connections and anyone who has asked for reduced motion get
 * the still frame instead, which is 7KB and looks like the video's best moment.
 *
 * Returns null until it has decided, so the first client render matches the
 * server HTML (which cannot know any of this) and hydration stays clean.
 */
function useWantsVideo(): boolean | null {
  const [wantsVideo, setWantsVideo] = useState<boolean | null>(null);

  useEffect(() => {
    const decide = () => {
      const bigEnough = window.matchMedia("(min-width: 768px)").matches;
      const motionOk = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

      // Non-standard but widely supported on the browsers where it matters.
      const connection = (navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }).connection;
      const cheapConnection =
        connection?.saveData === true ||
        (connection?.effectiveType != null && /(^|-)(2g|3g)$/.test(connection.effectiveType));

      setWantsVideo(bigEnough && motionOk && !cheapConnection);
    };

    decide();

    // Only the viewport query is worth re-evaluating live; a visitor rotating a
    // tablet into landscape should get the full treatment.
    const viewport = window.matchMedia("(min-width: 768px)");
    viewport.addEventListener("change", decide);
    return () => viewport.removeEventListener("change", decide);
  }, []);

  return wantsVideo;
}

const HeroSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const targetTime = useRef(0);
  const currentTime = useRef(0);
  const rafId = useRef(0);

  const wantsVideo = useWantsVideo();

  // ── Content parallax ───────────────────────────────────────────────
  // Runs for everyone, video or not: it is a cheap transform on one element,
  // and without it the hero copy sits still while the page scrolls past.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      const progress = Math.min(
        Math.max(-rect.top / (sectionHeight - window.innerHeight), 0),
        1
      );
      targetTime.current = progress;

      if (contentRef.current) {
        const yOffset = progress * 60;
        const opacity = 1 - progress * 1.2;
        contentRef.current.style.transform = `translate3d(0, -${yOffset}px, 0)`;
        contentRef.current.style.opacity = `${Math.max(opacity, 0)}`;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Video scrub ────────────────────────────────────────────────────
  useEffect(() => {
    if (!wantsVideo) return;
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    let duration = 0;
    let onScreen = true;

    // The loop used to run for the lifetime of the page, seeking the video
    // every frame even after the hero had scrolled away — decode work for
    // something nobody could see. It now only runs while the hero is visible.
    const tick = () => {
      rafId.current = 0;
      if (!onScreen || !duration) return;

      const target = targetTime.current * duration;
      const diff = target - currentTime.current;
      currentTime.current += diff * 0.05;

      // A 1/30s deadband: anything finer than one frame of a 30fps source
      // cannot show up on screen, but still costs a seek.
      if (Math.abs(diff) > 1 / 30) {
        video.currentTime = currentTime.current;
      }

      rafId.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafId.current === 0) rafId.current = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (rafId.current !== 0) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
    };

    const onMetadata = () => {
      if (isFinite(video.duration)) {
        duration = video.duration;
        start();
      }
    };

    if (video.readyState >= 1) onMetadata();
    else video.addEventListener("loadedmetadata", onMetadata);

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 }
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      video.removeEventListener("loadedmetadata", onMetadata);
      stop();
    };
  }, [wantsVideo]);

  return (
    <section ref={sectionRef} className="relative h-[120vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-navy">
        {/* The still is always in the markup: it is the background for anyone
            who does not get the video, and the first paint for anyone who
            does. At 7KB it is cheaper than the flash of empty navy. */}
        <img
          src="/images/hero-still.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          fetchPriority="high"
        />

        {wantsVideo && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover will-change-auto"
            src="/videos/hero-bg.mp4"
            poster="/images/hero-poster.webp"
            muted
            playsInline
            preload="metadata"
          />
        )}

        <div className="absolute inset-0 bg-navy/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/30 via-transparent to-navy/80" />

        <div
          ref={contentRef}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <div className="container mx-auto px-4 text-center">
            <Image
              src={logoHero}
              alt="The Dukes' Club"
              priority
              sizes="(min-width: 1024px) 455px, (min-width: 768px) 372px, 248px"
              className="h-24 md:h-36 lg:h-44 w-auto mx-auto mb-8 drop-shadow-2xl"
            />
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-primary-foreground/80 mb-10 font-sans">
              Advancing colorectal surgical training through education,
              collaboration, and excellence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button variant="gold" size="lg" className="text-base px-8">
                  Become a Member <ArrowRight className="ml-1" size={18} />
                </Button>
              </Link>
              <Link href="/events">
                <Button variant="hero" size="lg" className="text-base px-8">
                  Upcoming Events
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-primary-foreground/40 flex items-start justify-center p-1">
            <div className="w-1.5 h-3 rounded-full bg-gold animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
