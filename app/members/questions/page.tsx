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
} from "lucide-react";
import { mockQuestions, questionTopics } from "@/data/mockMembersData";

type Mode = "study" | "exam";
type Screen = "setup" | "session" | "results";
type Difficulty = "all" | "easy" | "medium" | "hard";

const questionCounts = [10, 25, 50, 100];
const timeLimits = [
  { label: "No limit", value: 0 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

const QuestionBank = () => {
  // Setup state
  const [mode, setMode] = useState<Mode>("study");
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [timeLimit, setTimeLimit] = useState(0);

  // Session state
  const [screen, setScreen] = useState<Screen>("setup");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [sessionQuestions, setSessionQuestions] = useState(mockQuestions);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

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

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const toggleAllInCategory = (topics: readonly string[]) => {
    const allSelected = topics.every((t) => selectedTopics.includes(t));
    if (allSelected) {
      setSelectedTopics((prev) => prev.filter((t) => !topics.includes(t)));
    } else {
      setSelectedTopics((prev) => [...new Set([...prev, ...topics])]);
    }
  };

  const startSession = () => {
    let questions = [...mockQuestions];
    if (selectedTopics.length > 0) {
      questions = questions.filter((q) => selectedTopics.includes(q.topic));
    }
    if (difficulty !== "all") {
      questions = questions.filter((q) => q.difficulty === difficulty);
    }
    // Shuffle
    questions.sort(() => Math.random() - 0.5);
    questions = questions.slice(0, Math.min(numQuestions, questions.length));

    setSessionQuestions(questions);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setShowExplanation(false);
    setFlaggedQuestions(new Set());
    setTimeRemaining(timeLimit * 60);
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

  const getScore = () => {
    let correct = 0;
    sessionQuestions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correctAnswerIndex) correct++;
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
    if (optIndex === question.correctAnswerIndex) return "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30";
    if (optIndex === selected && optIndex !== question.correctAnswerIndex) return "border-destructive bg-destructive/5";
    return "border-border opacity-50";
  };

  const optionLabels = ["A", "B", "C", "D", "E"];

  // === SETUP SCREEN ===
  if (screen === "setup") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Question Bank</h1>
          <p className="text-muted-foreground mt-1">Practice colorectal surgery exam questions</p>
        </div>

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
            </div>

            {/* Topics */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Topics</label>
              <div className="space-y-4">
                {Object.entries(questionTopics).map(([category, topics]) => (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{category}</span>
                      <button
                        onClick={() => toggleAllInCategory(topics)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {topics.every((t) => selectedTopics.includes(t)) ? "Deselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {topics.map((topic) => (
                        <button
                          key={topic}
                          onClick={() => toggleTopic(topic)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            selectedTopics.includes(topic)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {topic}
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
            <Button onClick={startSession} className="w-full bg-gold text-gold-foreground hover:bg-gold/90" size="lg">
              <Play size={18} className="mr-2" /> Start Session
            </Button>
          </CardContent>
        </Card>
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
            const isCorrect = userAnswer === question.correctAnswerIndex;
            return (
              <Card key={qIdx} className={`border ${isCorrect ? "border-emerald-200" : "border-destructive/30"}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Q{qIdx + 1}. {question.question}</p>
                    {isCorrect ? (
                      <Check size={18} className="text-emerald-600 shrink-0" />
                    ) : (
                      <X size={18} className="text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="space-y-2">
                    {question.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg border text-sm flex items-start gap-2 ${
                          i === question.correctAnswerIndex
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : i === userAnswer && i !== question.correctAnswerIndex
                            ? "border-destructive bg-destructive/5"
                            : "border-border opacity-60"
                        }`}
                      >
                        <span className="font-bold text-xs text-muted-foreground mt-0.5">{optionLabels[i]}.</span>
                        <span className="flex-1">{opt}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-navy/5 border-l-4 border-navy">
                    <p className="text-xs font-semibold text-foreground mb-1">Explanation</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{question.explanation}</p>
                  </div>
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
                        if (!acc[q.topic]) acc[q.topic] = { correct: 0, total: 0 };
                        acc[q.topic].total++;
                        if (selectedAnswers[i] === q.correctAnswerIndex) acc[q.topic].correct++;
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

          {/* Question */}
          <p className="text-base font-semibold text-foreground leading-relaxed mb-6">
            {question.question}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option, index) => (
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
                {mode === "study" && selectedAnswers[currentIndex] !== undefined && index === question.correctAnswerIndex && (
                  <Check size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                )}
                {mode === "study" && selectedAnswers[currentIndex] === index && index !== question.correctAnswerIndex && (
                  <X size={18} className="text-destructive shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>

          {/* Explanation (study mode) */}
          {showExplanation && mode === "study" && (
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
