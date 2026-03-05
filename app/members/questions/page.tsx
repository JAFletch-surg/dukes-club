'use client'
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Check, X, ChevronLeft, ChevronRight, Flag, Clock,
  FileText, BookOpen, Play, RotateCcw, Trophy, AlertTriangle,
  Loader2, Trash2, BarChart3, Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";

type Mode = "study" | "exam";
type Screen = "setup" | "session" | "results";
type Difficulty = "all" | "easy" | "medium" | "hard";
type QuestionFilter = "all" | "unanswered" | "incorrect";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  topic_id: string | null;
  subtopic: string | null;
  difficulty: string;
  question_type: string;
  image_url: string | null;
  source: string | null;
}

interface Topic {
  id: string;
  name: string;
  category: string | null;
  slug: string | null;
}

interface UserStats {
  total_attempted: number;
  total_correct: number;
  overall_percentage: number;
  easy_attempted: number;
  easy_correct: number;
  medium_attempted: number;
  medium_correct: number;
  hard_attempted: number;
  hard_correct: number;
  total_sessions: number;
  study_sessions: number;
  exam_sessions: number;
  best_exam_percentage: number;
  average_exam_percentage: number;
  current_streak_days: number;
  longest_streak_days: number;
}

const questionCounts = [10, 25, 50, 100];
const timeLimits = [
  { label: "No limit", value: 0 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

const QuestionBank = () => {
  const { user } = useAuth();
  const supabase = createClient();

  // Data state
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<Record<string, { selected: number; correct: boolean }>>({});
  const [dataLoading, setDataLoading] = useState(true);

  // Setup state
  const [mode, setMode] = useState<Mode>("study");
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [timeLimit, setTimeLimit] = useState(0);
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");

  // Session state
  const [screen, setScreen] = useState<Screen>("setup");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load questions, topics, user stats, and previous attempts
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      setDataLoading(true);

      const [questionsRes, topicsRes, statsRes, attemptsRes] = await Promise.all([
        supabase.from('questions').select('*').eq('status', 'published').eq('is_active', true),
        supabase.from('question_topics').select('*').order('sort_order'),
        supabase.from('user_question_stats').select('*').eq('user_id', user!.id).single(),
        supabase.from('question_attempts').select('question_id, selected_answer, is_correct').eq('user_id', user!.id),
      ]);

      if (questionsRes.data) {
        const parsed = questionsRes.data.map((q: any) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]'),
        }));
        setAllQuestions(parsed);
      }

      if (topicsRes.data) setTopics(topicsRes.data);
      if (statsRes.data) setUserStats(statsRes.data);

      // Build a map of latest attempt per question
      if (attemptsRes.data) {
        const map: Record<string, { selected: number; correct: boolean }> = {};
        attemptsRes.data.forEach((a: any) => {
          map[a.question_id] = { selected: a.selected_answer, correct: a.is_correct };
        });
        setPreviousAttempts(map);
      }

      setDataLoading(false);
    }

    loadData();
  }, [user]);

  // Timer
  useEffect(() => {
    if (screen !== "session" || mode !== "exam" || timeLimit === 0 || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { handleSubmitExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, mode, timeLimit, timeRemaining]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Group topics by category
  const topicsByCategory = topics.reduce<Record<string, Topic[]>>((acc, t) => {
    const cat = t.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const getTopicName = (id: string | null) => {
    if (!id) return 'Uncategorised';
    return topics.find(t => t.id === id)?.name || 'Unknown';
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((t) => t !== topicId) : [...prev, topicId]
    );
  };

  const toggleAllInCategory = (categoryTopics: Topic[]) => {
    const ids = categoryTopics.map(t => t.id);
    const allSelected = ids.every((id) => selectedTopics.includes(id));
    if (allSelected) {
      setSelectedTopics((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedTopics((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const startSession = () => {
    let questions = [...allQuestions];

    // Filter by topics
    if (selectedTopics.length > 0) {
      questions = questions.filter((q) => q.topic_id && selectedTopics.includes(q.topic_id));
    }

    // Filter by difficulty
    if (difficulty !== "all") {
      questions = questions.filter((q) => q.difficulty === difficulty);
    }

    // Filter by attempt history
    if (questionFilter === "unanswered") {
      questions = questions.filter((q) => !previousAttempts[q.id]);
    } else if (questionFilter === "incorrect") {
      questions = questions.filter((q) => previousAttempts[q.id]?.correct === false);
    }

    // Shuffle
    questions.sort(() => Math.random() - 0.5);
    questions = questions.slice(0, Math.min(numQuestions, questions.length));

    if (questions.length === 0) return;

    setSessionQuestions(questions);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setShowExplanation(false);
    setFlaggedQuestions(new Set());
    setTimeRemaining(timeLimit * 60);
    setSessionStartTime(Date.now());
    setScreen("session");
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswers[currentIndex] !== undefined) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: index }));
    if (mode === "study") setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentIndex < sessionQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowExplanation(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowExplanation(mode === "study" && selectedAnswers[currentIndex - 1] !== undefined);
    }
  };

  const toggleFlag = () => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      return next;
    });
  };

  const handleSubmitExam = useCallback(() => {
    setShowSubmitConfirm(false);
    setScreen("results");
  }, []);

  // Save results to Supabase
  const saveResults = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    try {
      const timeTaken = Math.round((Date.now() - sessionStartTime) / 1000);
      let correct = 0;

      // Insert individual attempts
      const attempts = sessionQuestions.map((q, i) => {
        const isCorrect = selectedAnswers[i] === q.correct_answer;
        if (isCorrect) correct++;
        return {
          user_id: user.id,
          question_id: q.id,
          selected_answer: selectedAnswers[i] ?? -1,
          is_correct: isCorrect,
          session_mode: mode,
        };
      });

      await supabase.from('question_attempts').insert(attempts);

      // Save session summary
      const percentage = sessionQuestions.length > 0 ? Math.round((correct / sessionQuestions.length) * 100) : 0;
      await supabase.from('question_sessions').insert({
        user_id: user.id,
        mode,
        total_questions: sessionQuestions.length,
        correct_answers: correct,
        percentage,
        time_limit_minutes: timeLimit || null,
        time_taken_seconds: timeTaken,
        topics: selectedTopics.length > 0 ? selectedTopics : null,
        difficulty_filter: difficulty !== 'all' ? difficulty : null,
      });

      // Update aggregate stats
      const diffKey = (d: string) => {
        if (d === 'easy') return 'easy';
        if (d === 'hard') return 'hard';
        return 'medium';
      };

      // Calculate difficulty breakdowns from this session
      const diffStats = { easy: { attempted: 0, correct: 0 }, medium: { attempted: 0, correct: 0 }, hard: { attempted: 0, correct: 0 } };
      sessionQuestions.forEach((q, i) => {
        const dk = diffKey(q.difficulty) as keyof typeof diffStats;
        diffStats[dk].attempted++;
        if (selectedAnswers[i] === q.correct_answer) diffStats[dk].correct++;
      });

      const prev = userStats || {
        total_attempted: 0, total_correct: 0, overall_percentage: 0,
        easy_attempted: 0, easy_correct: 0, medium_attempted: 0, medium_correct: 0,
        hard_attempted: 0, hard_correct: 0, total_sessions: 0, study_sessions: 0,
        exam_sessions: 0, best_exam_percentage: 0, average_exam_percentage: 0,
        current_streak_days: 0, longest_streak_days: 0,
      };

      const newTotalAttempted = prev.total_attempted + sessionQuestions.length;
      const newTotalCorrect = prev.total_correct + correct;
      const newOverall = newTotalAttempted > 0 ? Math.round((newTotalCorrect / newTotalAttempted) * 100) : 0;
      const newTotalSessions = prev.total_sessions + 1;
      const newStudy = prev.study_sessions + (mode === 'study' ? 1 : 0);
      const newExam = prev.exam_sessions + (mode === 'exam' ? 1 : 0);
      const newBestExam = mode === 'exam' ? Math.max(prev.best_exam_percentage, percentage) : prev.best_exam_percentage;
      const newAvgExam = mode === 'exam' && newExam > 0
        ? Math.round(((prev.average_exam_percentage * prev.exam_sessions) + percentage) / newExam)
        : prev.average_exam_percentage;

      await supabase.from('user_question_stats').upsert({
        user_id: user.id,
        total_attempted: newTotalAttempted,
        total_correct: newTotalCorrect,
        overall_percentage: newOverall,
        easy_attempted: prev.easy_attempted + diffStats.easy.attempted,
        easy_correct: prev.easy_correct + diffStats.easy.correct,
        medium_attempted: prev.medium_attempted + diffStats.medium.attempted,
        medium_correct: prev.medium_correct + diffStats.medium.correct,
        hard_attempted: prev.hard_attempted + diffStats.hard.attempted,
        hard_correct: prev.hard_correct + diffStats.hard.correct,
        total_sessions: newTotalSessions,
        study_sessions: newStudy,
        exam_sessions: newExam,
        best_exam_percentage: newBestExam,
        average_exam_percentage: newAvgExam,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      // Update question-level stats
      for (const q of sessionQuestions) {
        await supabase.rpc('increment_question_stats', { q_id: q.id, was_correct: selectedAnswers[sessionQuestions.indexOf(q)] === q.correct_answer });
      }

      // Update local state
      setUserStats({
        ...prev,
        total_attempted: newTotalAttempted,
        total_correct: newTotalCorrect,
        overall_percentage: newOverall,
        easy_attempted: prev.easy_attempted + diffStats.easy.attempted,
        easy_correct: prev.easy_correct + diffStats.easy.correct,
        medium_attempted: prev.medium_attempted + diffStats.medium.attempted,
        medium_correct: prev.medium_correct + diffStats.medium.correct,
        hard_attempted: prev.hard_attempted + diffStats.hard.attempted,
        hard_correct: prev.hard_correct + diffStats.hard.correct,
        total_sessions: newTotalSessions,
        study_sessions: newStudy,
        exam_sessions: newExam,
        best_exam_percentage: newBestExam,
        average_exam_percentage: newAvgExam,
        current_streak_days: prev.current_streak_days,
        longest_streak_days: prev.longest_streak_days,
      });

      // Update previous attempts map
      const newAttempts = { ...previousAttempts };
      sessionQuestions.forEach((q, i) => {
        newAttempts[q.id] = { selected: selectedAnswers[i] ?? -1, correct: selectedAnswers[i] === q.correct_answer };
      });
      setPreviousAttempts(newAttempts);

    } catch (e) {
      console.error('Failed to save results:', e);
    }
    setSaving(false);
  }, [user, sessionQuestions, selectedAnswers, mode, timeLimit, difficulty, selectedTopics, sessionStartTime, userStats, previousAttempts, saving]);

  // Auto-save when results screen is shown
  useEffect(() => {
    if (screen === "results" && !saving && sessionQuestions.length > 0) {
      saveResults();
    }
  }, [screen]);

  const handleResetProgress = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.rpc('reset_question_progress', { target_user_id: user.id });
      setUserStats(null);
      setPreviousAttempts({});
      setShowResetConfirm(false);
    } catch (e) {
      console.error('Failed to reset:', e);
    }
    setSaving(false);
  };

  const getScore = () => {
    let correct = 0;
    sessionQuestions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correct_answer) correct++;
    });
    return correct;
  };

  const getOptionStyle = (qIndex: number, optIndex: number) => {
    const selected = selectedAnswers[qIndex];
    const question = sessionQuestions[qIndex];

    if (mode === "exam" && screen === "session") {
      if (selected === optIndex) return "border-primary bg-primary/5";
      return "border-border hover:bg-muted/30 cursor-pointer";
    }

    if (selected === undefined) return "border-border hover:bg-muted/30 cursor-pointer";
    if (optIndex === question.correct_answer) return "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30";
    if (optIndex === selected && optIndex !== question.correct_answer) return "border-destructive bg-destructive/5";
    return "border-border opacity-50";
  };

  const optionLabels = ["A", "B", "C", "D", "E", "F"];

  const availableQuestionCount = (() => {
    let questions = [...allQuestions];
    if (selectedTopics.length > 0) questions = questions.filter(q => q.topic_id && selectedTopics.includes(q.topic_id));
    if (difficulty !== "all") questions = questions.filter(q => q.difficulty === difficulty);
    if (questionFilter === "unanswered") questions = questions.filter(q => !previousAttempts[q.id]);
    else if (questionFilter === "incorrect") questions = questions.filter(q => previousAttempts[q.id]?.correct === false);
    return questions.length;
  })();

  // === LOADING ===
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  // === SETUP SCREEN ===
  if (screen === "setup") {
    const attempted = Object.keys(previousAttempts).length;
    const incorrectCount = Object.values(previousAttempts).filter(a => !a.correct).length;

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Question Bank</h1>
            <p className="text-muted-foreground mt-1">
              {allQuestions.length} questions available · {attempted} attempted
            </p>
          </div>
          {userStats && userStats.total_attempted > 0 && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive border border-border rounded-lg hover:border-destructive/30 transition-colors"
            >
              <RotateCcw size={12} /> Reset Progress
            </button>
          )}
        </div>

        {/* Stats Overview */}
        {userStats && userStats.total_attempted > 0 && (
          <Card className="border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Your Progress</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.overall_percentage}%</p>
                  <p className="text-xs text-muted-foreground">Overall Score</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.total_attempted}</p>
                  <p className="text-xs text-muted-foreground">Questions Done</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.total_sessions}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{userStats.best_exam_percentage || 0}%</p>
                  <p className="text-xs text-muted-foreground">Best Exam</p>
                </div>
              </div>
              {/* Difficulty breakdown */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                {(['easy', 'medium', 'hard'] as const).map(d => {
                  const att = userStats[`${d}_attempted` as keyof UserStats] as number;
                  const cor = userStats[`${d}_correct` as keyof UserStats] as number;
                  const pct = att > 0 ? Math.round((cor / att) * 100) : 0;
                  return (
                    <div key={d} className="text-center">
                      <p className={`text-lg font-bold ${pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-destructive'}`}>{pct}%</p>
                      <p className="text-xs text-muted-foreground capitalize">{d} ({att})</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Configure Your Session</h2>

            {/* Mode Toggle */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("study")}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    mode === "study" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen size={18} className="text-emerald-600" />
                    <span className="font-semibold text-sm text-foreground">Study Mode</span>
                  </div>
                  <p className="text-xs text-muted-foreground">See answers as you go</p>
                </button>
                <button
                  onClick={() => setMode("exam")}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    mode === "exam" ? "border-navy bg-navy/5" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={18} className="text-navy" />
                    <span className="font-semibold text-sm text-foreground">Exam Mode</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Timed, results at the end</p>
                </button>
              </div>
            </div>

            {/* Question Filter */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Question Selection</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'all', label: 'All Questions', count: allQuestions.length },
                  { value: 'unanswered', label: 'Not Yet Attempted', count: allQuestions.length - attempted },
                  { value: 'incorrect', label: 'Previously Incorrect', count: incorrectCount },
                ] as const).map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setQuestionFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      questionFilter === f.value ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Questions */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Number of Questions</label>
              <div className="flex gap-2">
                {questionCounts.map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumQuestions(n)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      numQuestions === n ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {availableQuestionCount < numQuestions && (
                <p className="text-xs text-amber-600 mt-2">
                  Only {availableQuestionCount} questions match your filters
                </p>
              )}
            </div>

            {/* Topics */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Topics</label>
              <div className="space-y-4">
                {Object.entries(topicsByCategory).map(([category, catTopics]) => (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{category}</span>
                      <button
                        onClick={() => toggleAllInCategory(catTopics)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {catTopics.every((t) => selectedTopics.includes(t.id)) ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {catTopics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => toggleTopic(topic.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            selectedTopics.includes(topic.id)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {topic.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {selectedTopics.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">No topics selected — all topics will be included</p>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Difficulty</label>
              <div className="flex gap-2">
                {(["all", "easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                      difficulty === d ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {d === "all" ? "All" : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Limit (exam mode) */}
            {mode === "exam" && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Time Limit</label>
                <div className="flex gap-2 flex-wrap">
                  {timeLimits.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTimeLimit(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        timeLimit === t.value ? "bg-navy text-navy-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Start */}
            <Button
              onClick={startSession}
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              size="lg"
              disabled={availableQuestionCount === 0}
            >
              <Play size={18} className="mr-2" />
              {availableQuestionCount === 0 ? 'No questions match filters' : `Start Session (${Math.min(numQuestions, availableQuestionCount)} questions)`}
            </Button>
          </CardContent>
        </Card>

        {/* Reset Confirmation */}
        <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset All Progress?</DialogTitle>
              <DialogDescription>
                This will permanently delete all your question attempt history, session records, and performance statistics. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleResetProgress} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 size={16} className="mr-2" />}
                Reset Everything
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // === RESULTS SCREEN ===
  if (screen === "results") {
    const score = getScore();
    const total = sessionQuestions.length;
    const percentage = Math.round((score / total) * 100);

    if (reviewMode) {
      return (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Review Answers</h1>
            <Button variant="outline" size="sm" onClick={() => setReviewMode(false)}>
              Back to Results
            </Button>
          </div>
          {sessionQuestions.map((question, qIdx) => {
            const userAnswer = selectedAnswers[qIdx];
            const isCorrect = userAnswer === question.correct_answer;
            return (
              <Card key={qIdx} className={`border ${isCorrect ? "border-emerald-200" : "border-destructive/30"}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Q{qIdx + 1}. {question.question_text}</p>
                    {isCorrect ? (
                      <Check size={18} className="text-emerald-600 shrink-0" />
                    ) : (
                      <X size={18} className="text-destructive shrink-0" />
                    )}
                  </div>
                  {question.image_url && (
                    <img src={question.image_url} alt="" className="rounded-lg max-h-48 object-contain" />
                  )}
                  <div className="space-y-2">
                    {question.options.map((opt: string, i: number) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border text-sm flex items-start gap-2 ${
                          i === question.correct_answer
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : i === userAnswer && i !== question.correct_answer
                            ? "border-destructive bg-destructive/5"
                            : "border-border opacity-60"
                        }`}
                      >
                        <span className="font-bold text-xs text-muted-foreground mt-0.5">{optionLabels[i]}.</span>
                        <span className="flex-1">{opt}</span>
                      </div>
                    ))}
                  </div>
                  {question.explanation && (
                    <div className="p-3 rounded-lg bg-navy/5 border-l-4 border-navy">
                      <p className="text-xs font-semibold text-foreground mb-1">Explanation</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{question.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Card className="border">
          <CardContent className="p-8 text-center space-y-6">
            {saving && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={14} /> Saving results...
              </div>
            )}
            <Trophy size={48} className="mx-auto text-gold" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                You scored {score}/{total} ({percentage}%)
              </h1>
              <p className="text-muted-foreground mt-2">
                {percentage >= 70
                  ? "Great performance! Keep it up."
                  : percentage >= 50
                  ? "Good effort. Review your weak areas."
                  : "Keep practising — focus on the topics below."}
              </p>
            </div>

            {/* Topic breakdown */}
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground mb-3">Topic Breakdown</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Topic</th>
                      <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Correct</th>
                      <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Total</th>
                      <th className="text-center p-3 text-xs font-semibold text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      sessionQuestions.reduce((acc, q, i) => {
                        const topicName = getTopicName(q.topic_id);
                        if (!acc[topicName]) acc[topicName] = { correct: 0, total: 0 };
                        acc[topicName].total++;
                        if (selectedAnswers[i] === q.correct_answer) acc[topicName].correct++;
                        return acc;
                      }, {} as Record<string, { correct: number; total: number }>)
                    ).map(([topic, data]) => {
                      const pct = Math.round((data.correct / data.total) * 100);
                      return (
                        <tr key={topic} className="border-t border-border">
                          <td className="p-3 text-foreground">{topic}</td>
                          <td className="p-3 text-center">{data.correct}</td>
                          <td className="p-3 text-center">{data.total}</td>
                          <td className={`p-3 text-center font-semibold ${pct >= 70 ? "text-emerald-600" : pct >= 50 ? "text-gold" : "text-destructive"}`}>
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" onClick={() => setReviewMode(true)}>
                <FileText size={16} className="mr-2" /> Review Answers
              </Button>
              <Button onClick={() => setScreen("setup")} className="bg-gold text-gold-foreground hover:bg-gold/90">
                <RotateCcw size={16} className="mr-2" /> Start New Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === SESSION SCREEN ===
  const question = sessionQuestions[currentIndex];
  const totalQuestions = sessionQuestions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Question Bank</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {mode === "study" ? "Study Mode" : "Exam Mode"} · {answeredCount}/{totalQuestions} answered
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "exam" && timeLimit > 0 && (
            <Badge variant="outline" className="font-mono text-sm">
              <Clock size={14} className="mr-1" /> {formatTime(timeRemaining)}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowNavigator(!showNavigator)}>
            Navigator
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (mode === "exam") setShowSubmitConfirm(true);
              else setScreen("results");
            }}
          >
            {mode === "exam" ? "Submit Exam" : "End Session"}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Progress value={((currentIndex + 1) / totalQuestions) * 100} className="h-2" />

      {/* Question Navigator */}
      {showNavigator && (
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex gap-2 flex-wrap">
              {sessionQuestions.map((_, i) => {
                const answered = selectedAnswers[i] !== undefined;
                const flagged = flaggedQuestions.has(i);
                const current = i === currentIndex;
                return (
                  <button
                    key={i}
                    onClick={() => { setCurrentIndex(i); setShowExplanation(mode === "study" && selectedAnswers[i] !== undefined); }}
                    className={`w-9 h-9 rounded-lg text-xs font-semibold border transition-colors ${
                      current ? "border-primary bg-primary text-primary-foreground" :
                      flagged ? "border-gold bg-gold/10 text-gold" :
                      answered ? "border-primary/30 bg-primary/5 text-primary" :
                      "border-border text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/5 border border-primary/30" /> Answered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gold/10 border border-gold" /> Flagged</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-border" /> Unanswered</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Badge variant="secondary">Question {currentIndex + 1} of {totalQuestions}</Badge>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{question.difficulty}</Badge>
              <button
                onClick={toggleFlag}
                className={`p-1.5 rounded transition-colors ${
                  flaggedQuestions.has(currentIndex) ? "text-gold bg-gold/10" : "text-muted-foreground hover:text-gold"
                }`}
              >
                <Flag size={16} />
              </button>
            </div>
          </div>

          {/* Image */}
          {question.image_url && (
            <img src={question.image_url} alt="" className="rounded-lg max-h-64 object-contain mb-6" />
          )}

          {/* Question */}
          <p className="text-base font-semibold text-foreground leading-relaxed mb-6">
            {question.question_text}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option: string, index: number) => (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors flex items-start gap-3 ${getOptionStyle(currentIndex, index)}`}
                disabled={mode === "study" && selectedAnswers[currentIndex] !== undefined}
              >
                <span className="font-bold text-sm text-muted-foreground shrink-0 mt-0.5">
                  {optionLabels[index]}.
                </span>
                <span className="text-sm text-foreground flex-1">{option}</span>
                {mode === "study" && selectedAnswers[currentIndex] !== undefined && index === question.correct_answer && (
                  <Check size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                )}
                {mode === "study" && selectedAnswers[currentIndex] === index && index !== question.correct_answer && (
                  <X size={18} className="text-destructive shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>

          {/* Explanation (study mode) */}
          {showExplanation && mode === "study" && question.explanation && (
            <div className="mt-6 p-4 rounded-lg bg-navy/5 border-l-4 border-navy">
              <p className="text-sm font-semibold text-foreground mb-1">Explanation</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentIndex === 0}>
              <ChevronLeft size={16} className="mr-1" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {totalQuestions}
            </span>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={currentIndex === totalQuestions - 1}>
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit Confirmation */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Exam?</DialogTitle>
            <DialogDescription>
              You have answered {answeredCount} of {totalQuestions} questions.
              {flaggedQuestions.size > 0 && ` ${flaggedQuestions.size} question(s) flagged for review.`}
              {answeredCount < totalQuestions && ` ${totalQuestions - answeredCount} question(s) unanswered.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>Continue Exam</Button>
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={handleSubmitExam}>
              Submit Exam
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionBank;