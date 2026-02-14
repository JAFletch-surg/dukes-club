'use client'
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

import { ArrowRight } from "lucide-react";


const HeroSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const targetTime = useRef(0);
  const currentTime = useRef(0);
  const rafId = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    const onReady = () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration)) return;

      const handleScroll = () => {
        const rect = section.getBoundingClientRect();
        const sectionHeight = section.offsetHeight;
        const progress = Math.min(Math.max(-rect.top / (sectionHeight - window.innerHeight), 0), 1);
        targetTime.current = progress * duration;

        // Content parallax
        if (contentRef.current) {
        const yOffset = progress * 60;
          const opacity = 1 - progress * 1.2;
          contentRef.current.style.transform = `translate3d(0, -${yOffset}px, 0)`;
          contentRef.current.style.opacity = `${Math.max(opacity, 0)}`;
        }
      };

      // Smooth interpolation loop — lerp toward target time
      const tick = () => {
        const diff = targetTime.current - currentTime.current;
        // Lerp factor — lower = smoother but more latent
        currentTime.current += diff * 0.05;

        if (Math.abs(diff) > 0.01) {
          video.currentTime = currentTime.current;
        }

        rafId.current = requestAnimationFrame(tick);
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      rafId.current = requestAnimationFrame(tick);

      return () => {
        window.removeEventListener("scroll", handleScroll);
        cancelAnimationFrame(rafId.current);
      };
    };

    if (video.readyState >= 1) {
      const cleanup = onReady();
      return cleanup;
    }

    let cleanup: (() => void) | undefined;
    const handler = () => { cleanup = onReady(); };
    video.addEventListener("loadedmetadata", handler);
    return () => {
      video.removeEventListener("loadedmetadata", handler);
      cleanup?.();
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[150vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover will-change-auto"
          src="/videos/hero-bg.mp4"
          muted
          playsInline
          preload="auto"
        />

        <div className="absolute inset-0 bg-navy/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/30 via-transparent to-navy/80" />

        <div
          ref={contentRef}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <div className="container mx-auto px-4 text-center">
            <img
              src="/images/logo-hero.png"
              alt="The Dukes' Club"
              className="h-24 md:h-36 lg:h-44 mx-auto mb-8 drop-shadow-2xl"
            />
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-primary-foreground/80 mb-10 font-sans">
              Advancing colorectal surgical training through education,
              collaboration, and excellence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/join">
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
