'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen, ExternalLink, Target, GraduationCap,
  Mic, ScrollText, FileText, MapPin, Star, Lightbulb,
  ChevronRight, ArrowLeft,
} from "lucide-react";
import { useState, useEffect } from "react";

// ─── Resource Data ────────────────────────────────

type Resource = {
  title: string;
  url: string;
  description: string;
  price?: string;
  highlight?: boolean;
};

const questionBanks: Resource[] = [
  {
    title: "Higher FRCS",
    url: "https://higherfrcs.co.uk",
    description: "1,500+ questions closely aligned with NICE guidelines. Widely considered the closest match to exam style and difficulty. The \"Tests\" feature tracks timing and cognitive fatigue, useful for building stamina. Desktop-focused interface can feel slow on mobile.",
    price: "£99/1 month · £139/6 months",
  },
  {
    title: "eFRCS",
    url: "https://www.efrcs.com",
    description: "~1,000 questions covering good breadth of the syllabus. The daily histogram comparing your score to other candidates is a useful benchmark of readiness. Question style is somewhat dated and less representative of the current exam format than newer platforms.",
    price: "£40/4 months · £50/6 months",
  },
  {
    title: "Companion to the FRCS",
    url: "https://frcscompanion.com",
    description: "750+ questions written by consultant examiners. Particularly strong on imaging — over 200 media resources including CT and MRI. Worth supplementing with Radiopaedia. Smaller question pool than Higher FRCS.",
    price: "£45/1 month · £79/6 months",
  },
  {
    title: "BMJ OnExamination",
    url: "https://www.onexamination.com/products/frcs-general-surgery",
    description: "1,015+ questions. The mobile app with offline download is genuinely useful for commutes and quiet on-calls. Less niche/up-to-date than surgeon-run platforms on latest FRCS-specific topics.",
    price: "£69.99/3 months – £159.99/12 months",
  },
  {
    title: "Grab the FRCS",
    url: "https://www.grabthefrcs.com",
    description: "Covers both Section 1 (~1,000 questions) and Section 2 (~250 scenarios), with video resources and virtual classrooms. Still feels like a work-in-progress in places.",
    price: "See website",
  },
  {
    title: "SurgeryOnlineFRCS",
    url: "https://www.surgeryonlinefrcs.com",
    description: "Modular and concise. The Consultant Interview module (82 real NHS interview questions) is a rare and useful extra for post-exam career planning. Can feel a bit neglected compared to newer competitors.",
    price: "See website",
  },
  {
    title: "Higher FRCS Viva",
    url: "https://higherviva.co.uk",
    description: "Online resource for Section 2 with 110+ viva scenarios and model audio answers. You can record your own answers and compare. Covers major subspecialties with guideline summaries.",
    price: "See website",
  },
];

type CourseResource = Resource & { location?: string };

const section2Courses: CourseResource[] = [
  {
    title: "Doctors Academy — FRCS Section 2 Course",
    url: "https://doctorsacademy.org/coursenw/dafrcs/",
    location: "Liverpool",
    description: "6-day hybrid: 4 evenings online via Zoom + 2 days face-to-face at the Royal Liverpool. Running for over 12 years. Mapped to the JCIE blueprint and ST8 Capabilities in Practice. Includes vivas, interactive discussions, and clinical examination with real patients. ST6+/SpR Year 4+.",
    price: "From ~£260",
  },
  {
    title: "Christie–Doctors Academy Section 2 Course",
    url: "https://doctorsacademy.org.uk/coursenw/cdafrcs/",
    location: "Manchester",
    description: "6-day hybrid: 4 evenings online covering core syllabus topics (breast, UGI, LGI, HPB, endocrine, transplant, trauma, critical care, statistics), then 2 days face-to-face at The Christie. A condensed alternative to the main Liverpool course.",
    price: "See website",
  },
  {
    title: "The NORTH Mock VIVA Course",
    url: "https://www.alsgbi.org/2025/05/02/the-north-general-surgery-frcs-mock-viva-course-leeds-17th-18th-january-2026/",
    location: "Leeds",
    description: "2-day intensive run by the ALSGBI. 5-minute scenario / 5-minute feedback loops — efficient for drilling viva technique. 3–4 scenarios per circuit. ALSGBI members get 11.1% discount.",
    price: "£450",
  },
  {
    title: "Whipps Cross Higher Surgery Course",
    url: "https://www.wxhighersurgery.com",
    location: "London",
    description: "7-day programme (virtual and in-person). Runs twice yearly before February and May exam sittings. Includes vivas, clinicals, interactive lectures, and symposia. Capped candidate numbers. One of the longest-established courses.",
    price: "£1,300 (Observers: £900)",
  },
  {
    title: "PrepMedico FRCS General Surgery",
    url: "https://prepmedico.com/frcs-general-surgery/",
    location: "Virtual",
    description: "Virtual course over several months with lectures and viva sessions. RCSEd-accredited for CPD. Sessions recorded for later review. Includes Telegram group and digital reference library. Section 1 candidates welcome as observers. ASiT members get 10% discount.",
    price: "From £850 (Lectures only) to £1,650 (Full + lectures)",
  },
  {
    title: "RCSEd Exit Exam Course",
    url: "https://services.rcsed.ac.uk/events-courses/frcs-preparation-course-for-the-exit-exam-in-general-surgery",
    location: "Chennai",
    description: "3-day, small-group viva practice. No lectures — purely practice. RCSEd-accredited. Good for international candidates or concentrated viva drilling.",
    price: "See website",
  },
];

const section1Courses: CourseResource[] = [
  {
    title: "Doctors Academy — Section 1 Starter Course",
    url: "https://doctorsacademy.org/coursenw/frcsp1M25/",
    location: "Zoom",
    description: "1–2 day course covering high-yield topics from each subspecialty with experienced consultants. Good for kickstarting revision or identifying gaps. ST5+/SpR Year 3+.",
    price: "~£195",
  },
];

const freeCourses: CourseResource[] = [
  {
    title: "RCSEd–ASGBI General Surgery FRCS Webinar Series",
    url: "https://services.rcsed.ac.uk/professional-support-development-resources/learning-resources/webinars/rcsed-asgbi-general-surgery-frcs-series",
    description: "Monthly webinars from ASGBI and RCSEd Trainee Committee. Clinical cases, viva-style questions, topic reviews. Archived recordings available to RCSEd members.",
    price: "Free (RCSEd membership for archive)",
  },
  {
    title: "Regional / Deanery Teaching Days",
    url: "",
    description: "Check with your TPD and regional School of Surgery. Most deaneries run FRCS-specific teaching days. Free, targeted, and often underused.",
    price: "Free",
  },
];

type PodcastResource = Resource & { links: { label: string; url: string }[]; appleId?: number };

const podcasts: PodcastResource[] = [
  {
    title: "First Incision",
    url: "https://podcasts.apple.com/us/podcast/first-incision/id1525453622",
    appleId: 1525453622,
    links: [
      { label: "Apple Podcasts", url: "https://podcasts.apple.com/us/podcast/first-incision/id1525453622" },
      { label: "Spotify", url: "https://open.spotify.com/show/0eUiOazl5oIxH1Y9ivgXbP" },
      { label: "Buzzsprout", url: "https://www.buzzsprout.com/1246988" },
    ],
    description: "Hosted by Amanda Nikolic. 119 episodes structured module-by-module across the entire surgical curriculum: breast, UGI, colorectal, HPB, endocrine, trauma, skin & soft tissue, vascular, anatomy, surgical oncology, and critical care. The most comprehensive and in-depth podcast coverage of the general surgery syllabus available. Although Aus/NZ-focused, the depth and structure make it invaluable for FRCS candidates at any stage of revision. Start early — this is a foundation-builder.",
    price: "Free",
    highlight: true,
  },
  {
    title: "Scrubbing In",
    url: "https://scrubbingin.carrd.co",
    appleId: 1688991386,
    links: [
      { label: "Website", url: "https://scrubbingin.carrd.co" },
      { label: "YouTube", url: "https://youtube.com/@ScrubbingInPodcast" },
    ],
    description: "Hosted by UK surgeons practising in the NHS. Directly aligned with UK guidelines. Strong on Emergency General Surgery algorithms. Episode 12 covers critical appraisal for the Academic station — listen to this specifically for Section 2 prep.",
    price: "Free",
  },
  {
    title: "Behind The Knife",
    url: "https://behindtheknife.org",
    appleId: 980990143,
    links: [
      { label: "Website", url: "https://behindtheknife.org" },
      { label: "Episodes", url: "https://behindtheknife.org/listen" },
    ],
    description: "The world's largest surgery podcast, 1,000+ episodes. The ABSITE Review episodes are excellent for rapid-fire basic science. Now running a collaborative series with the ASGBI comparing US and UK practice. Be careful with US-specific oncology guidelines, staging, and screening — cross-reference with NICE.",
    price: "Free",
  },
  {
    title: "St Mark\u2019s Academic Institute Podcast",
    url: "https://stmarksacademicinstitute.org.uk/resource-type/podcasts/",
    links: [
      { label: "Podcasts", url: "https://stmarksacademicinstitute.org.uk/resource-type/podcasts/" },
    ],
    description: "Deep dives into colorectal topics: LARS, pouches, robotic surgery, complex fistulae. Directly relevant for colorectal subspecialty vivas. The catalogue is relatively small — don\u2019t expect comprehensive syllabus coverage, but what\u2019s there is high quality.",
    price: "Free",
  },
  {
    title: "ASGBI Podcast",
    url: "https://asgbi.podbean.com",
    links: [
      { label: "Podbean", url: "https://asgbi.podbean.com" },
    ],
    description: "The Association of Surgeons of Great Britain and Ireland\u2019s podcast channel. General surgical topics including intestinal failure, sustainability, and the BTK/ASGBI collaborative series.",
    price: "Free",
  },
];

const guidelines: Resource[] = [
  {
    title: "JCIE Syllabus Blueprint",
    url: "https://www.jcie.org.uk/content/content.aspx?ID=14",
    description: "The single most important document. Defines the scope of what can be tested. Read it before you start revising and revisit periodically. Download the 2023 version.",
  },
  {
    title: "NICE Guidelines",
    url: "https://www.nice.org.uk/guidance",
    description: "The exam is heavily NICE-aligned. Key areas: colorectal cancer, acute upper GI bleeding, gallstone disease, venous thromboembolism, sepsis, major trauma. Know the specific recommendations and recent updates.",
  },
  {
    title: "EAST Guidelines",
    url: "https://www.east.org/education-resources/practice-management-guidelines",
    description: "Eastern Association for the Surgery of Trauma. Evidence-based guidelines for the trauma component. US-origin but evidence base is largely transferable.",
  },
  {
    title: "WSES Guidelines",
    url: "https://www.wses.org.uk",
    description: "World Society of Emergency Surgery. Particularly useful for emergency laparotomy, complicated intra-abdominal infections, and trauma management protocols.",
  },
  {
    title: "Roux Group Mind Maps & Resources",
    url: "https://rouxgroup.org.uk/frcs_revision/",
    description: "Free mind maps covering FRCS syllabus topics, produced by the trainee section of AUGIS. Good for quick visual revision and mapping topic relationships. Also has key paper summaries and guideline digests for Upper GI surgery.",
  },
  {
    title: "Radiopaedia",
    url: "https://radiopaedia.org",
    description: "Essential companion to any imaging-heavy question bank. Review the radiological appearances of common surgical pathology — CT, MRI, and plain film interpretation.",
  },
];

type TextbookResource = Resource & { authors?: string; coverIsbn?: string };

const sbaVivaBooks: TextbookResource[] = [
  {
    title: "SBAs and EMIs for the General Surgery FRCS — \"The Blue Book\"",
    authors: "Molloy, MacKay, Roxburgh & Quinn (2020)",
    url: "https://www.amazon.co.uk/s?k=SBAs+EMIs+General+Surgery+FRCS+Molloy",
    description: "Over 600 challenging questions. Widely considered the most-used SBA book for Section 1. Written before the switch to SBA-only format so includes EMIs, but the EMI content is still valuable.",
    coverIsbn: "9780198794158",
  },
  {
    title: "Higher FRCS: SBAs for Section 1",
    authors: "Siddiqui et al.",
    url: "https://www.routledge.com/Higher-FRCS-SBAs-for-Section-1-of-the-General-Surgery-FRCS-Examination/Siddiqui/p/book/9781032076126",
    description: "400 SBAs mapped to current UK guidelines. More contemporary than the Blue Book. A good complement rather than replacement.",
    coverIsbn: "9781032076126",
  },
  {
    title: "FRCS General Surgery: 500 SBAs and EMIs — \"The Green Book\"",
    authors: "Wilson & Hildebrand (2018)",
    url: "https://www.amazon.co.uk/s?k=FRCS+General+Surgery+500+SBAs+EMIs+Wilson",
    description: "Reasonable coverage. The first edition had errors — ensure you have the corrected/second edition.",
    coverIsbn: "9781909836693",
  },
  {
    title: "Cracking the Intercollegiate General Surgery FRCS Viva",
    authors: "T.Y. Tang et al.",
    url: "https://www.amazon.co.uk/s?k=Cracking+Intercollegiate+General+Surgery+FRCS+Viva",
    description: "Essential for Section 2. Teaches you how to structure and deliver concise, examiner-friendly viva answers. Not a knowledge textbook — it\u2019s about technique.",
    coverIsbn: "9780367179427",
  },
  {
    title: "FRCS (General Surgery): A Road to Success",
    authors: "Doctors Academy",
    url: "https://publications.doctorsacademy.org/product-details/frcs-ars/index.php",
    description: "Q&A format structured around clinical scenarios with images. Mapped to the JCIE/JSCFE syllabus.",
  },
];

const companionSeries: TextbookResource[] = [
  {
    title: "Companion to Specialist Surgical Practice",
    authors: "Paterson-Brown & Garden (Editors), 8 volumes",
    url: "https://www.amazon.co.uk/s?k=Companion+to+Specialist+Surgical+Practice+7th",
    description: "The pre-eminent reference series. Mainly used for Section 2 and deepening understanding. Read your subspecialty volume thoroughly. Key volumes include Core Topics in General and Emergency Surgery (human factors, perioperative care, evaluating surgical literature) and Colorectal Surgery (7th Ed., Clark & Tozer).",
    coverIsbn: "0702085014",
  },
];

const traumaBooks: TextbookResource[] = [
  {
    title: "Top Knife: The Art & Craft of Trauma Surgery",
    authors: "Hirshberg & Mattox",
    url: "https://www.amazon.co.uk/s?k=Top+Knife+Hirshberg+Mattox",
    description: "Practical, readable, opinionated. Covers operative trauma surgery in a way standard textbooks don\u2019t. Widely recommended by trainees.",
    coverIsbn: "9781903378229",
  },
  {
    title: "Trauma: Code Red",
    authors: "Khan & McMonagle",
    url: "https://www.amazon.co.uk/s?k=Trauma+Code+Red+Khan+McMonagle",
    description: "Companion to the RCSEng DSTS course. Focused on massive haemorrhage control and damage control surgery.",
    coverIsbn: "9781138477018",
  },
  {
    title: "Hamilton Bailey\u2019s Emergency Surgery",
    authors: "English & Pearce (15th Ed., 2025)",
    url: "https://www.amazon.co.uk/s?k=Hamilton+Bailey+Emergency+Surgery",
    description: "Updated edition of a classic. Covers the breadth of emergency surgery including trauma.",
    coverIsbn: "9781032841366",
  },
];

const referenceTexts: TextbookResource[] = [
  {
    title: "Bailey & Love\u2019s Short Practice of Surgery",
    authors: "",
    url: "https://www.amazon.co.uk/s?k=Bailey+and+Love+Short+Practice+of+Surgery",
    description: "The standard UK surgical textbook. Good for foundational concepts and breadth. Keep on the shelf — don\u2019t read cover-to-cover for the FRCS.",
    coverIsbn: "9780367548117",
  },
  {
    title: "Sabiston Textbook of Surgery",
    authors: "",
    url: "https://www.amazon.co.uk/s?k=Sabiston+Textbook+of+Surgery",
    description: "Comprehensive US reference. Strong on pathophysiology and surgical science. Same US/UK guideline caveat applies.",
    coverIsbn: "9780323640626",
  },
  {
    title: "Mastery of Surgery",
    authors: "Fischer / Ellison",
    url: "https://www.amazon.co.uk/s?k=Mastery+of+Surgery+Fischer",
    description: "Two-volume operative manual. Useful when you need step-by-step procedure descriptions for viva preparation around operative technique.",
    coverIsbn: "9781975176433",
  },
];

// ─── Components ───────────────────────────────────

function ResourceCard({ resource, location }: { resource: Resource; location?: string }) {
  return (
    <Card className="border h-full transition-shadow hover:shadow-md">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground leading-tight pr-2">{resource.title}</h3>
          {resource.url && (
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        {location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin size={11} className="text-gold" />
            {location}
          </div>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">{resource.description}</p>
        {resource.price && (
          <Badge variant="secondary" className="text-[10px] mt-3 w-fit">{resource.price}</Badge>
        )}
      </CardContent>
    </Card>
  );
}

function BookCoverImage({ isbn, title }: { isbn: string; title: string }) {
  const [failed, setFailed] = useState(false);

  const fallback = (
    <div className="w-[100px] sm:w-[120px] h-[150px] sm:h-[175px] shrink-0 rounded-lg bg-navy/10 flex items-center justify-center">
      <BookOpen size={28} className="text-navy/40" />
    </div>
  );

  if (failed) return fallback;

  return (
    <img
      src={`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`}
      alt={title}
      className="w-[100px] sm:w-[120px] h-[150px] sm:h-[175px] shrink-0 rounded-lg object-cover shadow-md bg-muted"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth <= 1 && img.naturalHeight <= 1) setFailed(true);
      }}
    />
  );
}

function PodcastArtwork({ appleId, title }: { appleId: number; title: string }) {
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`https://itunes.apple.com/lookup?id=${appleId}`)
      .then(res => res.json())
      .then(data => {
        if (data.results?.[0]?.artworkUrl600) {
          setArtworkUrl(data.results[0].artworkUrl600);
        }
      })
      .catch(() => {});
  }, [appleId]);

  if (!artworkUrl) {
    return (
      <div className="w-16 h-16 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
        <Mic size={24} className="text-navy" />
      </div>
    );
  }

  return (
    <img
      src={artworkUrl}
      alt={title}
      className="w-16 h-16 rounded-lg object-cover shadow-sm shrink-0 bg-muted"
    />
  );
}

function TextbookCard({ book }: { book: TextbookResource }) {
  return (
    <Card className="border h-full transition-shadow hover:shadow-md">
      <CardContent className="p-5 flex gap-4 h-full">
        {book.coverIsbn && (
          <BookCoverImage isbn={book.coverIsbn} title={book.title} />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-foreground leading-tight pr-2">{book.title}</h3>
            {book.url && (
              <a href={book.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {book.authors && (
            <p className="text-xs text-muted-foreground/70 italic mb-2">{book.authors}</p>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">{book.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────

export default function RevisionResourcesPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back navigation */}
      <Link
        href="/members/frcs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={16} />
        Back to FRCS Resources
      </Link>

      {/* Hero Banner */}
      <div className="rounded-xl border bg-gradient-to-br from-navy to-navy/90 p-6 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-foreground">
          FRCS General Surgery: Revision Resources
        </h1>
        <p className="text-sm sm:text-base text-navy-foreground/80 mt-2 max-w-3xl leading-relaxed">
          A practical guide to question banks, courses, podcasts, guidelines, and textbooks for the
          Intercollegiate FRCS exit exam. Start with the JCIE Syllabus Blueprint &mdash; it defines
          the scope of the exam and should frame everything else you use.
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <a
            href="https://www.jcie.org.uk/content/content.aspx?ID=14"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-navy-foreground text-sm font-medium transition-colors"
          >
            <ScrollText size={15} />
            JCIE General Surgery
            <ExternalLink size={12} className="opacity-60" />
          </a>
          <a
            href="https://www.jcie.org.uk/content/content.aspx?ID=4"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold text-sm font-medium transition-colors"
          >
            <FileText size={15} />
            Syllabus Blueprint 2023
            <ExternalLink size={12} className="opacity-60" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="qbanks" className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1.5 rounded-lg">
          <TabsTrigger value="qbanks" className="text-xs sm:text-sm">Question Banks</TabsTrigger>
          <TabsTrigger value="courses" className="text-xs sm:text-sm">Courses</TabsTrigger>
          <TabsTrigger value="podcasts" className="text-xs sm:text-sm">Podcasts</TabsTrigger>
          <TabsTrigger value="guidelines" className="text-xs sm:text-sm">Guidelines</TabsTrigger>
          <TabsTrigger value="textbooks" className="text-xs sm:text-sm">Textbooks</TabsTrigger>
          <TabsTrigger value="advice" className="text-xs sm:text-sm">Study Advice</TabsTrigger>
        </TabsList>

        {/* ── Question Banks ── */}
        <TabsContent value="qbanks" className="mt-4 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Lightbulb size={18} className="text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Question banks are the single most important resource for Section 1. Reading alone is
              not enough &mdash; you need to practise under exam conditions. Most successful
              candidates use two or three simultaneously.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {questionBanks.map((qb) => (
              <ResourceCard key={qb.title} resource={qb} />
            ))}
          </div>
        </TabsContent>

        {/* ── Courses ── */}
        <TabsContent value="courses" className="mt-4 space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Lightbulb size={18} className="text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can&apos;t pass the viva just by reading. You need to be grilled under pressure to
              fix your verbal structure and eliminate hesitation. Attend at least one formal course
              for Section 2.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Section 2 Courses</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {section2Courses.map((c) => (
                <ResourceCard key={c.title} resource={c} location={c.location} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Section 1 Courses</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {section1Courses.map((c) => (
                <ResourceCard key={c.title} resource={c} location={c.location} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Free / Low Cost</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {freeCourses.map((c) => (
                <ResourceCard key={c.title} resource={c} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Podcasts ── */}
        <TabsContent value="podcasts" className="mt-4 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Lightbulb size={18} className="text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Podcasts won&apos;t pass the exam on their own, but they&apos;re excellent for building
              baseline knowledge and filling dead time. Be aware of US/UK guideline differences on
              any American-origin content.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {podcasts.map((pod) => (
              <Card key={pod.title} className={`border h-full transition-shadow hover:shadow-md ${pod.highlight ? "ring-2 ring-gold/30 border-gold/40" : ""}`}>
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {pod.appleId ? (
                        <PodcastArtwork appleId={pod.appleId} title={pod.title} />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
                          <Mic size={24} className="text-navy" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground leading-tight">{pod.title}</h3>
                        {pod.highlight && (
                          <Badge className="text-[10px] bg-gold/15 text-gold border-gold/30 mt-1" variant="outline">
                            <Star size={10} className="mr-1" /> Recommended
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1 flex-1">{pod.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {pod.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                      >
                        {link.label} <ExternalLink size={10} />
                      </a>
                    ))}
                  </div>
                  {pod.price && (
                    <Badge variant="secondary" className="text-[10px] mt-3 w-fit">{pod.price}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Guidelines ── */}
        <TabsContent value="guidelines" className="mt-4 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Lightbulb size={18} className="text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              The exam is heavily guideline-driven. Reading the primary sources &mdash; not just
              summaries &mdash; will set you apart.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {guidelines.map((g) => (
              <ResourceCard key={g.title} resource={g} />
            ))}
          </div>
        </TabsContent>

        {/* ── Textbooks ── */}
        <TabsContent value="textbooks" className="mt-4 space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Lightbulb size={18} className="text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              No single book covers the exam. SBA books and question banks for Section 1, the
              Companion series and viva guides for Section 2, and targeted texts as needed.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">SBA & Viva Books</h3>
            <div className="grid gap-4">
              {sbaVivaBooks.map((b) => (
                <TextbookCard key={b.title} book={b} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">The Companion Series</h3>
            <div className="grid gap-4">
              {companionSeries.map((b) => (
                <TextbookCard key={b.title} book={b} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trauma</h3>
            <div className="grid gap-4">
              {traumaBooks.map((b) => (
                <TextbookCard key={b.title} book={b} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Reference Texts</h3>
            <div className="grid gap-4">
              {referenceTexts.map((b) => (
                <TextbookCard key={b.title} book={b} />
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Study Advice ── */}
        <TabsContent value="advice" className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                    <Target size={18} className="text-navy" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Section 1</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Start 3&ndash;6 months before the exam</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Use 2&ndash;3 question banks as your primary resource</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Supplement with the Blue Book and/or Higher FRCS SBA book</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Read the Companion series to fill knowledge gaps identified by questions</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Don&apos;t waste attempts &mdash; you have four, and they go quickly</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                    <GraduationCap size={18} className="text-navy" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Section 2</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Attend at least one formal viva course</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Get consultants to viva you regularly in clinic and on the ward</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Set up a study group for peer viva practice</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Read the Companion series volume for your subspecialty thoroughly</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Use Cracking the FRCS Viva for answer structure</li>
                  <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Practise critical appraisal for the Academic station</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Lightbulb size={18} className="text-gold" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Throughout</h3>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground leading-relaxed">
                <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Read the JCIE syllabus</li>
                <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Subscribe to BJS and Annals of Surgery</li>
                <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Attend your deanery teaching days</li>
                <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Listen to First Incision on your commute</li>
                <li className="flex gap-2"><ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />Keep a running list of weak topics and actively target them</li>
              </ul>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground/60 text-center pt-2">
            Prices and availability checked March 2026. Links may change.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
