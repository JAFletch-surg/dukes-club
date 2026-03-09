'use client'
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useScrollAnimation } from "@/hooks/use-scroll-animation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Layers, CheckSquare, Search, Settings, Info, Users,
  ChevronDown, ExternalLink, Lock, Play, Calendar,
  MapPin, PoundSterling, ArrowRight, BookOpen, MessageCircle,
  Globe, FileText, AlertCircle, CheckCircle,
} from "lucide-react"

/* ─── Animated wrapper ─── */
const AnimatedSection = ({
  children, className, delay = 0,
}: {
  children: React.ReactNode; className?: string; delay?: number
}) => {
  const { ref, isVisible } = useScrollAnimation(0.07)
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
  )
}

/* ─── Eyebrow label ─── */
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3">
    {children}
  </p>
)

/* ─── Gold bullet list (dark bg) ─── */
const GoldBulletList = ({ items, className }: { items: string[]; className?: string }) => (
  <ul className={cn("space-y-2.5", className)}>
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5">
        <span className="w-[5px] h-[5px] rounded-full bg-gold shrink-0 mt-[7px]" />
        <span className="font-sans text-[0.86rem] text-navy-foreground/80 leading-relaxed">{item}</span>
      </li>
    ))}
  </ul>
)

/* ─── Gold bullet list (light bg) ─── */
const GoldBulletListLight = ({ items, className }: { items: React.ReactNode[]; className?: string }) => (
  <ul className={cn("space-y-1", className)}>
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5 py-[5px] border-b border-border/50 last:border-b-0">
        <span className="w-[5px] h-[5px] rounded-full bg-gold shrink-0 mt-[7px]" />
        <span className="font-sans text-[0.79rem] text-foreground/80 leading-relaxed">{item}</span>
      </li>
    ))}
  </ul>
)

/* ═══════════════════════════════════
   DATA
═══════════════════════════════════ */

const jumpCards = [
  { label: "FRCS Examination", sub: "Section 1 & Section 2", href: "#frcs", icon: Layers },
  { label: "CCT Checklist", sub: "Colorectal requirements", href: "#cct", icon: CheckSquare },
  { label: "JAG Colonoscopy", sub: "Certification pathway", href: "#endoscopy", icon: Search },
  { label: "Robotic Surgery", sub: "Skills & credentialling", href: "#robotic", icon: Settings },
  { label: "Exam Tips", sub: "Advice from consultants", href: "#tips", icon: Info },
  { label: "Fellowship Directory", sub: "Find & filter programmes", href: "/members/fellowship-directory", icon: Search },
  { label: "Member Network", sub: "Consultants & trainees", href: "#community", icon: Users },
]

const stages = [
  { label: "ST3–4 · Core", msg: "Focus: MRCS consolidation, first endoscopy lists on JETS, building your operative logbook. Start thinking about FRCS Section 1 timing early." },
  { label: "ST5–6 · Middle", msg: "Focus: FRCS Section 1 preparation (SBAs), increasing operative complexity, colonoscopy numbers building toward 280." },
  { label: "ST7–8 · Senior", msg: "Focus: FRCS Section 2 viva preparation, JAG colonoscopy sign-off, subspecialty exposure, robotic credentialling, fellowship applications." },
  { label: "Fellow / Post-CCT", msg: "Focus: Advanced therapeutic endoscopy, robotic programme leadership, JAG trainer status, consultant interview preparation." },
]

const examTips = [
  { num: "01", title: "Start Section 1 revision at ST5", text: "Don't wait until you're eligible to sit. Build SBA practice into your weekly routine from ST5 onwards — the broad curriculum takes time to cover and familiarity with question style matters as much as raw knowledge." },
  { num: "02", title: "Be broad, not deep", text: "The single biggest mistake candidates make is going too deep on colorectal and neglecting the rest of the syllabus. Section 1 will test you on vascular surgery, parotid and submandibular gland disease, bariatric, endocrine, transplant, and trauma — in exactly the same proportion as colorectal. A solid pass across everything beats a perfect score in one area." },
  { num: "03", title: "Read the syllabus — all of it", text: "Download the JCIE General Surgery syllabus and read every line. Candidates are caught out every sitting by topics they assumed wouldn't come up. Pay particular attention to less obvious entries — salivary glands, detailed vascular surgery, bariatric physiology, renal transplant." },
  { num: "04", title: "Read Colorectal Disease cover to cover", text: "For Section 2 vivas with a colorectal special interest, the ACPGBI / BSG journal Colorectal Disease is essential reading. Aim for the last 2–3 years of issues, focusing on original articles and review papers on high-yield topics." },
  { num: "05", title: "Do question banks relentlessly", text: "SBA technique is a learnable skill. Doing hundreds of questions teaches you how to read stems, spot distractors, and manage time. Aim for at least 2,000 questions across multiple banks before sitting Section 1 — and review the explanations for every wrong answer, not just the score." },
  { num: "06", title: "Know your guidelines cold", text: "NICE, ACPGBI, ESCP, ERAS, and BSG guidelines are fair game at both sections. High-yield areas: rectal cancer (MRI staging, TNT, watch-and-wait), IBD, diverticular disease, bowel obstruction, acute pancreatitis, and upper GI bleeding." },
  { num: "07", title: "Viva in pairs from day one of Section 2 prep", text: "Start mock vivas as soon as Section 1 is done — don't wait. A daily viva with a revision partner, even 20 minutes on the ward, builds the structured thinking pattern that examiners are looking for." },
  { num: "08", title: "Attend a dedicated viva prep course", text: "A focused mock viva course 4–6 weeks before Section 2 is invaluable for calibrating your performance against the pass standard. Check the events page for Dukes'-endorsed courses." },
]

/* ─── Recommended resources ─── */
const resourceCategories = [
  {
    label: "Question Banks — Section 1",
    items: [
      { title: "Higher FRCS", href: "https://higherfrcs.co.uk", desc: "The most widely used Section 1 bank among UK trainees. 1,500+ SBAs written by surgeons to the JCIE question-writing guidelines, mapped to the syllabus. Includes guideline summaries, timed mock tests, and performance tracker.", price: "higherfrcs.co.uk · £99 / 1 month · £109 / 3 months · £139 / 6 months" },
      { title: "eFRCS", href: "https://www.efrcs.com", desc: "1,000 SBAs aligned closely to the FRCS syllabus. Revision notes accompany every question. Includes a daily-updated histogram showing your score relative to other active candidates. Best value platform.", price: "efrcs.com · ~£35 / 4 months · Best value" },
      { title: "BMJ OnExamination", href: "https://www.onexamination.com/products/frcs-general-surgery", desc: "Large bank of SBAs curated by the BMJ editorial team, not divided into sub-specialties — genuine exam feel. Offline mobile app. Many NHS hospital libraries hold institutional licences — check before paying.", price: "onexamination.com · ~£72 / 3 months · Check your NHS library first" },
      { title: "FRCS Companion", href: "https://www.frcscompanion.com", desc: "750+ SBAs written by the textbook authors, closely approximating the real exam. Notably includes high-quality CT scans and skin lesion images. Smaller but very high quality-per-question.", price: "frcscompanion.com · Pricing on site" },
      { title: "Surgery Online FRCS", href: "https://www.surgeryonlinefrcs.com", desc: "The only platform covering all three stages: 393 Section 1 SBAs, 267 Section 2 viva questions with model answers, and 82 consultant interview questions.", price: "surgeryonlinefrcs.com · S1: £45–60 / 30–90 days" },
    ],
  },
  {
    label: "Podcasts",
    items: [
      { title: "Behind the Knife", href: "https://behindtheknife.org", desc: "The world's most popular surgery podcast. The ABSITE review series gives a high-yield overview of every major surgical topic. Clinical Challenges episodes are perfect for Section 2 viva prep.", price: "behindtheknife.org · Free" },
      { title: "First Incision", href: "https://open.spotify.com/show/0eUiOazl5oIxH1Y9ivgXbP", desc: "Australian trainee-led podcast covering the FRACS general surgery exam curriculum — content maps closely to the FRCS. Series 4 (colorectal) is particularly strong.", price: "Spotify · Free" },
    ],
  },
  {
    label: "Key Textbooks",
    items: [
      { title: "Colorectal Surgery — Oxford Handbook (Phillips / Clark)", href: "https://academic.oup.com/book/35846", desc: "Written as a revision tool for FRCS candidates with a colorectal special interest, mapped directly to the ACPGBI/ISCP curriculum. The closest single-source colorectal FRCS book.", price: "Oxford University Press · Paid" },
      { title: "Colorectal Disease Journal (Wiley / ACPGBI)", desc: "The official journal of the ACPGBI. Essential reading for Section 2 viva preparation. Focus on the last 2–3 years: landmark trials, systematic reviews, and ACPGBI position statements.", price: "Wiley · Institutional access / OpenAthens" },
      { title: "SBAs & EMIs for the General Surgery FRCS — \"The Blue Book\"", desc: "The most widely used Section 1 question book among UK trainees. Challenging questions with good breadth. Best used alongside an online bank.", price: "CRC Press · Paid" },
    ],
  },
  {
    label: "Section 2 Viva Courses",
    items: [
      { title: "ACPGBI FRCS Revision Day", href: "https://www.acpgbi.org.uk/education/courses/", desc: "One-day course covering the full Section 2 syllabus through structured lectures by consultant faculty. Excellent for identifying knowledge gaps 6–8 weeks before the exam.", price: "acpgbi.org.uk · Paid" },
      { title: "RSM FRCS Section 2 Revision Day", href: "https://www.rsm.ac.uk/sections/surgery/", desc: "Annual Section 2 revision day run by experienced FRCS examiners including St Mark's Hospital faculty. CPD accredited.", price: "rsm.ac.uk · Paid" },
      { title: "The Alpine Course", desc: "Dedicated mock viva course with small-group sessions led by consultant examiners. Particularly strong for sharpening viva delivery and structure under exam conditions.", price: "Search \"Alpine FRCS course\" · Paid" },
    ],
  },
  {
    label: "Official Curriculum & Exam Resources",
    items: [
      { title: "JCIE — Exam information & syllabus", href: "https://www.jcie.org.uk/general-surgery", desc: "The primary source for everything FRCS: syllabus documents, exam regulations, eligibility criteria, and blueprints. Download the current syllabus and read it in full.", price: "jcie.org.uk · Free" },
      { title: "ISCP General Surgery Curriculum", href: "https://www.iscp.ac.uk/iscp/curriculum/general-surgery-curriculum/", desc: "The 2021 ISCP curriculum defines every CiP, index procedure, indicative number, and assessment requirement. Essential reading for ARCP preparation.", price: "iscp.ac.uk · Free" },
    ],
  },
]

/* ─── CCT Data ─── */
const cctPhase2 = {
  operativeNumbers: [
    { procedure: "Appendicectomy", min: "60" },
    { procedure: "Inguinal hernia", min: "50" },
    { procedure: "Emergency laparotomy", min: "45" },
    { procedure: "Cholecystectomy", min: "40" },
    { procedure: "Segmental colectomy", min: "15" },
  ],
  pbaRequirements: [
    { procedure: "Hernia repair (all types)", standard: "3 × Level 4 PBA" },
    { procedure: "Cholecystectomy (lap or open)", standard: "3 × Level 3 PBA" },
    { procedure: "Segmental colectomy", standard: "3 × Level 3 PBA" },
  ],
  cips: [
    { cap: "Outpatient clinic", level: "Level III — independent" },
    { cap: "Emergency surgical take", level: "Level III — independent" },
    { cap: "Ward rounds & inpatient care", level: "Level III — independent" },
    { cap: "Operating list", level: "Level IIb — supervisor present for part of list" },
    { cap: "MDT working", level: "Level III — independent" },
  ],
}

const cctPhase3 = {
  egsNumbers: [
    { procedure: "Emergency laparotomy", min: "100", pba: "3 × Level 4" },
    { procedure: "Appendicectomy", min: "80", pba: "3 × Level 4" },
    { procedure: "Cholecystectomy*", min: "50", pba: "3 × Level 4" },
    { procedure: "Segmental colectomy*", min: "20", pba: "3 × Level 4" },
    { procedure: "Hartmann's procedure", min: "—", pba: "3 × Level 4" },
  ],
  colorectalNumbers: [
    { procedure: "Segmental colectomy (some laparoscopic)", min: "50", pba: "3 × Level 4" },
    { procedure: "Anterior resection (high)", min: "30", pba: "3 × Level 4" },
    { procedure: "Fistula surgery", min: "20", pba: "3 × Level 4" },
    { procedure: "Haemorrhoidectomy", min: "15", pba: "3 × Level 4" },
    { procedure: "Colonoscopy", min: "200", pba: "JAG certification" },
  ],
  cips: [
    { cap: "Outpatient clinic", level: "Level IV — Day-1 consultant" },
    { cap: "Emergency surgical take", level: "Level IV — Day-1 consultant" },
    { cap: "Ward rounds & inpatient care", level: "Level IV — Day-1 consultant" },
    { cap: "Operating list", level: "Level IV — Day-1 consultant" },
    { cap: "MDT working", level: "Level IV — Day-1 consultant" },
  ],
  egsConditions: ["Acute abdomen", "Strangulated / obstructed hernia", "Intestinal ischaemia", "Intestinal obstruction", "Post-operative haemorrhage", "Acute GI haemorrhage", "Perforated viscus", "Abdominal trauma", "Necrotising fasciitis", "Sepsis", "Anastomotic leak"],
  colorectalConditions: ["Acute colitis / toxic megacolon", "Faecal peritonitis", "Biliary sepsis", "Acute pancreatitis", "Oesophageal perforation", "Upper GI anastomotic leak", "Ruptured AAA", "Acute limb ischaemia", "Compartment syndrome"],
}

const cctPortfolio = {
  wpba: [
    "MCRs — 2 per 6-month placement (mid-point formative + end summative), ≥2 consultant assessors",
    "AES report — end of each placement",
    "PBAs — must show progression across different assessors and time; no bunching before ARCP",
    "Case-Based Discussions (CbDs)",
    "Clinical Evaluation Exercises (CEX)",
    "DOPS for procedural skills",
    "Multi-Source Feedback (MSF) — annually",
    "Elogbook — all cases logged contemporaneously",
  ],
  research: [
    "Evidence-based practice in clinical work",
    "Critical appraisal of literature",
    "Understanding of basic research principles",
    "Research governance & ethics",
  ],
  researchOutputs: [
    "Peer-reviewed publications (first / second / last author, or corporate category A)",
    "International or national conference presentations",
    "NIHR Associate PI scheme",
    "Recruitment to NIHR portfolio RCT (>5 patients) or REC-approved prospective study (>10)",
    "GCP certification (within 3 years)",
  ],
  qi: ["≥3 QI projects / audits with portfolio evidence", "At least one completed audit cycle"],
  education: ["Training the Trainers course (or equivalent)", "Evidence of educational theory in practice", "Structured feedback from a delivered teaching session"],
  leadership: ["Management / leadership course", "Evidence of management theory in practice", "Management activity (e.g. committee role, service improvement)"],
  mandatory: [
    "ATLS / ETS / DSTS — current certification",
    "Subspecialty-specific courses",
    "≥4 national / international conference attendances evidenced in portfolio",
    "FRCS (General Surgery) passed — ISB examination confirmed",
    "All 5 CiPs at Level IV — evidenced in MCR",
  ],
}

/* ─── JAG Data ─── */
const jagReqs = [
  { label: "Minimum colonoscopies", val: "280", unit: "200 if already FS certified" },
  { label: "Unassisted caecal intubation", val: ">90%", unit: "averaged over 3 months" },
  { label: "Polyp detection rate", val: ">15%", unit: "BSG standard" },
  { label: "Recent activity required", val: "15+", unit: "procedures in last 3 months" },
  { label: "Summative DOPS required", val: "4", unit: "by 2 different assessors" },
  { label: "Polypectomy assessment", val: "SMSA", unit: "Level 1 & 2 DOPyS required" },
]

const jagSteps = [
  { title: "Register on JETS immediately", desc: "Log every colonoscopy from your very first list. Procedures performed before JETS registration cannot be counted retroactively. Set up your account at jets.nhs.uk at the start of each new rotation." },
  { title: "Attend the JAG Basic Skills in Colonoscopy course", desc: "Mandatory attendance at a JAG-approved Basic Skills course. Can be completed at simulation centres or dedicated endoscopy training units. Book early — places fill quickly." },
  { title: "Complete formative DOPS throughout training", desc: "Aim for a DOPS on every training list. The last 5 formative DOPS before summative assessment must all score competent without supervision in >90% of items." },
  { title: "Complete DOPyS for polypectomy (SMSA Level 1 & 2)", desc: "DOPyS is the polypectomy-specific DOPS. You need competency at SMSA Level 1 (small polyps) and Level 2 (larger / more complex). Log a DOPyS for every polypectomy." },
  { title: "Trigger summative DOPS assessment", desc: "Once you meet the KPI thresholds, procedure count, and course attendance, apply for summative assessment. 4 summative DOPS — by a minimum of 2 different assessors — all within one month." },
  { title: "Training Lead and JETS national sign-off", desc: "Your portfolio is reviewed by your local Training Lead, then submitted for JETS national review. Certificate issued by JAG on successful completion." },
]

const jagKpis = [
  { val: ">90%", label: "Caecal intubation rate (unassisted)" },
  { val: ">90%", label: "Rectal retroflexion" },
  { val: ">15%", label: "Polyp detection rate" },
  { val: ">90%", label: "Polyp retrieval rate" },
  { val: "<10%", label: "Moderate / severe patient pain" },
  { val: ">60%", label: "Terminal ileal intubation (IBD suspected)" },
]

const endoTips = [
  "Meet the endoscopy lead on your first day of every new rotation",
  "Request your own endoscopy training list, not just supervised lists",
  "Raise endoscopy access issues at ARCP — it is not logged on ISCP so panels can overlook it",
  "Don't aim for provisional certification as the endpoint — push through to full (280 procedures)",
  "If your unit can't provide enough lists, contact your TPD — trusts can be flagged for training deficiencies",
]

const endoVideos = [
  { tag: "Scope Handling", title: "Scope handling, torque, and tip deflection", desc: "Grip technique, clockwise and counter-clockwise torque, up/down and left/right tip control.", meta: "JAG Domain 1 · DOPS item 1–3", duration: "18:42" },
  { tag: "Patient Preparation", title: "Patient positioning and pre-procedure check", desc: "Left lateral positioning, consent confirmation, equipment check, and sedation pathway.", meta: "JAG Domain 2 · DOPS item 4–6", duration: "12:15" },
  { tag: "Insertion & Navigation", title: "Colonoscope insertion and basic navigation", desc: "Anal canal insertion, rectal retroflexion, sigmoid loop reduction, and splenic flexure negotiation.", meta: "JAG Domain 3 · DOPS item 7–10", duration: "24:33" },
  { tag: "Caecal Intubation", title: "Achieving caecal intubation — tips and troubleshooting", desc: "Hepatic flexure technique, position changes, abdominal pressure, and confirming caecal landmarks.", meta: "JAG Domain 3 · DOPS item 11–12", duration: "19:08" },
]

/* ─── Robotic Data ─── */
const roboticStats = [
  { val: "200+", label: "da Vinci systems in UK hospitals" },
  { val: "300k+", label: "UK & Ireland patients treated robotically" },
  { val: "500k", label: "operations/year projected by 2035" },
  { val: "90%", label: "of keyhole cancer ops robotic within 10 yrs" },
]

const roboticPlatforms = [
  { name: "da Vinci", maker: "Intuitive Surgical", tag: "Dominant UK platform", dominant: true, items: ["Xi, X, SP & da Vinci 5 systems", "New UK HQ & training centre, Reading (Oct 2025)", "RCSEng-accredited training programme", "TR100 → TR200 → TR300 → TR400 pathway"] },
  { name: "Versius", maker: "CMR Surgical · Cambridge, UK", tag: "Growing UK presence", dominant: false, items: ["Modular, portable design", "Increasingly used in colorectal & HPB", "UK-designed system with NHS expansion plans"] },
  { name: "Hugo RAS", maker: "Medtronic", tag: "Entering UK market", dominant: false, items: ["Open console, modular arm architecture", "CE Mark received; UK rollout underway", "Platform-agnostic training advocated by ACPGBI"] },
]

const roboticLevels = [
  { level: "Level 1", title: "Basic Robotic Course", subtitle: "For all trainees — from core surgical training onwards", items: ["Theoretical & anatomical robotic knowledge", "Platform-specific system training (online modules)", "Simulator access — VR tasks and basic surgical tasks", "Bedside assistance: cart docking, instrument loading", "Observation of live RACS cases at expert centres", "ACPGBI-accredited course delivered at selected UKI centres", "Dukes' Club coordinates course registration"], when: "Start: Core training / early ST3", active: false },
  { level: "Level 2", title: "Advanced Robotic Course", subtitle: "Component-based procedural training — ST6–8", items: ["Competency-based, step-wise procedure training", "Key operations: right hemicolectomy, anterior resection", "Objective measures of progress at each step", "Dry/wet lab and proctored live case components", "ACPGBI-accredited advanced course at selected UKI centres", "ACPGBI robotic fellowship portal: educational curricula & procedure videos", "ACPGBI industry-supported 6-month robotic fellowships at two expert UK centres"], when: "Target: ST6–8 · Fellowships ST7–8", active: true },
  { level: "Level 3", title: "Training the Trainers", subtitle: "Consultant-level trainer accreditation", items: ["For robotic-credentialled consultants who wish to train and proctor others", "Formal faculty development and educational methodology", "Typically industry-partnered through Intuitive, CMR or Medtronic", "Feeds back into the training ecosystem — proctoring and mentoring trainees at Level 2"], when: "Post-credentialling · Consultant", active: false },
]

const trPathway = [
  { phase: "Phase I", label: "Online only", title: "System Certification", pill: "pre" as const, items: ["Intuitive Learning online modules (da Vinci Xi / 5)", "Console certificate — completed before any hands-on work", "System anatomy: arms, instruments, vision tower, energy", "First test drive at regional robotic centre", "Case observation — bedside assistance & cart docking"] },
  { phase: "Phase II — TR100 / TR200", label: "2-day course · Intuitive Training Centre, Reading", title: "Basic Robotic Skills", pill: "pre" as const, items: ["TR100 — Technology training by Intuitive trainer: port placement, docking, instrument loading, energy safe use, skills drills", "TR200 — Surgeon-led procedural training on cadaveric / porcine / synthetic model", "VR simulator: minimum 25–30 hours recommended before Phase III"] },
  { phase: "Phase III — TR300", label: "Proctored live surgery", title: "Initial Case Series", pill: "clin" as const, items: ["10 bedside-assisted cases before console access", "Proctored console cases — component-based progression", "Objective robotic skills assessment (GEARS, procedure-specific metrics)", "Proctor ideally same surgeon from TR200", "Case log on ISCP with robotic-specific operative codes"] },
  { phase: "Phase IV — TR400", label: "Independent practice", title: "Credentialling & Mastery", pill: "clin" as const, items: ["20 console cases (≥50% operative time as primary surgeon)", "Intuitive Certificate of Equivalency on completion", "RCSEng credentialling via good practice guide", "Progression to complex cases (low AR, total mesorectal excision)", "Eligible to proctor others once mastery demonstrated"] },
]

/* ─── Community features ─── */
const communityFeatures = [
  { icon: Users, label: "Trainee & Consultant Network", desc: "Connect directly with consultants across all 17 NHS England deaneries, plus Wales, Scotland, Northern Ireland, and Republic of Ireland. Mentor matching, career advice, and peer support.", large: true },
  { icon: Globe, label: "Global Reach", desc: "An expanding international membership spanning North America, Australasia, and the Middle East — connecting UK-trained colorectal surgeons wherever they practise." },
  { icon: MessageCircle, label: "Discussion & Peer Support", desc: "Ask questions, share cases, and get practical advice from peers navigating the same milestones." },
  { icon: Calendar, label: "Events & Webinars", desc: "Members-only access to live webinars, virtual journal clubs, FRCS revision sessions, and the annual Dukes' Club meeting." },
  { icon: FileText, label: "Research Collaboration", desc: "Find co-investigators, recruit to multicentre audits, and connect with the ACPGBI research committee." },
]


/* ═══════════════════════════════════
   CCT TABLE COMPONENT
═══════════════════════════════════ */
const CCTCard = ({ tag, title, children, wide }: { tag: string; title: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={cn("rounded-lg border border-border overflow-hidden bg-card", wide && "md:col-span-2")}>
    <div className="bg-navy px-4 py-3">
      <p className="font-sans text-[0.63rem] font-bold uppercase tracking-wider text-gold mb-0.5">{tag}</p>
      <p className="font-sans text-[0.88rem] font-bold text-navy-foreground">{title}</p>
    </div>
    {children}
  </div>
)

const CCTTable = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <table className="w-full text-left font-sans text-[0.8rem]">
    <thead>
      <tr className="bg-background/60">
        {headers.map((h, i) => (
          <th key={i} className="px-4 py-2 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i} className="border-b border-border/40 last:border-b-0">
          {row.map((cell, j) => (
            <td key={j} className={cn("px-4 py-2.5 text-foreground/80", j === row.length - 1 && "font-bold text-navy")}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)

const CCTNote = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 py-2.5 text-[0.75rem] font-sans text-muted-foreground leading-relaxed border-t border-border bg-background/40">{children}</p>
)


/* ─── Types ─── */
interface ExamEvent {
  id: string
  title: string
  slug: string
  starts_at: string
  location: string | null
  event_type: string | null
  price_pence: number | null
  member_price_pence: number | null
}

/* ═══════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════ */
export default function ExamsPage() {
  const [activeStage, setActiveStage] = useState<number | null>(null)
  const [frcsTab, setFrcsTab] = useState<"s1" | "s2">("s1")
  const [cctTab, setCctTab] = useState<"p2" | "p3" | "portfolio">("p2")
  const [resourcesOpen, setResourcesOpen] = useState(false)

  /* ─── Supabase events (for the events strip) ─── */
  const [events, setEvents] = useState<ExamEvent[]>([])
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("events")
      .select("id, title, slug, starts_at, location, event_type, price_pence, member_price_pence")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(3)
      .then(({ data }: { data: ExamEvent[] | null }) => { if (data) setEvents(data) })
  }, [])

  const formatPrice = (pence: number | null) => {
    if (!pence || pence === 0) return "Free"
    return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
  }
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

  return (
    <div className="min-h-screen bg-background">

      {/* ════════════════ HERO ════════════════ */}
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
            Education &amp; Training
          </p>
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            Exams &amp; Training
          </h1>
          <p className="mt-4 text-navy-foreground/80 max-w-2xl text-base md:text-lg animate-fade-in">
            A structured guide to every milestone in colorectal surgical training — from FRCS preparation and JAG colonoscopy accreditation through to robotic surgery and life as a consultant.
          </p>
        </div>
      </section>

      {/* Jump navigation cards */}
      <section className="bg-navy border-t border-navy-foreground/10">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl">
            {jumpCards.map((card) => {
              const Icon = card.icon
              const isInternal = card.href.startsWith("/")
              const Comp = isInternal ? Link : "a"
              return (
                <Comp
                  key={card.label}
                  href={card.href}
                  className="flex items-center gap-3.5 bg-navy-foreground/[0.06] border border-navy-foreground/[0.16] rounded-lg px-4 py-3.5 hover:bg-gold/15 hover:border-gold/40 transition-all duration-200 hover:-translate-y-0.5 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-navy-foreground/[0.08] flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-bold text-[0.85rem] text-navy-foreground">{card.label}</p>
                    <p className="font-sans text-[0.72rem] text-navy-foreground/50 mt-0.5">{card.sub}</p>
                  </div>
                  <ArrowRight size={16} className="text-gold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Comp>
              )
            })}
          </div>
        </div>
      </section>

      {/* ════════════════ TRAINEE SELECTOR ════════════════ */}
      <section className="bg-card border-b border-border py-12">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <h3 className="font-sans font-bold text-foreground text-lg mb-4">Where are you in your training?</h3>
            <div className="flex flex-wrap gap-2.5">
              {stages.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStage(activeStage === i ? null : i)}
                  className={cn(
                    "px-5 py-2.5 rounded-full border-[1.5px] font-sans font-semibold text-[0.85rem] transition-all duration-200 cursor-pointer",
                    activeStage === i
                      ? "bg-navy text-navy-foreground border-navy"
                      : "bg-card text-foreground border-border hover:border-navy/50"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {activeStage !== null && (
              <div className="mt-4 px-4 py-3 bg-gold/10 border-l-[3px] border-gold rounded-r-md font-sans text-[0.87rem] text-foreground leading-relaxed">
                {stages[activeStage].msg}
              </div>
            )}
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════ STATS BAR ════════════════ */}
      <section className="bg-navy py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { n: "1,200+", l: "Members" },
              { n: "240 SBA", l: "Per section 1 paper" },
              { n: "280+", l: "Colonoscopies for JAG" },
              { n: "2", l: "Days — Section 2 exam" },
            ].map((s, i) => (
              <AnimatedSection key={i} delay={i * 80}>
                <p className="text-3xl md:text-4xl font-sans font-bold text-gold leading-none">{s.n}</p>
                <p className="font-mono text-[0.65rem] tracking-[0.1em] uppercase text-navy-foreground/50 mt-1.5">{s.l}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FRCS SECTION ════════════════ */}
      <section id="frcs" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <Eyebrow>Fellowship of the Royal Colleges · JCIE</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground leading-tight mb-3.5">FRCS General Surgery</h2>
            <p className="font-sans text-[0.93rem] text-muted-foreground max-w-xl leading-relaxed mb-10">
              The Intercollegiate Specialty Examination in General Surgery is administered by the JCIE and consists of two sections. Section 1 must be passed before sitting Section 2. Candidates have up to 4 attempts at each section.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="flex border-[1.5px] border-navy rounded-lg overflow-hidden w-fit mb-0.5 flex-wrap">
              <button
                onClick={() => setFrcsTab("s1")}
                className={cn("px-5 py-2.5 font-sans font-semibold text-[0.82rem] transition-all cursor-pointer border-r border-navy/20",
                  frcsTab === "s1" ? "bg-navy text-navy-foreground" : "bg-card text-foreground/70 hover:text-foreground"
                )}
              >Section 1 — Written</button>
              <button
                onClick={() => setFrcsTab("s2")}
                className={cn("px-5 py-2.5 font-sans font-semibold text-[0.82rem] transition-all cursor-pointer",
                  frcsTab === "s2" ? "bg-navy text-navy-foreground" : "bg-card text-foreground/70 hover:text-foreground"
                )}
              >Section 2 — Clinical &amp; Viva</button>
            </div>

            {frcsTab === "s1" && (
              <div className="bg-navy rounded-b-lg rounded-tr-lg p-6 md:p-8 grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-sans font-bold text-gold mb-1.5">Section 1</h3>
                  <p className="font-sans text-[0.82rem] text-navy-foreground/50 mb-1.5">Written examination · Computer-based</p>
                  <div className="font-sans text-[0.82rem] text-navy-foreground/70 leading-relaxed mb-5">
                    <p><strong className="text-navy-foreground/90">Paper 1:</strong> 120 Single Best Answer (SBA) questions · 2 hrs 15 min</p>
                    <p><strong className="text-navy-foreground/90">Paper 2:</strong> 120 Single Best Answer (SBA) questions · 2 hrs 15 min</p>
                    <p className="mt-3">Questions span the full General Surgery curriculum — colorectal, upper GI, breast, vascular, endocrine, HPB, emergency, critical care, and basic sciences.</p>
                  </div>
                  <Link href="/members/question-bank" className="inline-block bg-gold text-navy font-sans font-bold text-[0.8rem] px-5 py-2.5 rounded-md hover:opacity-85 transition-opacity">
                    Access Question Bank →
                  </Link>
                </div>
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-3.5">Dukes&apos; Club resources</p>
                  <GoldBulletList items={[
                    "800+ colorectal-weighted SBA question bank, mapped to JCIE curriculum",
                    "Revision wiki covering all general surgery subspecialties",
                    "High-yield topic summaries and guideline digests",
                    "Timed mock exam mode with performance analytics",
                    "Video lecture library — consultant-led topic reviews",
                  ]} />
                </div>
              </div>
            )}

            {frcsTab === "s2" && (
              <div className="bg-navy rounded-b-lg rounded-tr-lg p-6 md:p-8 grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-sans font-bold text-gold mb-1.5">Section 2</h3>
                  <p className="font-sans text-[0.82rem] text-navy-foreground/50 mb-1.5">Clinical &amp; Oral · Two-day examination</p>
                  <div className="font-sans text-[0.82rem] text-navy-foreground/70 leading-relaxed mb-5">
                    <p><strong className="text-navy-foreground/90">Day 1 — Clinical Vivas:</strong></p>
                    <p>General Surgery Clinical (2 × 10 min + 1 × 20 min)</p>
                    <p>Subspecialty Clinical (2 × 10 min + 1 × 20 min)</p>
                    <p className="mt-3"><strong className="text-navy-foreground/90">Day 2 — Oral Vivas:</strong></p>
                    <p>General Surgery, Emergency &amp; Critical Care, Academic &amp; Research station (with pre-read paper, 30 min review).</p>
                  </div>
                  <Link href="/members/viva-resources" className="inline-block bg-gold text-navy font-sans font-bold text-[0.8rem] px-5 py-2.5 rounded-md hover:opacity-85 transition-opacity">
                    Access Viva Resources →
                  </Link>
                </div>
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-3.5">Dukes&apos; Club resources</p>
                  <GoldBulletList items={[
                    "Colorectal viva scenario library with model structured answers",
                    "Academic viva preparation — paper critique frameworks & statistics",
                    "Clinical radiology and pathology image library",
                    "Mock viva events with consultant examiners",
                    "Subspecialty revision: colorectal, emergency, critical care",
                  ]} />
                </div>
              </div>
            )}
          </AnimatedSection>

          {/* Resource teasers */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 mt-8">
            {[
              { title: "SBA Question Bank", sub: "800+ questions", locked: true },
              { title: "Revision Wiki", sub: "Curriculum-mapped articles", locked: true },
              { title: "Viva Scenarios", sub: "Consultant-authored", locked: true },
              { title: "Video Lectures", sub: "47 recorded sessions", locked: true },
              { title: "Exam Guides", sub: "Free · No login required", locked: false },
            ].map((r, i) => (
              <AnimatedSection key={i} delay={i * 70}>
                <div className={cn(
                  "relative rounded-lg border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  r.locked ? "bg-card border-border" : "bg-card border-gold/40"
                )}>
                  {r.locked && (
                    <>
                      <span className="absolute top-2.5 right-2.5 bg-navy text-gold rounded-full px-2 py-0.5 font-mono text-[0.62rem] tracking-wider z-10">Members Only</span>
                      <div className="absolute inset-0 backdrop-blur-[2.5px] bg-white/25 rounded-lg pointer-events-none" />
                    </>
                  )}
                  <p className="font-sans font-bold text-foreground text-[0.9rem] mb-1">{r.title}</p>
                  <p className="font-sans text-[0.76rem] text-muted-foreground">{r.sub}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ EXAM TIPS ════════════════ */}
      <section id="tips" className="py-20 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <Eyebrow>Advice from those who&apos;ve been there</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground leading-tight mb-3.5">Exam Tips</h2>
            <p className="font-sans text-[0.93rem] text-muted-foreground max-w-xl leading-relaxed mb-10">
              Practical guidance gathered from Dukes&apos; Club members and consultant faculty who have recently passed or examined at FRCS level.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {examTips.map((tip, i) => (
              <AnimatedSection key={i} delay={(i % 4) * 70}>
                <div className="bg-background border border-border rounded-lg p-5 transition-all duration-200 hover:border-gold hover:-translate-y-0.5 hover:shadow-md h-full">
                  <p className="text-4xl font-sans font-bold text-primary leading-none mb-1">{tip.num}</p>
                  <p className="font-sans font-bold text-foreground text-[0.9rem] mb-2">{tip.title}</p>
                  <p className="font-sans text-[0.83rem] text-muted-foreground leading-relaxed">{tip.text}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          {/* Recommended resources dropdown */}
          <AnimatedSection delay={200} className="mt-14">
            <div className="bg-navy/70 border border-navy-foreground/20 rounded-lg overflow-hidden">
              <button
                onClick={() => setResourcesOpen(!resourcesOpen)}
                className="w-full flex items-center justify-between px-6 py-5 cursor-pointer hover:bg-navy-foreground/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <Layers size={20} className="text-gold" />
                  <span className="font-sans text-lg text-navy-foreground">Dukes&apos; Club Recommended Resources</span>
                </div>
                <ChevronDown size={18} className={cn("text-gold transition-transform duration-300", resourcesOpen && "rotate-180")} />
              </button>

              {resourcesOpen && (
                <div className="border-t border-navy-foreground/10 px-6 pb-7 space-y-9">
                  {resourceCategories.map((cat) => (
                    <div key={cat.label} className="pt-7">
                      <p className="font-sans text-[0.72rem] font-bold uppercase tracking-[0.1em] text-gold mb-3.5">{cat.label}</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {cat.items.map((item) => {
                          const inner = (
                            <>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-sans text-[0.85rem] font-bold text-white leading-tight">{item.title}</p>
                                {item.href && <ExternalLink size={13} className="text-gold shrink-0 mt-0.5" />}
                              </div>
                              <p className="font-sans text-[0.78rem] text-navy-foreground/70 leading-relaxed mb-2.5">{item.desc}</p>
                              <p className={cn("font-sans text-[0.68rem] font-semibold tracking-wide", item.price?.includes("£") ? "text-gold/70" : "text-navy-foreground/50")}>{item.price}</p>
                            </>
                          )
                          return item.href ? (
                            <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"
                              className="block bg-navy-foreground/[0.07] border border-navy-foreground/[0.18] rounded-lg px-4 py-3.5 hover:border-gold/40 hover:bg-navy-foreground/[0.11] transition-all">
                              {inner}
                            </a>
                          ) : (
                            <div key={item.title} className="bg-navy-foreground/[0.07] border border-navy-foreground/[0.18] rounded-lg px-4 py-3.5">
                              {inner}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════ CCT REQUIREMENTS ════════════════ */}
      <section id="cct" className="py-20 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <Eyebrow>ISCP General Surgery Curriculum 2021 · Colorectal Special Interest</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground leading-tight mb-3.5">CCT Requirements</h2>
            <p className="font-sans text-[0.93rem] text-muted-foreground max-w-xl leading-relaxed mb-8">
              CCT is awarded when you demonstrate Day-1 consultant level across all Capabilities in Practice (CiPs). The numbers below are <strong className="text-foreground">indicative minimums</strong> from the 2024 Manchester, Lancashire &amp; South Cumbria CCT checklist.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="flex flex-wrap gap-2 mb-6">
              {([
                { key: "p2" as const, label: "Phase 2", sub: "ST3–6 · End of phase" },
                { key: "p3" as const, label: "Phase 3", sub: "ST7–8 · CCT" },
                { key: "portfolio" as const, label: "Portfolio & Other", sub: "Both phases" },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setCctTab(t.key)}
                  className={cn(
                    "px-5 py-2.5 rounded-md border font-sans font-semibold text-[0.82rem] transition-all cursor-pointer flex items-center gap-2",
                    cctTab === t.key
                      ? "bg-navy text-navy-foreground border-navy"
                      : "bg-card text-muted-foreground border-border hover:border-navy hover:text-foreground"
                  )}
                >
                  {t.label}
                  <span className="font-normal text-[0.73rem] opacity-75">{t.sub}</span>
                </button>
              ))}
            </div>
          </AnimatedSection>

          {cctTab === "p2" && (
            <AnimatedSection>
              <div className="grid md:grid-cols-2 gap-4">
                <CCTCard tag="Elective & Emergency General Surgery" title="Indicative Operative Numbers — end of ST6">
                  <CCTTable headers={["Procedure", "Minimum"]} rows={cctPhase2.operativeNumbers.map(r => [r.procedure, r.min])} />
                </CCTCard>
                <CCTCard tag="Operative Competency — end of ST6" title="PBA Requirements (3 different assessors)">
                  <CCTTable headers={["Procedure", "Standard"]} rows={cctPhase2.pbaRequirements.map(r => [r.procedure, r.standard])} />
                  <CCTNote>PBA Level 4 = independent. Level 3 = performed with minimal assistance. All PBAs must be from three different assessors.</CCTNote>
                </CCTCard>
                <CCTCard tag="5 Capabilities in Practice (CiPs) — Level III by end of Phase 2" title="Supervision levels required at Phase 2 critical progression point" wide>
                  <CCTTable headers={["Capability", "Required Level"]} rows={cctPhase2.cips.map(r => [r.cap, r.level])} />
                  <CCTNote>The Phase 2 critical progression point (end of ST6) must be confirmed by ARCP before eligibility to sit FRCS Section 1 and Section 2.</CCTNote>
                </CCTCard>
              </div>
            </AnimatedSection>
          )}

          {cctTab === "p3" && (
            <AnimatedSection>
              <div className="grid md:grid-cols-2 gap-4">
                <CCTCard tag="Module 1 — Emergency General Surgery (mandatory)" title="EGS Indicative Numbers — by CCT">
                  <CCTTable headers={["Procedure", "Minimum", "PBA standard"]} rows={cctPhase3.egsNumbers.map(r => [r.procedure, r.min, r.pba])} />
                  <CCTNote>*May include elective cases carried over from Phase 2.</CCTNote>
                </CCTCard>
                <CCTCard tag="Module 2 — Colorectal Surgery" title="Colorectal Indicative Numbers — by CCT">
                  <CCTTable headers={["Procedure", "Minimum", "PBA standard"]} rows={cctPhase3.colorectalNumbers.map(r => [r.procedure, r.min, r.pba])} />
                  <CCTNote>JAG colonoscopy certification is not a formal CCT requirement but is expected by most colorectal consultant person specifications.</CCTNote>
                </CCTCard>
                <CCTCard tag="5 Capabilities in Practice — All must reach Level IV by CCT" title="Day-1 Consultant Standard">
                  <CCTTable headers={["Capability", "Required Level"]} rows={cctPhase3.cips.map(r => [r.cap, r.level])} />
                  <CCTNote>Evidenced via MCR from ≥2 consultants per 6-month placement. FRCS must be passed before CCT can be awarded.</CCTNote>
                </CCTCard>
                <CCTCard tag="Critical Conditions — PBA Level 4 required for all" title="Emergency Competencies">
                  <div className="grid grid-cols-2 gap-0">
                    <div>
                      <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold px-4 pt-3 pb-1">EGS</p>
                      <GoldBulletListLight items={cctPhase3.egsConditions} className="px-4 pb-3" />
                    </div>
                    <div>
                      <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold px-4 pt-3 pb-1">Colorectal / Other</p>
                      <GoldBulletListLight items={cctPhase3.colorectalConditions} className="px-4 pb-3" />
                    </div>
                  </div>
                </CCTCard>
              </div>
            </AnimatedSection>
          )}

          {cctTab === "portfolio" && (
            <AnimatedSection>
              <div className="grid md:grid-cols-2 gap-4">
                <CCTCard tag="Workplace-Based Assessments" title="Portfolio Evidence (both phases)">
                  <GoldBulletListLight items={cctPortfolio.wpba} className="px-4 py-3" />
                </CCTCard>
                <CCTCard tag="Research Requirements" title="Evidence of Scholarship (GMC GPC Framework)">
                  <GoldBulletListLight items={cctPortfolio.research} className="px-4 py-3" />
                  <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold px-4 pt-3 pb-1">Outputs (non-mandatory but assessed)</p>
                  <GoldBulletListLight items={cctPortfolio.researchOutputs} className="px-4 pb-3" />
                </CCTCard>
                <CCTCard tag="Quality Improvement, Education & Leadership" title="Non-Operative CCT Requirements">
                  <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold px-4 pt-3 pb-1">Quality Improvement</p>
                  <GoldBulletListLight items={cctPortfolio.qi} className="px-4 pb-2" />
                  <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold px-4 pt-3 pb-1">Medical Education</p>
                  <GoldBulletListLight items={cctPortfolio.education} className="px-4 pb-2" />
                  <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold px-4 pt-3 pb-1">Management &amp; Leadership</p>
                  <GoldBulletListLight items={cctPortfolio.leadership} className="px-4 pb-3" />
                </CCTCard>
                <CCTCard tag="Mandatory Courses & Other Requirements" title="Must be in date at CCT">
                  <GoldBulletListLight items={cctPortfolio.mandatory} className="px-4 py-3" />
                  <CCTNote>CCT is awarded at <strong>ARCP Outcome 6</strong>. All evidence must be current on ISCP at time of panel.</CCTNote>
                </CCTCard>
              </div>
            </AnimatedSection>
          )}
        </div>
      </section>

      {/* ════════════════ JAG ENDOSCOPY ════════════════ */}
      <section id="endoscopy" className="py-20 md:py-24 bg-navy">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <Eyebrow>Joint Advisory Group on GI Endoscopy · JETS</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground leading-tight mb-3.5">JAG Colonoscopy Certification</h2>
            <p className="font-sans text-[0.93rem] text-navy-foreground/60 max-w-xl leading-relaxed mb-10">
              JAG colonoscopy certification is not a mandatory CCT requirement, but most colorectal consultant person specifications list it as essential.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-12">
              {jagReqs.map((r, i) => (
                <div key={i} className="bg-navy-foreground/[0.06] border border-navy-foreground/[0.14] rounded-lg px-4 py-5">
                  <p className="font-sans text-[0.8rem] text-navy-foreground/50 mb-1.5">{r.label}</p>
                  <p className="text-2xl font-sans font-bold text-gold leading-none">{r.val}</p>
                  <p className="font-sans text-[0.72rem] text-navy-foreground/40 mt-1">{r.unit}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <div className="grid lg:grid-cols-2 gap-10">
              <div>
                <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-4">Step-by-step certification pathway</p>
                <div className="space-y-0">
                  {jagSteps.map((s, i) => (
                    <div key={i} className="grid grid-cols-[48px_1fr] gap-4 py-5 border-b border-navy-foreground/10 last:border-b-0">
                      <div className="w-9 h-9 rounded-full border-[1.5px] border-gold flex items-center justify-center font-mono text-[0.8rem] text-gold shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-sans font-bold text-navy-foreground text-[0.93rem] mb-1">{s.title}</p>
                        <p className="font-sans text-[0.82rem] text-navy-foreground/50 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-4">BSG performance standards required for certification</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {jagKpis.map((k, i) => (
                    <div key={i} className="bg-navy-foreground/[0.05] border border-navy-foreground/[0.12] rounded-lg px-3.5 py-3">
                      <p className="text-xl font-sans font-bold text-gold">{k.val}</p>
                      <p className="font-sans text-[0.75rem] text-navy-foreground/50 mt-0.5 leading-snug">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-3.5">Polypectomy SMSA scoring — what does it mean?</p>
                  <div className="bg-navy-foreground/[0.05] border border-navy-foreground/[0.12] rounded-lg px-4 py-4">
                    <p className="font-sans text-[0.82rem] text-navy-foreground/50 leading-relaxed mb-3">
                      SMSA stands for <strong className="text-navy-foreground">Size, Morphology, Site, Access</strong>. Each factor is scored to give a total difficulty level:
                    </p>
                    <GoldBulletList items={[
                      "Level 1 (4–5 pts) — small, pedunculated, accessible polyps. Cold snare technique.",
                      "Level 2 (6–9 pts) — larger or sessile. Hot snare / diathermy-assisted EMR required.",
                      "Level 3–4 — complex resections (ESD, piecemeal EMR). Post-certification development.",
                    ]} />
                  </div>
                </div>

                <div className="mt-6">
                  <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-3.5">Practical tips from colorectal trainees</p>
                  <div className="bg-navy-foreground/[0.05] border border-navy-foreground/[0.12] rounded-lg px-4 py-4">
                    <GoldBulletList items={endoTips} />
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Endoscopy video library teaser */}
          <AnimatedSection delay={300} className="mt-14">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-7">
              <div>
                <p className="font-mono text-[0.65rem] tracking-[0.12em] uppercase text-gold/60 mb-1.5">Members Only · Video Library</p>
                <h3 className="text-xl md:text-2xl font-sans font-bold text-navy-foreground">Basic Skills in Endoscopy</h3>
                <p className="font-sans text-[0.85rem] text-navy-foreground/50 mt-1.5 leading-relaxed max-w-xl">
                  Consultant-led video guides covering the fundamental techniques of diagnostic colonoscopy and flexible sigmoidoscopy.
                </p>
              </div>
              <Link href="/members/videos?category=endoscopy"
                className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold font-sans text-[0.8rem] font-semibold px-4 py-2.5 rounded-md hover:bg-gold/20 transition-colors whitespace-nowrap">
                View full library <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {endoVideos.map((v, i) => (
                <div key={i} className="bg-navy-foreground/[0.04] border border-navy-foreground/[0.12] rounded-lg overflow-hidden hover:border-gold/30 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                  <div className="relative h-40 bg-gradient-to-br from-navy/80 to-navy flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="relative z-10 w-12 h-12 rounded-full bg-gold/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={20} className="text-white fill-white ml-0.5" />
                    </div>
                    <div className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 bg-black/50 text-navy-foreground/70 font-sans text-[0.68rem] font-semibold px-2 py-1 rounded">
                      <Lock size={11} /> Members
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 z-10 bg-black/60 text-navy-foreground/80 font-sans text-[0.72rem] font-semibold px-2 py-0.5 rounded">
                      {v.duration}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="font-sans text-[0.68rem] font-bold uppercase tracking-wider text-gold mb-1.5">{v.tag}</p>
                    <p className="font-sans text-[0.95rem] text-navy-foreground leading-snug mb-2">{v.title}</p>
                    <p className="font-sans text-[0.78rem] text-navy-foreground/50 leading-relaxed mb-2.5">{v.desc}</p>
                    <p className="font-sans text-[0.7rem] font-semibold text-navy-foreground/30">{v.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════ ROBOTIC SURGERY ════════════════ */}
      <section id="robotic" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <Eyebrow>ACPGBI Position Statement 2025 · Colorectal Disease, Evans et al.</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground leading-tight mb-3.5">Robotic Colorectal Surgery</h2>
            <p className="font-sans text-[0.93rem] text-muted-foreground max-w-xl leading-relaxed mb-8">
              Robotic-assisted colorectal surgery (RACS) has grown exponentially across the UK and Ireland. The NHS has committed to robotic-assisted surgery as the default for many operations, with projections of 500,000 robotic procedures per year by 2035.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div className="flex flex-wrap items-center bg-navy border border-gold/20 rounded-xl overflow-hidden">
              {roboticStats.map((s, i) => (
                <div key={i} className="flex-1 min-w-[140px] py-5 px-5 text-center">
                  <p className="text-2xl md:text-3xl font-sans font-bold text-gold leading-none mb-1.5">{s.val}</p>
                  <p className="font-sans text-[0.72rem] text-navy-foreground/50 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100} className="mt-12">
            <p className="font-sans text-[0.7rem] font-bold uppercase tracking-[0.12em] text-gold mb-4">Platforms in UK NHS Practice</p>
          </AnimatedSection>
          <AnimatedSection delay={200}>
            <div className="grid md:grid-cols-3 gap-4">
              {roboticPlatforms.map((p) => (
                <div key={p.name} className={cn(
                  "bg-navy border rounded-lg px-5 py-5",
                  p.dominant ? "border-gold/35 bg-[hsl(220,65%,9%)]" : "border-navy-foreground/10"
                )}>
                  <h4 className="font-sans text-xl text-navy-foreground mb-0.5">{p.name}</h4>
                  <p className="font-sans text-[0.75rem] text-navy-foreground/50 mb-2.5">{p.maker}</p>
                  <span className={cn(
                    "inline-block font-sans text-[0.66rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-3.5 border",
                    p.dominant ? "bg-gold/15 text-gold border-gold/40" : "bg-navy-foreground/[0.07] text-navy-foreground/60 border-navy-foreground/15"
                  )}>{p.tag}</span>
                  <ul className="space-y-0">
                    {p.items.map((item, i) => (
                      <li key={i} className="relative pl-3.5 py-1 border-b border-navy-foreground/[0.07] last:border-b-0 font-sans text-[0.78rem] text-navy-foreground/50 leading-relaxed">
                        <span className="absolute left-0 top-[11px] w-[5px] h-[5px] rounded-full bg-gold" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* ACPGBI 3-level framework */}
          <AnimatedSection delay={100} className="mt-14">
            <p className="font-sans text-[0.7rem] font-bold uppercase tracking-[0.12em] text-gold mb-1.5">ACPGBI 2025 Training Framework — Three Levels</p>
            <p className="font-sans text-[0.85rem] text-muted-foreground mt-1.5 max-w-2xl">
              Published in <em>Colorectal Disease</em> (Evans, Shakir, El-Sayed et al., on behalf of The Dukes&apos; Club and ACPGBI Robotic Clinical Advisory Group).
            </p>
          </AnimatedSection>

          <AnimatedSection delay={200} className="mt-6">
            <div className="flex flex-col lg:flex-row items-stretch gap-0">
              {roboticLevels.map((l, i) => (
                <div key={l.level} className="flex items-stretch">
                  {i > 0 && (
                    <div className="hidden lg:flex items-center justify-center w-9 shrink-0 pb-10">
                      <svg width="24" height="40" viewBox="0 0 24 40"><path d="M12 0 L12 32 M4 24 L12 36 L20 24" stroke="hsl(42,87%,55%)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  )}
                  <div className={cn(
                    "flex-1 rounded-lg overflow-hidden flex flex-col border",
                    l.active ? "bg-navy border-gold/35 shadow-lg lg:-translate-y-1.5" : "bg-card border-border"
                  )}>
                    <div className={cn("px-4 py-2 text-[0.65rem] font-sans font-bold uppercase tracking-[0.1em] border-b",
                      l.active ? "bg-gold/15 text-gold border-gold/20" : "bg-background/60 text-muted-foreground border-border"
                    )}>{l.level}</div>
                    <div className="px-4 pt-3.5 pb-1">
                      <h4 className={cn("font-sans text-lg", l.active ? "text-navy-foreground" : "text-foreground")}>{l.title}</h4>
                      <p className={cn("font-sans text-[0.73rem] mb-3", l.active ? "text-navy-foreground/50" : "text-muted-foreground")}>{l.subtitle}</p>
                    </div>
                    <div className="px-4 pb-3 flex-1">
                      <ul className="space-y-0">
                        {l.items.map((item, j) => (
                          <li key={j} className={cn(
                            "relative pl-3.5 py-[5px] border-b last:border-b-0 font-sans text-[0.77rem] leading-relaxed",
                            l.active ? "text-navy-foreground/50 border-navy-foreground/[0.08]" : "text-foreground/70 border-border/50"
                          )}>
                            <span className="absolute left-0 top-[12px] w-[5px] h-[5px] rounded-full bg-gold" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      {l.active && (
                        <Link href="/members/fellowship-directory"
                          className="inline-flex items-center gap-1.5 mt-3 font-sans text-[0.75rem] font-bold text-gold border border-gold/30 rounded px-3 py-1.5 hover:bg-gold/10 transition-colors">
                          <Search size={14} /> Browse the Fellowship Directory
                        </Link>
                      )}
                    </div>
                    <div className={cn("px-4 py-2.5 text-[0.68rem] font-sans font-bold uppercase tracking-wider border-t",
                      l.active ? "bg-gold/10 text-gold border-gold/20" : "bg-background/60 text-foreground border-border"
                    )}>{l.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* da Vinci TR Pathway */}
          <AnimatedSection delay={100} className="mt-14">
            <p className="font-sans text-[0.7rem] font-bold uppercase tracking-[0.12em] text-gold mb-4">da Vinci Training Pathway — Intuitive Surgical</p>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {trPathway.map((p) => (
                <div key={p.phase} className={cn(
                  "rounded-lg overflow-hidden border bg-card",
                  p.pill === "clin" ? "border-t-[3px] border-t-gold border-x-border border-b-border" : "border-t-[3px] border-t-muted border-x-border border-b-border"
                )}>
                  <div className="px-4 pt-3.5 pb-2.5">
                    <span className={cn(
                      "inline-block font-sans text-[0.63rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5",
                      p.pill === "clin" ? "bg-gold/15 text-gold/80" : "bg-muted/30 text-muted-foreground"
                    )}>{p.pill === "clin" ? "Clinical" : "Pre-clinical"}</span>
                    <h4 className="font-sans text-[0.95rem] text-foreground">{p.phase}</h4>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="bg-background border border-border rounded-md px-3 py-2 mb-3">
                      <p className="font-sans text-[0.63rem] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{p.label}</p>
                      <p className="font-sans text-[0.82rem] font-bold text-foreground">{p.title}</p>
                    </div>
                    <ul className="space-y-0">
                      {p.items.map((item, j) => (
                        <li key={j} className="relative pl-3.5 py-[5px] border-b border-border/50 last:border-b-0 font-sans text-[0.77rem] text-foreground/70 leading-relaxed">
                          <span className="absolute left-0 top-[11px] w-[5px] h-[5px] rounded-full bg-gold" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Callouts */}
          <AnimatedSection delay={200} className="mt-10">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex gap-3.5 p-5 bg-gold/[0.04] border border-border border-l-[3px] border-l-gold rounded-lg">
                <AlertCircle size={20} className="text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-sans text-[0.82rem] font-bold text-foreground mb-1.5">The ACPGBI acknowledges trainee frustration</p>
                  <p className="font-sans text-[0.79rem] text-muted-foreground leading-relaxed">Many junior trainees feel training opportunities are being lost to consultants undergoing their own robotic learning curve, and are struggling to meet laparoscopic case numbers at robotic-only centres.</p>
                </div>
              </div>
              <div className="flex gap-3.5 p-5 bg-card border border-border border-l-[3px] border-l-gold rounded-lg">
                <CheckCircle size={20} className="text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="font-sans text-[0.82rem] font-bold text-foreground mb-1.5">Reassurance from the ACPGBI</p>
                  <p className="font-sans text-[0.79rem] text-muted-foreground leading-relaxed">RACS is primarily an alternative platform for minimally invasive surgery — the key principles and techniques of colorectal surgery remain the same across open, laparoscopic, and robotic approaches.</p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════ EVENTS STRIP ════════════════ */}
      {events.length > 0 && (
        <section className="py-20 md:py-24 bg-card">
          <div className="container mx-auto px-4">
            <AnimatedSection>
              <Eyebrow>Upcoming</Eyebrow>
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground leading-tight mb-8">Related Events &amp; Courses</h2>
            </AnimatedSection>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev, i) => (
                <AnimatedSection key={ev.id} delay={i * 70}>
                  <Link href={`/events/${ev.slug}`} className="block border border-border rounded-lg overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div className="bg-navy px-4 py-3 flex justify-between items-center">
                      <span className="font-mono text-[0.65rem] tracking-wider uppercase text-gold">{ev.event_type}</span>
                      <span className="font-sans text-[0.73rem] text-navy-foreground/50">{formatDate(ev.starts_at)}</span>
                    </div>
                    <div className="p-4 bg-card">
                      <h3 className="font-sans font-bold text-foreground text-[0.9rem] mb-1">{ev.title}</h3>
                      <p className="font-sans text-[0.76rem] text-muted-foreground mb-3">{ev.location}</p>
                      <div className="flex justify-between items-center">
                        <span className="font-sans font-bold text-foreground text-[0.85rem]">
                          {formatPrice(ev.price_pence)}
                          {ev.member_price_pence != null && ev.member_price_pence !== ev.price_pence && (
                            <span className="font-normal text-muted-foreground"> ({formatPrice(ev.member_price_pence)} members)</span>
                          )}
                        </span>
                        <span className="text-gold font-sans font-bold text-[0.78rem]">Book →</span>
                      </div>
                    </div>
                  </Link>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════ COMMUNITY ════════════════ */}
      <section id="community" className="py-20 md:py-24 bg-navy">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <Eyebrow>Members Only · Dukes&apos; Club Network</Eyebrow>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground leading-tight mb-3.5">The Colorectal Community</h2>
            <p className="font-sans text-[0.93rem] text-navy-foreground/60 max-w-xl leading-relaxed mb-10">
              Dukes&apos; Club connects colorectal trainees and consultants across every deanery in the UK and Ireland — and increasingly worldwide.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12 mb-10">
            {communityFeatures.map((f, i) => {
              const Icon = f.icon
              return (
                <AnimatedSection key={i} delay={(i % 3) * 70} className={f.large ? "sm:col-span-2 lg:col-span-3" : ""}>
                  <div className={cn(
                    "flex gap-4 items-start rounded-xl p-5 border transition-all duration-200 hover:bg-navy-foreground/[0.08] hover:border-gold/30",
                    f.large ? "bg-gold/[0.07] border-gold/20" : "bg-navy-foreground/[0.05] border-navy-foreground/10"
                  )}>
                    <div className={cn("shrink-0 rounded-lg bg-gold/10 flex items-center justify-center", f.large ? "w-14 h-14" : "w-12 h-12")}>
                      <Icon size={f.large ? 28 : 24} className="text-gold" />
                    </div>
                    <div>
                      <p className={cn("font-sans font-bold text-navy-foreground mb-1.5", f.large ? "text-lg" : "text-[0.92rem]")}>{f.label}</p>
                      <p className="font-sans text-[0.82rem] text-navy-foreground/60 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </AnimatedSection>
              )
            })}
          </div>

          <AnimatedSection delay={200}>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="inline-block bg-gold text-navy font-sans font-bold text-[0.9rem] px-7 py-3 rounded-md hover:opacity-85 transition-opacity">
                Join to access the network
              </Link>
              <Link href="/members/fellowship-directory" className="inline-block bg-transparent text-navy-foreground border border-navy-foreground/25 font-sans font-bold text-[0.9rem] px-7 py-3 rounded-md hover:border-navy-foreground/50 transition-colors">
                Browse member directory
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════ FINAL CTA ════════════════ */}
      <section className="py-20 text-center" style={{ background: "linear-gradient(140deg, hsl(220 60% 15%) 0%, hsl(205 55% 20%) 100%)" }}>
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-navy-foreground mb-3.5">Ready to advance your training?</h2>
            <p className="font-sans text-[0.93rem] text-navy-foreground/60 max-w-md mx-auto leading-relaxed mb-9">
              Join over 1,200 colorectal trainees with access to the full resource library, question bank, and events programme.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/register" className="inline-block bg-gold text-navy font-sans font-bold text-[0.9rem] px-7 py-3.5 rounded-md hover:opacity-85 transition-opacity">
                Join Dukes&apos; Club
              </Link>
              <Link href="/events" className="inline-block bg-transparent text-navy-foreground border border-navy-foreground/30 font-sans font-bold text-[0.9rem] px-7 py-3.5 rounded-md hover:border-navy-foreground/50 transition-colors">
                Browse Events
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

    </div>
  )
}