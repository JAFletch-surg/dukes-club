'use client'
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { ChevronDown, MapPin, User, FileText, Download, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type CommitteeMember = {
  id: string;
  full_name: string;
  role: string;
  region: string | null;
  statement: string | null;
  email: string | null;
  photo_url: string | null;
  sort_order: number;
  is_active: boolean;
  social_media_tag: string | null;
  social_media_url: string | null;
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

const CommitteeCard = ({
  member,
  index,
}: {
  member: CommitteeMember;
  index: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative rounded-lg border-2 border-navy-foreground overflow-hidden bg-navy transition-all duration-700 ease-out hover:shadow-lg hover:-translate-y-1",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      )}
      style={{ transitionDelay: `${(index % 3) * 100}ms` }}
    >
      {/* Background image */}
      <img
        src="/images/card-bg.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none select-none"
      />
      {/* Dark gradient overlay at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-transparent pointer-events-none" />

      {/* Mobile: horizontal compact layout */}
      <div className="relative z-10 flex items-center gap-3 p-3 sm:hidden">
        <div className="w-16 h-16 shrink-0 rounded-full bg-navy-foreground/10 flex items-center justify-center overflow-hidden shadow-md">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
          ) : (
            <User className="text-gold/60" size={28} />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-sans font-semibold text-navy-foreground leading-tight truncate">
            {member.full_name}
          </h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/20 text-gold inline-block mt-1">
            {member.role}
          </span>
          {member.region && (
            <div className="flex items-center gap-1 text-xs text-navy-foreground/60 mt-0.5">
              <MapPin size={10} className="text-gold shrink-0" />
              <span className="truncate">{member.region}</span>
            </div>
          )}
        </div>
      </div>
      {/* Mobile expandable statement */}
      {member.statement && (
        <div className="relative z-10 px-3 pb-3 sm:hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-gold/80 transition-colors"
          >
            Personal Statement
            <ChevronDown
              size={12}
              className={cn(
                "transition-transform duration-300",
                expanded && "rotate-180"
              )}
            />
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-500 ease-in-out",
              expanded ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"
            )}
          >
            <p className="text-xs text-navy-foreground/70 leading-relaxed">
              {member.statement}
            </p>
          </div>
        </div>
      )}

      {/* Desktop: original vertical layout */}
      <div className="hidden sm:block">
        {/* Photo / Avatar */}
        <div className="relative z-10 pt-8 pb-4 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full bg-navy-foreground/10 flex items-center justify-center overflow-hidden shadow-md transition-transform duration-300 group-hover:scale-110">
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
            ) : (
              <User className="text-gold/60" size={52} />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="relative z-10 px-6 pb-6 text-center">
          <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-1">
            {member.full_name}
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/20 text-gold mb-2 inline-block">
            {member.role}
          </span>
          {member.region && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-navy-foreground/60 mb-4">
              <MapPin size={13} className="text-gold shrink-0" />
              <span>{member.region}</span>
            </div>
          )}

          {/* Expandable statement */}
          {member.statement && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold/80 transition-colors"
              >
                Personal Statement
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform duration-300",
                    expanded && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-500 ease-in-out",
                  expanded ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"
                )}
              >
                <p className="text-sm text-navy-foreground/70 leading-relaxed text-left">
                  {member.statement}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const RegionalRepCard = ({
  member,
  index,
}: {
  member: CommitteeMember;
  index: number;
}) => {
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex items-center gap-4 rounded-lg border border-navy-foreground overflow-hidden bg-navy p-4 transition-all duration-700 ease-out hover:shadow-lg hover:-translate-y-1",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      )}
      style={{ transitionDelay: `${(index % 3) * 100}ms` }}
    >
      {/* Background image */}
      <img
        src="/images/card-bg.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/80 to-transparent pointer-events-none" />

      {/* Headshot */}
      <div className="relative z-10 w-14 h-14 shrink-0 rounded-full bg-navy-foreground/10 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-110">
        {member.photo_url ? (
          <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
        ) : (
          <User className="text-gold/60" size={24} />
        )}
      </div>

      {/* Text */}
      <div className="relative z-10 text-left">
        <h3 className="text-sm font-sans font-semibold text-navy-foreground leading-tight">
          {member.region || member.role}
        </h3>
        <p className="text-xs text-navy-foreground/60 mt-0.5">{member.full_name}</p>
      </div>
    </div>
  );
};

const LoadingSkeleton = ({ count, type }: { count: number; type: 'card' | 'rep' }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      type === 'card' ? (
        <div key={i} className="rounded-lg border-2 border-navy-foreground/30 bg-navy animate-pulse">
          {/* Mobile skeleton */}
          <div className="flex items-center gap-3 p-3 sm:hidden">
            <div className="w-16 h-16 rounded-full bg-navy-foreground/10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-navy-foreground/10 rounded w-3/4" />
              <div className="h-3 bg-gold/10 rounded-full w-1/2" />
              <div className="h-3 bg-navy-foreground/10 rounded w-1/3" />
            </div>
          </div>
          {/* Desktop skeleton */}
          <div className="hidden sm:block p-6">
            <div className="flex justify-center mb-4">
              <div className="w-36 h-36 rounded-full bg-navy-foreground/10" />
            </div>
            <div className="space-y-2 text-center">
              <div className="h-5 bg-navy-foreground/10 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gold/10 rounded-full w-1/3 mx-auto" />
              <div className="h-3 bg-navy-foreground/10 rounded w-1/2 mx-auto" />
            </div>
          </div>
        </div>
      ) : (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-navy-foreground/30 bg-navy p-4 animate-pulse">
          <div className="w-14 h-14 rounded-full bg-navy-foreground/10 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-navy-foreground/10 rounded w-1/2" />
            <div className="h-3 bg-navy-foreground/10 rounded w-1/3" />
          </div>
        </div>
      )
    ))}
  </>
);

const AboutPage = () => {
  const [execMembers, setExecMembers] = useState<CommitteeMember[]>([]);
  const [regionalReps, setRegionalReps] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('executive_committee')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        const exec = data.filter((m: CommitteeMember) => m.role !== 'Regional Representative');
        const reps = data.filter((m: CommitteeMember) => m.role === 'Regional Representative');
        setExecMembers(exec);
        setRegionalReps(reps);
      }
      setLoading(false);
    };

    fetchTeam();
  }, []);

  // Derive the list of exec roles from current members for the governance section
  const execRoles = execMembers.map(m => m.role);

  return (
    <div className="min-h-screen bg-background">

      {/* Video Hero */}
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
        <div className="relative container mx-auto px-4 py-12 md:py-28">
          <p className="text-gold font-semibold text-xs sm:text-sm tracking-widest uppercase mb-2 sm:mb-3 animate-fade-in">
            Who We Are
          </p>
          <h1 className="text-3xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            About Dukes&apos; Club
          </h1>
          <p className="mt-3 sm:mt-4 text-navy-foreground/80 max-w-2xl text-sm md:text-lg animate-fade-in">
            The Dukes&apos; Club is the national trainee association for colorectal surgery in the United Kingdom, dedicated to education, training, and community.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }}>
        <div className="container mx-auto px-4 py-10 sm:py-16">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground mb-6">
                Our Mission
              </h2>
              <p className="text-navy-foreground/90 text-lg leading-relaxed">
                Founded to support and advance colorectal surgical training in the UK, the Dukes&apos; Club provides
                a platform for education, research, networking, and professional development. We organise courses,
                webinars, and our flagship Annual Weekend, while working closely with the ACPGBI to represent
                the interests of trainees at every level.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Executive Committee */}
      <section className="bg-navy py-12 sm:py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-8 sm:mb-12">
            <p className="text-gold font-semibold text-xs sm:text-sm tracking-widest uppercase mb-2 sm:mb-3">
              Leadership
            </p>
            <h2 className="text-2xl md:text-4xl font-sans font-bold text-navy-foreground">
              Executive Committee
            </h2>
            <p className="mt-4 text-navy-foreground/80 max-w-2xl mx-auto">
              Meet the dedicated team driving the Dukes&apos; Club forward. Click on any member to read their personal statement.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {loading ? (
              <LoadingSkeleton count={6} type="card" />
            ) : execMembers.length === 0 ? (
              <div className="col-span-full text-center py-12 text-navy-foreground/50">
                <User size={36} className="mx-auto mb-3 opacity-40" />
                <p>Committee members coming soon.</p>
              </div>
            ) : (
              execMembers.map((member, i) => (
                <CommitteeCard key={member.id} member={member} index={i} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Constitution & Governance */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }} className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-8 sm:mb-12">
            <p className="text-gold font-semibold text-xs sm:text-sm tracking-widest uppercase mb-2 sm:mb-3">
              Governance
            </p>
            <h2 className="text-2xl md:text-4xl font-sans font-bold text-navy-foreground">
              Constitution & Roles
            </h2>
            <p className="mt-4 text-navy-foreground/80 max-w-2xl mx-auto">
              The Dukes&apos; Club is governed by a formal constitution. Each executive committee role carries specific responsibilities outlined in the documents below.
            </p>
          </AnimatedSection>

          <div className="max-w-4xl mx-auto">
            {/* Constitution */}
            <AnimatedSection delay={100}>
              <a
                href="#"
                className="group flex items-center gap-3 sm:gap-4 rounded-lg border-2 border-navy-foreground bg-navy p-4 sm:p-6 mb-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                  <BookOpen size={22} className="text-gold" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-sans font-semibold text-navy-foreground">
                    Dukes&apos; Club Constitution
                  </h3>
                  <p className="text-sm text-navy-foreground/60">
                    The governing document of the Dukes&apos; Club, outlining objectives, membership, and committee structure.
                  </p>
                </div>
                <Download size={18} className="text-navy-foreground/40 group-hover:text-gold transition-colors shrink-0" />
              </a>
            </AnimatedSection>

            {/* Role Documents — driven by exec roles from Supabase */}
            <AnimatedSection delay={200}>
              <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-4 mt-8">
                Roles & Responsibilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(execRoles.length > 0
                  ? execRoles
                  : [
                      "President",
                      "Vice-President",
                      "Past-President",
                      "Secretary",
                      "Web Master",
                      "IBD Lead",
                      "Abdominal Wall / Intestinal Failure Lead",
                      "Pelvic Floor Lead",
                      "Proctology Lead",
                      "Endoscopy Lead",
                      "ASiT Representative",
                      "Research Lead",
                      "Advanced Cancer Lead",
                      "Training and Education Lead",
                    ]
                ).map((role) => (
                  <a
                    key={role}
                    href="#"
                    className="group flex items-center gap-3 rounded-lg border border-navy-foreground/30 bg-navy p-4 hover:border-gold/50 hover:shadow-md transition-all duration-300"
                  >
                    <FileText size={16} className="text-gold/60 group-hover:text-gold shrink-0 transition-colors" />
                    <span className="text-sm font-medium text-navy-foreground">{role}</span>
                    <Download size={14} className="text-navy-foreground/30 group-hover:text-gold ml-auto shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Regional Representatives */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }} className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-8 sm:mb-12">
            <p className="text-gold font-semibold text-xs sm:text-sm tracking-widest uppercase mb-2 sm:mb-3">
              Across the UK & Ireland
            </p>
            <h2 className="text-2xl md:text-4xl font-sans font-bold text-navy-foreground">
              Regional Representatives
            </h2>
            <p className="mt-4 text-navy-foreground/80 max-w-2xl mx-auto">
              Our regional reps ensure trainees across every region have a voice and access to local support and opportunities.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {loading ? (
              <LoadingSkeleton count={6} type="rep" />
            ) : regionalReps.length === 0 ? (
              <div className="col-span-full text-center py-12 text-navy-foreground/50">
                <MapPin size={36} className="mx-auto mb-3 opacity-40" />
                <p>Regional representatives coming soon.</p>
              </div>
            ) : (
              regionalReps.map((member, i) => (
                <RegionalRepCard key={member.id} member={member} index={i} />
              ))
            )}
          </div>
        </div>
      </section>

    </div>
  );
};

export default AboutPage;