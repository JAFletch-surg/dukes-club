'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, BookOpen, GraduationCap, ExternalLink, Trophy, Target, Flame, TrendingUp, ArrowRight } from "lucide-react";
import { mockStats, mockTopicPerformance } from "@/data/mockMembersData";

const resources = [
  {
    title: "Question Bank",
    description: "Practice MCQs with instant feedback or exam simulation.",
    icon: FileText,
    badge: "500+ Qs",
    link: "/members/questions",
    available: true,
  },
  {
    title: "Viva Preparation",
    description: "Structured clinical scenarios and model answers for viva practice.",
    icon: BookOpen,
    badge: "30+ scenarios",
    link: null,
    available: false,
  },
  {
    title: "Revision Notes",
    description: "Concise topic summaries for key areas of colorectal surgery.",
    icon: GraduationCap,
    badge: "Coming soon",
    link: null,
    available: false,
  },
  {
    title: "External Resources",
    description: "Curated links to courses, question banks, and revision materials.",
    icon: ExternalLink,
    badge: "Updated",
    link: null,
    available: false,
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

const FRCSResources = () => {
  const overallPct = mockStats.examAverage;
  const totalAttempted = mockStats.questionsAttempted;
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
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
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
                <p className="text-2xl font-bold text-foreground">7</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Day Streak</p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <Trophy size={20} className="text-gold mb-1" />
                <p className="text-2xl font-bold text-foreground">Top 15%</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rank</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {resources.map((resource) => {
          const Wrapper = resource.available ? Link : "div";
          const wrapperProps = resource.available ? { href: resource.link! } : {};
          return (
            <Wrapper key={resource.title} {...(wrapperProps as any)}>
              <Card className={`border h-full transition-shadow ${resource.available ? "hover:shadow-md cursor-pointer" : "opacity-70"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center">
                      <resource.icon size={20} className="text-navy" />
                    </div>
                    <Badge variant={resource.available ? "default" : "secondary"} className="text-[10px]">
                      {resource.badge}
                    </Badge>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{resource.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{resource.description}</p>
                  {!resource.available && (
                    <p className="text-xs text-muted-foreground/60 mt-3 italic">Coming soon</p>
                  )}
                </CardContent>
              </Card>
            </Wrapper>
          );
        })}
      </div>

      {/* Topic Performance */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Topic Performance</h2>
        </div>
        {categories.map((category) => {
          const topics = mockTopicPerformance.filter((t) => t.category === category);
          if (topics.length === 0) return null;
          return (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{category}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topics.map((topic) => (
                  <Card key={topic.topic} className="border">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{topic.topic}</span>
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
    </div>
  );
};

export default FRCSResources;
