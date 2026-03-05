'use client'
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, BookOpen, GraduationCap, ExternalLink, Trophy, Target, Flame, TrendingUp, ArrowRight, Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
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

const resources = [
  {
    title: "Question Bank",
    description: "Practice MCQs with instant feedback or exam simulation.",
    icon: FileText,
    badgeType: "count" as const,
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
  const { user } = useAuth();
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

      {/* Resource Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {resources.map((resource) => {
          const Wrapper = resource.available ? Link : "div";
          const wrapperProps = resource.available ? { href: resource.link! } : {};
          const badgeText = resource.badgeType === 'count' ? `${questionCount}+ Qs` : resource.badge;
          return (
            <Wrapper key={resource.title} {...(wrapperProps as any)}>
              <Card className={`border h-full transition-shadow ${resource.available ? "hover:shadow-md cursor-pointer" : "opacity-70"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center">
                      <resource.icon size={20} className="text-navy" />
                    </div>
                    <Badge variant={resource.available ? "default" : "secondary"} className="text-[10px]">
                      {badgeText}
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