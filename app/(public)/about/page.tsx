'use client'
import { useState } from "react";



import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { ChevronDown, MapPin, User, FileText, Download, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";







type ExecRole =
  | "President"
  | "Vice-President"
  | "Past-President"
  | "Secretary"
  | "Web Master"
  | "IBD Lead"
  | "Abdominal Wall / Intestinal Failure Lead"
  | "Pelvic Floor Lead"
  | "Proctology Lead"
  | "Endoscopy Lead"
  | "ASiT Representative"
  | "Research Lead"
  | "Advanced Cancer Lead"
  | "Training and Education Lead";

type CommitteeMember = {
  name: string;
  role: ExecRole;
  placeOfWork: string;
  statement: string;
  image?: string;
};

const committeeMembers: CommitteeMember[] = [
  {
    name: "Mr James Richardson",
    role: "President",
    placeOfWork: "St Mark's Hospital, London",
    image: "/images/committee/jason.png",
    statement:
      "It is a privilege to serve as President of the Dukes' Club. Our mission remains to support the next generation of colorectal surgeons through world-class education, training opportunities, and a strong sense of community. I look forward to building on the excellent work of my predecessors and championing initiatives that will shape the future of our specialty.",
  },
  {
    name: "Miss Sarah Thompson",
    role: "Vice-President",
    placeOfWork: "Oxford University Hospitals",
    image: "/images/committee/charlotte.png",
    statement:
      "As Vice-President, I am committed to expanding our educational programme and fostering collaboration between trainees across the UK. The Dukes' Club has been instrumental in my own development, and I am passionate about ensuring every trainee has access to the same opportunities and mentorship that shaped my career.",
  },
  {
    name: "Mr David Clarke",
    role: "Past-President",
    placeOfWork: "Leeds Teaching Hospitals",
    image: "/images/committee/joshua.png",
    statement:
      "Serving as President was one of the highlights of my career. I remain dedicated to supporting the Club in an advisory capacity, drawing on my experience to guide strategic decisions and ensure continuity of our core values: excellence, collegiality, and innovation in colorectal surgery training.",
  },
  {
    name: "Miss Emily Watson",
    role: "Secretary",
    placeOfWork: "Royal London Hospital",
    image: "/images/committee/badge.png",
    statement:
      "As Secretary, I ensure the smooth running of all Club operations, from committee meetings to our annual programme of events. I am passionate about transparency and communication, and I work to keep our membership informed and engaged with everything the Dukes' Club has to offer.",
  },
  {
    name: "Mr Andrew Chen",
    role: "Web Master",
    placeOfWork: "University Hospitals Birmingham",
    image: "/images/committee/susanna.png",
    statement:
      "I am responsible for the Club's digital presence, ensuring our website and online resources serve as a valuable hub for trainees. My goal is to make information accessible, streamline membership processes, and leverage technology to enhance the trainee experience.",
  },
  {
    name: "Miss Priya Patel",
    role: "IBD Lead",
    placeOfWork: "John Radcliffe Hospital, Oxford",
    statement:
      "Inflammatory bowel disease surgery is a rapidly evolving field, and I am committed to organising courses and resources that keep trainees at the forefront of best practice. From pouch surgery workshops to multidisciplinary case discussions, our IBD programme aims to build confidence and competence.",
  },
  {
    name: "Mr Robert Hughes",
    role: "Abdominal Wall / Intestinal Failure Lead",
    placeOfWork: "Salford Royal Hospital",
    statement:
      "Complex abdominal wall reconstruction and intestinal failure represent some of the most challenging areas in our specialty. I lead educational initiatives including cadaveric courses and lecture days to equip trainees with the knowledge and skills needed to manage these demanding cases.",
  },
  {
    name: "Miss Laura Mitchell",
    role: "Pelvic Floor Lead",
    placeOfWork: "St James's University Hospital, Leeds",
    statement:
      "Pelvic floor disorders significantly impact quality of life, and surgical training in this area requires a nuanced, multidisciplinary approach. I coordinate masterclasses and webinars that cover the latest assessment techniques, surgical options, and shared decision-making frameworks.",
  },
  {
    name: "Mr Oliver Grant",
    role: "Proctology Lead",
    placeOfWork: "St Mark's Hospital, London",
    statement:
      "Proctology encompasses a wide range of conditions requiring both surgical finesse and excellent patient communication. I am dedicated to developing training resources that cover everything from fistula management to haemorrhoidal disease, ensuring trainees are well-prepared for independent practice.",
  },
  {
    name: "Miss Hannah Brooks",
    role: "Endoscopy Lead",
    placeOfWork: "Guy's and St Thomas' Hospital, London",
    statement:
      "Endoscopy is fundamental to colorectal practice, and I work to ensure trainees have access to high-quality training in both diagnostic and therapeutic techniques. Our programme includes simulation days, TEMS workshops, and guidance on achieving JAG accreditation.",
  },
  {
    name: "Mr Daniel Foster",
    role: "ASiT Representative",
    placeOfWork: "Royal Infirmary of Edinburgh",
    statement:
      "As the ASiT representative, I act as a bridge between the Dukes' Club and the wider surgical trainee community. I advocate for trainee interests at a national level and ensure that colorectal surgery is well represented in cross-specialty initiatives and workforce planning discussions.",
  },
  {
    name: "Miss Catherine Byrne",
    role: "Research Lead",
    placeOfWork: "Addenbrooke's Hospital, Cambridge",
    statement:
      "Research is the foundation of surgical progress, and I am passionate about supporting trainees to engage in high-quality clinical and translational research. I coordinate the annual research prize, facilitate collaborative studies, and provide mentorship for those pursuing academic careers.",
  },
  {
    name: "Mr Thomas Ashworth",
    role: "Advanced Cancer Lead",
    placeOfWork: "The Christie, Manchester",
    statement:
      "Advanced and locally recurrent colorectal cancer requires specialist expertise and a multidisciplinary approach. I lead educational events focused on exenterative surgery, peritoneal malignancy, and the latest systemic therapies, preparing trainees for the most complex oncological challenges.",
  },
  {
    name: "Miss Rebecca Norton",
    role: "Training and Education Lead",
    placeOfWork: "Queen Elizabeth Hospital, Birmingham",
    statement:
      "As Training and Education Lead, I oversee our curriculum development and educational strategy. My focus is on ensuring our programme aligns with the evolving training landscape, incorporating simulation, e-learning, and competency-based assessment to support trainees at every stage of their journey.",
  },
];

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

      {/* Photo / Avatar */}
      <div className="relative z-10 pt-8 pb-4 flex items-center justify-center">
        <div className="w-36 h-36 rounded-full bg-navy-foreground/10 flex items-center justify-center overflow-hidden shadow-md transition-transform duration-300 group-hover:scale-110">
          {member.image ? (
            <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <User className="text-gold/60" size={52} />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="relative z-10 px-6 pb-6 text-center">
        <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-1">
          {member.name}
        </h3>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/20 text-gold mb-2 inline-block">
          {member.role}
        </span>
        <div className="flex items-center justify-center gap-1.5 text-sm text-navy-foreground/60 mb-4">
          <MapPin size={13} className="text-gold shrink-0" />
          <span>{member.placeOfWork}</span>
        </div>

        {/* Expandable statement */}
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
      </div>
    </div>
  );
};

type RegionalRep = {
  region: string;
  name: string;
  image?: string;
};

const regionalReps: RegionalRep[] = [
  { region: "Mersey", name: "TBC" },
  { region: "Wessex", name: "TBC" },
  { region: "North East Thames", name: "TBC" },
  { region: "North West", name: "TBC" },
  { region: "Yorkshire", name: "TBC" },
  { region: "South West", name: "TBC" },
  { region: "South Wales", name: "TBC" },
  { region: "Scotland", name: "TBC" },
  { region: "Republic of Ireland", name: "TBC" },
  { region: "East Anglia", name: "TBC" },
  { region: "SE Thames", name: "TBC" },
  { region: "Oxford", name: "TBC" },
  { region: "Northern", name: "TBC" },
  { region: "North West Thames", name: "TBC" },
  { region: "West Midlands", name: "TBC" },
  { region: "North Wales", name: "TBC" },
  { region: "East Midlands", name: "TBC" },
  { region: "Northern Ireland", name: "TBC" },
];

const RegionalRepCard = ({
  rep,
  index,
}: {
  rep: RegionalRep;
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
        {rep.image ? (
          <img src={rep.image} alt={rep.name} className="w-full h-full object-cover" />
        ) : (
          <User className="text-gold/60" size={24} />
        )}
      </div>

      {/* Text */}
      <div className="relative z-10 text-left">
        <h3 className="text-sm font-sans font-semibold text-navy-foreground leading-tight">
          {rep.region}
        </h3>
        <p className="text-xs text-navy-foreground/60 mt-0.5">{rep.name}</p>
      </div>
    </div>
  );
};

const AboutPage = () => {
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
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3 animate-fade-in">
            Who We Are
          </p>
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            About Dukes' Club
          </h1>
          <p className="mt-4 text-navy-foreground/80 max-w-2xl text-base md:text-lg animate-fade-in">
            The Dukes' Club is the national trainee association for colorectal surgery in the United Kingdom, dedicated to education, training, and community.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }}>
        <div className="container mx-auto px-4 py-16">
          <AnimatedSection>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground mb-6">
                Our Mission
              </h2>
              <p className="text-navy-foreground/90 text-lg leading-relaxed">
                Founded to support and advance colorectal surgical training in the UK, the Dukes' Club provides
                a platform for education, research, networking, and professional development. We organise courses,
                webinars, and our flagship Annual Weekend, while working closely with the ACPGBI to represent
                the interests of trainees at every level.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Executive Committee */}
      <section className="bg-navy py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3">
              Leadership
            </p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground">
              Executive Committee
            </h2>
            <p className="mt-4 text-navy-foreground/80 max-w-2xl mx-auto">
              Meet the dedicated team driving the Dukes' Club forward. Click on any member to read their personal statement.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {committeeMembers.map((member, i) => (
              <CommitteeCard key={member.role} member={member} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Constitution & Governance */}
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }} className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3">
              Governance
            </p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground">
              Constitution & Roles
            </h2>
            <p className="mt-4 text-navy-foreground/80 max-w-2xl mx-auto">
              The Dukes' Club is governed by a formal constitution. Each executive committee role carries specific responsibilities outlined in the documents below.
            </p>
          </AnimatedSection>

          <div className="max-w-4xl mx-auto">
            {/* Constitution */}
            <AnimatedSection delay={100}>
              <a
                href="#"
                className="group flex items-center gap-4 rounded-lg border-2 border-navy-foreground bg-navy p-6 mb-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                  <BookOpen size={22} className="text-gold" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-sans font-semibold text-navy-foreground">
                    Dukes' Club Constitution
                  </h3>
                  <p className="text-sm text-navy-foreground/60">
                    The governing document of the Dukes' Club, outlining objectives, membership, and committee structure.
                  </p>
                </div>
                <Download size={18} className="text-navy-foreground/40 group-hover:text-gold transition-colors shrink-0" />
              </a>
            </AnimatedSection>

            {/* Role Documents */}
            <AnimatedSection delay={200}>
              <h3 className="text-lg font-sans font-semibold text-navy-foreground mb-4 mt-8">
                Roles & Responsibilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
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
                ].map((role) => (
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
      <section style={{ backgroundColor: "hsl(220, 80%, 55%)" }} className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3">
              Across the UK & Ireland
            </p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground">
              Regional Representatives
            </h2>
            <p className="mt-4 text-navy-foreground/80 max-w-2xl mx-auto">
              Our regional reps ensure trainees across every region have a voice and access to local support and opportunities.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regionalReps.map((rep, i) => (
              <RegionalRepCard key={rep.region} rep={rep} index={i} />
            ))}
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default AboutPage;
