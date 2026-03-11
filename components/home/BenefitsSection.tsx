'use client'
import Link from "next/link";
import { BookOpen, Users, GraduationCap, Video, Globe, Award, Lock, Play, Map, Check, X } from "lucide-react";
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

        {/* Membership Tiers */}
        <div className="max-w-2xl mx-auto mb-12">
          <h3 className="text-xl font-semibold text-white text-center mb-6">Membership Tiers</h3>
          <div className="rounded-lg border border-white/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/10">
                  <th className="text-left text-white/80 font-medium px-4 py-3"></th>
                  <th className="text-center text-white font-semibold px-4 py-3">Trainee</th>
                  <th className="text-center text-gold font-semibold px-4 py-3">Full Member</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[
                  { feature: "Webinar archive", trainee: true, member: true },
                  { feature: "Question bank", trainee: "3-month trial", member: true },
                  { feature: "Community & directory", trainee: true, member: true },
                  { feature: "Fellowships directory", trainee: true, member: true },
                  { feature: "In-person courses", trainee: false, member: true },
                  { feature: "Annual Weekend", trainee: false, member: true },
                ].map((row) => (
                  <tr key={row.feature} className="bg-white/5">
                    <td className="text-white/80 px-4 py-2.5">{row.feature}</td>
                    <td className="text-center px-4 py-2.5">
                      {row.trainee === true ? (
                        <Check size={16} className="inline text-emerald-300" />
                      ) : row.trainee === false ? (
                        <X size={16} className="inline text-white/30" />
                      ) : (
                        <span className="text-xs text-amber-300">{row.trainee}</span>
                      )}
                    </td>
                    <td className="text-center px-4 py-2.5">
                      {row.member === true ? (
                        <Check size={16} className="inline text-gold" />
                      ) : (
                        <X size={16} className="inline text-white/30" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/50 text-center mt-3">
            Full membership requires a valid ACPGBI membership (£95/year)
          </p>
        </div>

        <div className="text-center">
          <Link href="/register">
            <Button variant="gold" size="lg">
              Join Dukes&apos; Club Today
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
