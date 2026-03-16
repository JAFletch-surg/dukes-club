'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileText, BookOpen, GraduationCap, ExternalLink, Trophy, Target, Flame,
  TrendingUp, ArrowRight, Loader2, Users, Lock, Clock, Mic, ScrollText,
  MapPin, Star, Lightbulb, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { isQuestionBankTrialExpired, getTrialDaysRemaining } from "@/lib/membership-gates";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserStats {
  total_attempted: number;
  total_correct: number;
  overall_percentage: number;
  total_sessions: number;
  best_exam_percentage: number;
  current_streak_days: number;
}

interface TopicPerformance {
  topic_id: string;
  topic_name: string;
  category: string;
  attempted: number;
  correct: number;
  percentage: number;
}

interface ScoreBucket {
  bucket: number;
  count: number;
}

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
    price: "\u00a399/1 month \u00b7 \u00a3139/6 months",
  },
  {
    title: "eFRCS",
    url: "https://www.efrcs.com",
    description: "~1,000 questions covering good breadth of the syllabus. The daily histogram comparing your score to other candidates is a useful benchmark of readiness. Question style is somewhat dated and less representative of the current exam format than newer platforms.",
    price: "\u00a340/4 months \u00b7 \u00a350/6 months",
  },
  {
    title: "Companion to the FRCS",
    url: "https://frcscompanion.com",
    description: "750+ questions written by consultant examiners. Particularly strong on imaging \u2014 over 200 media resources including CT and MRI. Worth supplementing with Radiopaedia. Smaller question pool than Higher FRCS.",
    price: "\u00a345/1 month \u00b7 \u00a379/6 months",
  },
  {
    title: "BMJ OnExamination",
    url: "https://www.onexamination.com/products/frcs-general-surgery",
    description: "1,015+ questions. The mobile app with offline download is genuinely useful for commutes and quiet on-calls. Less niche/up-to-date than surgeon-run platforms on latest FRCS-specific topics.",
    price: "\u00a369.99/3 months \u2013 \u00a3159.99/12 months",
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
    title: "Doctors Academy \u2014 FRCS Section 2 Course",
    url: "https://doctorsacademy.org/coursenw/dafrcs/",
    location: "Liverpool",
    description: "6-day hybrid: 4 evenings online via Zoom + 2 days face-to-face at the Royal Liverpool. Running for over 12 years. Mapped to the JCIE blueprint and ST8 Capabilities in Practice. Includes vivas, interactive discussions, and clinical examination with real patients. ST6+/SpR Year 4+.",
    price: "From ~\u00a3260",
  },
  {
    title: "Christie\u2013Doctors Academy Section 2 Course",
    url: "https://doctorsacademy.org.uk/coursenw/cdafrcs/",
    location: "Manchester",
    description: "6-day hybrid: 4 evenings online covering core syllabus topics (breast, UGI, LGI, HPB, endocrine, transplant, trauma, critical care, statistics), then 2 days face-to-face at The Christie. A condensed alternative to the main Liverpool course.",
    price: "See website",
  },
  {
    title: "The NORTH Mock VIVA Course",
    url: "https://www.alsgbi.org/2025/05/02/the-north-general-surgery-frcs-mock-viva-course-leeds-17th-18th-january-2026/",
    location: "Leeds",
    description: "2-day intensive run by the ALSGBI. 5-minute scenario / 5-minute feedback loops \u2014 efficient for drilling viva technique. 3\u20134 scenarios per circuit. ALSGBI members get 11.1% discount.",
    price: "Contact: b.amr@nhs.net",
  },
  {
    title: "Whipps Cross Higher Surgery Course",
    url: "https://www.wxhighersurgery.com",
    location: "London",
    description: "7-day programme (virtual and in-person). Runs twice yearly before February and May exam sittings. Includes vivas, clinicals, interactive lectures, and symposia. Capped candidate numbers. One of the longest-established courses.",
    price: "See website",
  },
  {
    title: "PrepMedico FRCS General Surgery",
    url: "https://prepmedico.com/frcs-general-surgery/",
    location: "Virtual",
    description: "Virtual course over several months with lectures and viva sessions. RCSEd-accredited for CPD. Sessions recorded for later review. Includes Telegram group and digital reference library. Section 1 candidates welcome as observers. ASiT members get 10% discount.",
    price: "See website",
  },
  {
    title: "RCSEd Exit Exam Course",
    url: "https://services.rcsed.ac.uk/events-courses/frcs-preparation-course-for-the-exit-exam-in-general-surgery",
    location: "Chennai",
    description: "3-day, small-group viva practice. No lectures \u2014 purely practice. RCSEd-accredited. Good for international candidates or concentrated viva drilling.",
    price: "See website",
  },
];

const section1Courses: CourseResource[] = [
  {
    title: "Doctors Academy \u2014 Section 1 Starter Course",
    url: "https://doctorsacademy.org/coursenw/frcsp1M25/",
    location: "Zoom",
    description: "1\u20132 day course covering high-yield topics from each subspecialty with experienced consultants. Good for kickstarting revision or identifying gaps. ST5+/SpR Year 3+.",
    price: "~\u00a3195",
  },
];

const freeCourses: CourseResource[] = [
  {
    title: "RCSEd\u2013ASGBI General Surgery FRCS Webinar Series",
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

type PodcastResource = Resource & { links: { label: string; url: string }[] };

const podcasts: PodcastResource[] = [
  {
    title: "First Incision",
    url: "https://podcasts.apple.com/us/podcast/first-incision/id1525453622",
    links: [
      { label: "Apple Podcasts", url: "https://podcasts.apple.com/us/podcast/first-incision/id1525453622" },
      { label: "Spotify", url: "https://open.spotify.com/show/0eUiOazl5oIxH1Y9ivgXbP" },
      { label: "Buzzsprout", url: "https://www.buzzsprout.com/1246988" },
    ],
    description: "Hosted by Amanda Nikolic. 119 episodes structured module-by-module across the entire surgical curriculum: breast, UGI, colorectal, HPB, endocrine, trauma, skin & soft tissue, vascular, anatomy, surgical oncology, and critical care. The most comprehensive and in-depth podcast coverage of the general surgery syllabus available. Although Aus/NZ-focused, the depth and structure make it invaluable for FRCS candidates at any stage of revision. Start early \u2014 this is a foundation-builder.",
    price: "Free",
    highlight: true,
  },
  {
    title: "Scrubbing In",
    url: "https://scrubbingin.carrd.co",
    links: [
      { label: "Website", url: "https://scrubbingin.carrd.co" },
      { label: "YouTube", url: "https://youtube.com/@ScrubbingInPodcast" },
    ],
    description: "Hosted by UK surgeons practising in the NHS. Directly aligned with UK guidelines. Strong on Emergency General Surgery algorithms. Episode 12 covers critical appraisal for the Academic station \u2014 listen to this specifically for Section 2 prep.",
    price: "Free",
  },
  {
    title: "Behind The Knife",
    url: "https://behindtheknife.org",
    links: [
      { label: "Website", url: "https://behindtheknife.org" },
      { label: "Episodes", url: "https://behindtheknife.org/listen" },
    ],
    description: "The world's largest surgery podcast, 1,000+ episodes. The ABSITE Review episodes are excellent for rapid-fire basic science. Now running a collaborative series with the ASGBI comparing US and UK practice. Be careful with US-specific oncology guidelines, staging, and screening \u2014 cross-reference with NICE.",
    price: "Free",
  },
  {
    title: "St Mark\u2019s Academic Institute Podcast",
    url: "https://stmarksacademicinstitute.org.uk/resource-type/podcasts/",
    links: [
      { label: "Podcasts", url: "https://stmarksacademicinstitute.org.uk/resource-type/podcasts/" },
    ],
    description: "Deep dives into colorectal topics: LARS, pouches, robotic surgery, complex fistulae. Directly relevant for colorectal subspecialty vivas. The catalogue is relatively small \u2014 don\u2019t expect comprehensive syllabus coverage, but what\u2019s there is high quality.",
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
    description: "Essential companion to any imaging-heavy question bank. Review the radiological appearances of common surgical pathology \u2014 CT, MRI, and plain film interpretation.",
  },
];

type TextbookResource = Resource & { authors?: string };

const sbaVivaBooks: TextbookResource[] = [
  {
    title: "SBAs and EMIs for the General Surgery FRCS \u2014 \"The Blue Book\"",
    authors: "Molloy, MacKay, Roxburgh & Quinn (2020)",
    url: "https://www.amazon.co.uk/s?k=SBAs+EMIs+General+Surgery+FRCS+Molloy",
    description: "Over 600 challenging questions. Widely considered the most-used SBA book for Section 1. Written before the switch to SBA-only format so includes EMIs, but the EMI content is still valuable.",
  },
  {
    title: "Higher FRCS: SBAs for Section 1",
    authors: "Siddiqui et al.",
    url: "https://www.routledge.com/Higher-FRCS-SBAs-for-Section-1-of-the-General-Surgery-FRCS-Examination/Siddiqui/p/book/9781032076126",
    description: "400 SBAs mapped to current UK guidelines. More contemporary than the Blue Book. A good complement rather than replacement.",
  },
  {
    title: "FRCS General Surgery: 500 SBAs and EMIs \u2014 \"The Green Book\"",
    authors: "Wilson & Hildebrand (2018)",
    url: "https://www.amazon.co.uk/s?k=FRCS+General+Surgery+500+SBAs+EMIs+Wilson",
    description: "Reasonable coverage. The first edition had errors \u2014 ensure you have the corrected/second edition.",
  },
  {
    title: "Cracking the Intercollegiate General Surgery FRCS Viva",
    authors: "T.Y. Tang et al.",
    url: "https://www.amazon.co.uk/s?k=Cracking+Intercollegiate+General+Surgery+FRCS+Viva",
    description: "Essential for Section 2. Teaches you how to structure and deliver concise, examiner-friendly viva answers. Not a knowledge textbook \u2014 it\u2019s about technique.",
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
  },
];

const traumaBooks: TextbookResource[] = [
  {
    title: "Top Knife: The Art & Craft of Trauma Surgery",
    authors: "Hirshberg & Mattox",
    url: "https://www.amazon.co.uk/s?k=Top+Knife+Hirshberg+Mattox",
    description: "Practical, readable, opinionated. Covers operative trauma surgery in a way standard textbooks don\u2019t. Widely recommended by trainees.",
  },
  {
    title: "Trauma: Code Red",
    authors: "Khan & McMonagle",
    url: "https://www.amazon.co.uk/s?k=Trauma+Code+Red+Khan+McMonagle",
    description: "Companion to the RCSEng DSTS course. Focused on massive haemorrhage control and damage control surgery.",
  },
  {
    title: "Hamilton Bailey\u2019s Emergency Surgery",
    authors: "English & Pearce (15th Ed., 2025)",
    url: "https://www.amazon.co.uk/s?k=Hamilton+Bailey+Emergency+Surgery",
    description: "Updated edition of a classic. Covers the breadth of emergency surgery including trauma.",
  },
];

const referenceTexts: TextbookResource[] = [
  {
    title: "Bailey & Love\u2019s Short Practice of Surgery",
    authors: "",
    url: "https://www.amazon.co.uk/s?k=Bailey+and+Love+Short+Practice+of+Surgery",
    description: "The standard UK surgical textbook. Good for foundational concepts and breadth. Keep on the shelf \u2014 don\u2019t read cover-to-cover for the FRCS.",
  },
  {
    title: "Sabiston Textbook of Surgery",
    authors: "",
    url: "https://www.amazon.co.uk/s?k=Sabiston+Textbook+of+Surgery",
    description: "Comprehensive US reference. Strong on pathophysiology and surgical science. Same US/UK guideline caveat applies.",
  },
  {
    title: "Mastery of Surgery",
    authors: "Fischer / Ellison",
    url: "https://www.amazon.co.uk/s?k=Mastery+of+Surgery+Fischer",
    description: "Two-volume operative manual. Useful when you need step-by-step procedure descriptions for viva preparation around operative technique.",
  },
];

const getPerformanceColor = (pct: number) => {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 50) return "text-gold";
  return "text-destructive";
};

const getProgressColor = (pct: number) => {
  if (pct >= 70) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-gold";
  return "[&>div]:bg-destructive";
};

// ─── Resource Card Components ─────────────────────

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

function TextbookCard({ book }: { book: TextbookResource }) {
  return (
    <Card className="border h-full transition-shadow hover:shadow-md">
      <CardContent className="p-5 flex flex-col h-full">
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
      </CardContent>
    </Card>
  );
}

// ─── Histogram Component ───────────────────────────
function ScoreHistogram({ distribution, userScore }: { distribution: ScoreBucket[]; userScore: number }) {
  const allBuckets = useMemo(() => {
    const buckets = [];
    for (let i = 0; i <= 90; i += 10) {
      const existing = distribution.find(d => d.bucket === i);
      buckets.push({ bucket: i, count: existing?.count || 0 });
    }
    return buckets;
  }, [distribution]);

  const maxCount = Math.max(...allBuckets.map(b => b.count), 1);
  const totalUsers = allBuckets.reduce((sum, b) => sum + b.count, 0);

  const usersBelow = allBuckets
    .filter(b => b.bucket < Math.floor(userScore / 10) * 10)
    .reduce((sum, b) => sum + b.count, 0);
  const percentile = totalUsers > 0 ? Math.round(((usersBelow + 0.5) / totalUsers) * 100) : 0;
  const topPercent = Math.max(1, 100 - percentile);

  const userBucket = Math.min(Math.floor(userScore / 10) * 10, 90);
  const bucketLabels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];

  if (totalUsers < 2) return null;

  return (
    <Card className="border overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center">
              <Users size={16} className="text-navy" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">How You Compare</h2>
              <p className="text-xs text-muted-foreground">{totalUsers} members with 10+ questions</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20">
              <Trophy size={13} className="text-gold" />
              <span className="text-sm font-bold text-gold">Top {topPercent}%</span>
            </div>
          </div>
        </div>

        {/* Chart area */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-end gap-2 h-52">
            {allBuckets.map((bucket) => {
              const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
              const isUserBucket = bucket.bucket === userBucket;
              const isAboveAverage = bucket.bucket >= 70;

              return (
                <div key={bucket.bucket} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-navy text-navy-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
                      {bucket.count} member{bucket.count !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* "You" indicator */}
                  {isUserBucket && (
                    <div className="flex flex-col items-center mb-1">
                      <span className="text-[10px] font-bold text-gold tracking-wide uppercase">You</span>
                      <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-gold" />
                    </div>
                  )}

                  {/* Count above bar */}
                  {bucket.count > 0 && !isUserBucket && (
                    <span className="text-[10px] font-semibold text-muted-foreground/60 mb-1">{bucket.count}</span>
                  )}
                  {isUserBucket && bucket.count > 0 && (
                    <span className="text-[10px] font-bold text-gold mb-1">{bucket.count}</span>
                  )}

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-lg transition-all duration-700 ease-out cursor-pointer group-hover:opacity-90 ${
                      isUserBucket
                        ? 'bg-gradient-to-t from-gold to-gold/80 shadow-lg shadow-gold/25 ring-2 ring-gold/30'
                        : isAboveAverage
                          ? 'bg-gradient-to-t from-navy to-navy/80'
                          : 'bg-gradient-to-t from-navy/30 to-navy/15'
                    }`}
                    style={{
                      height: `${Math.max(height, bucket.count > 0 ? 6 : 0)}%`,
                      minHeight: bucket.count > 0 ? '6px' : '0px',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis */}
          <div className="flex gap-2 mt-2 border-t border-border pt-2">
            {bucketLabels.map((label, i) => (
              <div key={label} className="flex-1 text-center">
                <span className={`text-[9px] leading-none ${
                  allBuckets[i]?.bucket === userBucket
                    ? 'text-gold font-bold text-[10px]'
                    : 'text-muted-foreground font-medium'
                }`}>
                  {label}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend footer */}
        <div className="flex items-center justify-center gap-6 px-6 py-4 bg-muted/20 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-gold to-gold/80 ring-1 ring-gold/30" />
            <span className="text-[11px] text-muted-foreground font-medium">Your score ({userScore}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-navy to-navy/80" />
            <span className="text-[11px] text-muted-foreground font-medium">≥70% pass zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-navy/30 to-navy/15" />
            <span className="text-[11px] text-muted-foreground font-medium">&lt;70%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────
const FRCSResources = () => {
  const { user, profile } = useAuth();
  const trialExpired = isQuestionBankTrialExpired(profile);
  const daysRemaining = getTrialDaysRemaining(profile);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function fetchData() {
      const supabase = createClient();

      const [statsRes, questionsCountRes, topicsRes, attemptsRes, distributionRes] = await Promise.all([
        supabase.from('user_question_stats').select('*').eq('user_id', user!.id).single(),
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'published').eq('is_active', true),
        supabase.from('question_topics').select('id, name, category').order('sort_order'),
        supabase.from('question_attempts').select('question_id, is_correct, questions!inner(topic_id)').eq('user_id', user!.id),
        supabase.rpc('get_score_distribution'),
      ]);

      if (statsRes.data) setUserStats(statsRes.data);
      if (questionsCountRes.count) setQuestionCount(questionsCountRes.count);
      if (distributionRes.data) setScoreDistribution(distributionRes.data);

      if (topicsRes.data && attemptsRes.data) {
        const topicMap = new Map<string, { name: string; category: string; attempted: number; correct: number }>();

        topicsRes.data.forEach((t: any) => {
          topicMap.set(t.id, { name: t.name, category: t.category || 'Other', attempted: 0, correct: 0 });
        });

        attemptsRes.data.forEach((a: any) => {
          const topicId = (a.questions as any)?.topic_id;
          if (topicId && topicMap.has(topicId)) {
            const entry = topicMap.get(topicId)!;
            entry.attempted++;
            if (a.is_correct) entry.correct++;
          }
        });

        const performance: TopicPerformance[] = [];
        topicMap.forEach((val, key) => {
          if (val.attempted > 0) {
            performance.push({
              topic_id: key,
              topic_name: val.name,
              category: val.category,
              attempted: val.attempted,
              correct: val.correct,
              percentage: Math.round((val.correct / val.attempted) * 100),
            });
          }
        });

        setTopicPerformance(performance);
      }

      setLoading(false);
    }

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  const overallPct = userStats?.overall_percentage || 0;
  const totalAttempted = userStats?.total_attempted || 0;
  const streakDays = userStats?.current_streak_days || 0;
  const categories = ["Colorectal", "General Surgery", "Foundations"] as const;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">FRCS Resources</h1>
        <p className="text-muted-foreground mt-1">Everything you need for exam preparation</p>
      </div>

      {/* Stats Banner */}
      {totalAttempted > 0 && (
        <Card className="border">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-2">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="6"
                      strokeDasharray={`${overallPct * 2.136} 213.6`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">
                    {overallPct}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Overall</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <Target size={20} className="text-primary mb-1" />
                <p className="text-2xl font-bold text-foreground">{totalAttempted}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Attempted</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <Flame size={20} className="text-gold mb-1" />
                <p className="text-2xl font-bold text-foreground">{streakDays}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Day Streak</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <Trophy size={20} className="text-gold mb-1" />
                <p className="text-2xl font-bold text-foreground">{userStats?.best_exam_percentage || 0}%</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Best Exam</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Distribution Histogram */}
      {totalAttempted >= 10 && scoreDistribution.length > 0 && (
        <ScoreHistogram distribution={scoreDistribution} userScore={overallPct} />
      )}

      {/* Trial banner */}
      {daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <Clock size={16} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span> remaining on your question bank trial.{' '}
            <a href="/members/profile" className="text-amber-900 underline font-medium">Add your ACPGBI number</a> for unlimited access.
          </p>
        </div>
      )}

      {/* Question Bank Card */}
      {(() => {
        const isQBankLocked = trialExpired;
        return (
          <Link href={isQBankLocked ? "/members/profile" : "/members/questions"}>
            <Card className={`border transition-shadow ${isQBankLocked ? "opacity-80" : "hover:shadow-md cursor-pointer"}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center">
                    {isQBankLocked ? (
                      <Lock size={20} className="text-muted-foreground" />
                    ) : (
                      <FileText size={20} className="text-navy" />
                    )}
                  </div>
                  {isQBankLocked ? (
                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800">Trial Ended</Badge>
                  ) : (
                    <Badge className="text-[10px]">{questionCount}+ Qs</Badge>
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground">Dukes&apos; Club Question Bank</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Practice MCQs with instant feedback or sit a timed exam simulation.
                </p>
                {isQBankLocked && (
                  <p className="text-xs text-amber-700 mt-3">
                    <span className="underline font-medium">Add your ACPGBI number</span> to regain access
                  </p>
                )}
                {!isQBankLocked && (
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-3 hover:underline">
                    Go to Question Bank <ChevronRight size={14} />
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })()}

      {/* ─── Revision Resources Guide ─────────────────── */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-gradient-to-br from-navy to-navy/90 p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-navy-foreground">
            FRCS General Surgery: Revision Resources
          </h2>
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
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                          <Mic size={18} className="text-navy" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground leading-tight">{pod.title}</h3>
                      </div>
                      {pod.highlight && (
                        <Badge className="text-[10px] bg-gold/15 text-gold border-gold/30 shrink-0 ml-2" variant="outline">
                          <Star size={10} className="mr-1" /> Recommended
                        </Badge>
                      )}
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
              <div className="grid sm:grid-cols-2 gap-4">
                {sbaVivaBooks.map((b) => (
                  <TextbookCard key={b.title} book={b} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">The Companion Series</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {companionSeries.map((b) => (
                  <TextbookCard key={b.title} book={b} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trauma</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {traumaBooks.map((b) => (
                  <TextbookCard key={b.title} book={b} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Reference Texts</h3>
              <div className="grid sm:grid-cols-2 gap-4">
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

      {/* Topic Performance */}
      {topicPerformance.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Topic Performance</h2>
          </div>
          {categories.map((category) => {
            const topics = topicPerformance.filter((t) => t.category === category);
            if (topics.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{category}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topics.map((topic) => (
                    <Card key={topic.topic_id} className="border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{topic.topic_name}</span>
                          <span className={`text-sm font-bold ${getPerformanceColor(topic.percentage)}`}>
                            {topic.percentage}%
                          </span>
                        </div>
                        <Progress value={topic.percentage} className={`h-2 ${getProgressColor(topic.percentage)}`} />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {topic.correct}/{topic.attempted} correct
                          </span>
                          <Link
                            href="/members/questions"
                            className="text-[11px] text-primary font-medium hover:underline flex items-center gap-0.5"
                          >
                            Practice <ArrowRight size={10} />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {topicPerformance.length === 0 && totalAttempted === 0 && (
        <Card className="border">
          <CardContent className="p-8 text-center">
            <Target size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-semibold text-foreground">No questions attempted yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Start practising to see your topic performance breakdown
            </p>
            <Link href="/members/questions">
              <button className="px-4 py-2 bg-gold text-gold-foreground rounded-lg text-sm font-semibold hover:bg-gold/90">
                Start Practising
              </button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FRCSResources;