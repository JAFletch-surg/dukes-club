'use client'

import HeroSection from "@/components/home/HeroSection";
import BenefitsSection from "@/components/home/BenefitsSection";
import EventsSection from "@/components/home/EventsSection";
import NewsSection from "@/components/home/NewsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import SponsorsSection from "@/components/home/SponsorsSection";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      
      <HeroSection />
      <BenefitsSection />
      <EventsSection />
      <NewsSection />
      <TestimonialsSection />
      <SponsorsSection />
      
    </div>
  );
};

export default Index;
