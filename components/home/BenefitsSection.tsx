'use client'
import Link from "next/link";
import { BookOpen, Users, GraduationCap, Video, Globe, Award, Lock, Play, Map } from "lucide-react";
import { Button } from "@/components/ui/button";


const benefits = [
  { icon: BookOpen, title: "FRCS Resources", description: "Access exam prep, question banks, and viva courses tailored to colorectal surgery." },
  { icon: Video, title: "Webinar Archive", description: "Searchable library of surgical lectures and live webinar recordings via Vimeo." },
  { icon: GraduationCap, title: "Training Support", description: "Exam advice, fellowship guides, and structured mentorship from senior surgeons." },
  { icon: Users, title: "Community Network", description: "Connect with colorectal trainees and consultants across the UK and beyond." },
  { icon: Globe, title: "Fellowships Directory", description: "Interactive map of UK and worldwide colorectal fellowship opportunities." },
  { icon: Award, title: "Annual Weekend", description: "Premier conference with hands-on workshops, lectures, and networking." },
];

const BenefitsSection = () => {
  return (
    <section className="py-20" style={{ backgroundColor: "hsl(220, 80%, 55%)" }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-white/15 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Lock size={14} /> Members Only
          </div>
          <h2 className="text-3xl md:text-4xl font-sans font-bold text-white">
            Why Join Dukes' Club?
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-white/80">
            Everything you need to excel in your colorectal surgery training journey — resources, community, and career support all in one place.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-12">
          {[
            { value: "500+", label: "Active Members" },
            { value: "30+", label: "Courses Delivered" },
            { value: "15", label: "Years Running" },
            { value: "£50k+", label: "Grants Awarded" },
          ].map((stat) => (
            <div key={stat.label} className="text-center py-4">
              <p className="text-3xl md:text-4xl font-bold text-gold">{stat.value}</p>
              <p className="text-sm text-white/70 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="group p-6 rounded-lg border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center mb-4 group-hover:bg-gold/30 transition-colors">
                <b.icon className="text-white group-hover:text-gold transition-colors" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{b.title}</h3>
              <p className="text-white/70 text-sm">{b.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/join">
            <Button variant="gold" size="lg">
              Join Dukes' Club Today
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
