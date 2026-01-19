"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { testsApi, answersApi, specializationApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Timer } from "@/components/test/Timer";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  Sparkles,
  AlertCircle,
  Send,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Zap,
  Eye,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import {
  AntiCheatWarningModal,
  DisqualificationModal,
} from "@/components/test/AntiCheatWarningModal";

type ViewState = "loading" | "welcome" | "test" | "completed" | "expired" | "error";

interface Question {
  id: number;
  category: string;
  question_text: string;
  question_code?: string;
  language?: string;
  hints?: string[];
  max_score: number;
  question_order: number;
  answer?: {
    id: number;
    candidate_answer?: string;
    candidate_code?: string;
    score?: number;
    feedback?: string;
  };
}

interface SpecializationTest {
  id: number;
  candidate_id: number;
  access_token: string;
  test_type: string;
  specialization_focus: string;
  status: string;
  start_time?: string;
  end_time?: string;
  duration_hours: number;
  questions: Question[];
  candidate_name?: string;
}

// Focus area display names
const FOCUS_AREA_NAMES: Record<string, string> = {
  ml: "Machine Learning",
  embedded: "Embedded Systems",
  biomedical: "Biomedical Engineering",
  signal_processing: "Signal Processing",
  frontend: "Frontend Development",
  backend: "Backend Development",
  cybersecurity: "Cybersecurity",
};

// Focus area colors
const FOCUS_AREA_COLORS: Record<string, string> = {
  ml: "from-purple-600 to-indigo-600",
  embedded: "from-orange-600 to-amber-600",
  biomedical: "from-green-600 to-emerald-600",
  signal_processing: "from-blue-600 to-cyan-600",
  frontend: "from-pink-600 to-rose-600",
  backend: "from-cyan-600 to-teal-600",
  cybersecurity: "from-red-600 to-orange-600",
};

export default function SpecializationTestPage() {
  const params = useParams();
  const token = params.token as string;

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [test, setTest] = useState<SpecializationTest | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);

  // Complete test confirmation
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Anti-cheat state
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false);
  const [warningData, setWarningData] = useState({ warningCount: 0, violationScore: 0 });
  const [showDisqualification, setShowDisqualification] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState("");

  // Enhanced anti-cheat hook
  const antiCheat = useAntiCheat({
    token,
    isActive: viewState === "test",
    onWarning: (warningCount, violationScore) => {
      setWarningData({ warningCount, violationScore });
      setShowAntiCheatWarning(true);
    },
    onDisqualification: (reason) => {
      setDisqualificationReason(reason);
      setShowDisqualification(true);
    },
  });

  // Answer states (local storage for persistence)
  const answersRef = useRef<Map<number, { answer: string; code: string }>>(new Map());
  const [answerStates, setAnswerStates] = useState<Map<number, { answer: string; code: string }>>(new Map());

  // Load test data
  const fetchTest = useCallback(async () => {
    try {
      const response = await testsApi.getByToken(token);
      const testData = response.data;

      // Validate this is a specialization test
      // Check either test_type is "specialization" OR specialization_focus is set
      if (testData.test_type !== "specialization" && !testData.specialization_focus) {
        setError("Invalid test type. This link is for specialization tests only.");
        setViewState("error");
        return;
      }

      // Check for disqualification - block everything if disqualified
      if (testData.is_disqualified) {
        setDisqualificationReason(
          testData.disqualification_reason || "Your assessment was terminated due to integrity violations."
        );
        setShowDisqualification(true);
        setViewState("test"); // Keep in test view but modal will block everything
        return;
      }

      setTest(testData as SpecializationTest);

      // Determine view state based on test status
      if (testData.status === "completed") {
        setViewState("completed");
      } else if (testData.status === "expired") {
        setViewState("expired");
      } else if (testData.status === "in_progress") {
        setViewState("test");
        // Restore answer states from test data
        const storedAnswers = new Map<number, { answer: string; code: string }>();
        (testData.questions || []).forEach((q: Question) => {
          if (q.answer) {
            storedAnswers.set(q.id, {
              answer: q.answer.candidate_answer || "",
              code: q.answer.candidate_code || "",
            });
          }
        });
        answersRef.current = storedAnswers;
        setAnswerStates(storedAnswers);
      } else {
        setViewState("welcome");
      }
    } catch (err: unknown) {
      console.error("Error fetching test:", err);

      // Check for specific HTTP error codes (like regular test page)
      const axiosError = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail || "";

      if (status === 403) {
        // Test is completed, expired, or disqualified
        if (detail.includes("completed")) {
          setError("This test has already been completed and cannot be retaken.");
          setViewState("completed");
        } else if (detail.includes("terminated") || detail.includes("disqualified")) {
          setDisqualificationReason(detail);
          setShowDisqualification(true);
          setViewState("error");
        } else {
          setError(detail || "Access to this test is not allowed.");
          setViewState("error");
        }
      } else if (status === 404) {
        setError("Test not found. Please check your link.");
        setViewState("error");
      } else {
        const errorMessage = err instanceof Error ? err.message : "Failed to load test";
        setError(errorMessage);
        setViewState("error");
      }
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchTest();
    }
  }, [token, fetchTest]);

  // Start the test
  const handleStartTest = async () => {
    if (!test) return;
    setIsStarting(true);
    try {
      await testsApi.start(token);
      await fetchTest();
      setViewState("test");
    } catch (err) {
      console.error("Error starting test:", err);
      setError("Failed to start test. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  // Handle time expiry
  const handleTimeExpired = async () => {
    if (!test) return;
    try {
      await testsApi.complete(token);
      // Trigger analysis
      await specializationApi.analyze(test.id);
      setViewState("completed");
    } catch (err) {
      console.error("Error completing test:", err);
    }
  };

  // Save answer locally and to server (draft only - no AI evaluation)
  const handleAnswerChange = useCallback(
    async (questionId: number, answer: string, code: string) => {
      // Update local state
      answersRef.current.set(questionId, { answer, code });
      setAnswerStates(new Map(answersRef.current));

      // Save draft to server (no AI evaluation - just saves content)
      setSyncStatus("syncing");
      try {
        await answersApi.saveDraft({
          question_id: questionId,
          candidate_answer: answer,
          candidate_code: code,
        });
        setSyncStatus("synced");
      } catch (err) {
        console.error("Error saving draft:", err);
        setSyncStatus("error");
      }
    },
    []
  );

  // Navigate to next question
  const goToNextQuestion = () => {
    if (test?.questions && currentQuestionIndex < test.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Navigate to previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Calculate progress
  const getProgress = () => {
    if (!test || !test.questions) return { answered: 0, total: 0, percentage: 0 };
    const total = test.questions.length;
    let answered = 0;
    test.questions.forEach((q) => {
      const localAnswer = answersRef.current.get(q.id);
      if (localAnswer?.answer || localAnswer?.code || q.answer?.candidate_answer || q.answer?.candidate_code) {
        answered++;
      }
    });
    return { answered, total, percentage: total > 0 ? (answered / total) * 100 : 0 };
  };

  // Complete test
  const handleCompleteTest = async () => {
    if (!test) return;
    setIsSubmittingAll(true);
    try {
      // First, batch submit all answers for AI evaluation
      const answersToSubmit = Array.from(answersRef.current.entries()).map(
        ([questionId, { answer, code }]) => ({
          question_id: questionId,
          candidate_answer: answer,
          candidate_code: code,
        })
      );

      if (answersToSubmit.length > 0) {
        await answersApi.batchSubmit(answersToSubmit);
      }

      // Then complete the test
      await testsApi.complete(token);
      // Trigger specialization analysis
      await specializationApi.analyze(test.id);
      setViewState("completed");
    } catch (err) {
      console.error("Error completing test:", err);
      setError("Failed to submit test. Please try again.");
    } finally {
      setIsSubmittingAll(false);
      setShowCompleteConfirm(false);
    }
  };

  // Get focus area name
  const getFocusAreaName = (focusArea: string) => {
    return FOCUS_AREA_NAMES[focusArea] || focusArea;
  };

  // Get focus area color
  const getFocusAreaColor = (focusArea: string) => {
    return FOCUS_AREA_COLORS[focusArea] || "from-gray-600 to-slate-600";
  };

  const progress = getProgress();

  // Loading state
  if (viewState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Specialization Assessment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-center">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired state
  if (viewState === "expired") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <CardTitle className="text-center">Assessment Expired</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              This specialization assessment has expired. Please contact the administrator for a new assessment link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed state
  if (viewState === "completed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${test ? getFocusAreaColor(test.specialization_focus) : ""} flex items-center justify-center mx-auto mb-4`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-center text-2xl">Assessment Complete!</CardTitle>
            <CardDescription className="text-center">
              Your {test ? getFocusAreaName(test.specialization_focus) : ""} specialization assessment has been submitted.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">What happens next?</p>
              <ul className="text-sm text-left space-y-2">
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                  <span>AI analysis will identify your primary sub-specialty</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-blue-500 mt-0.5" />
                  <span>Your strengths will be ranked across all sub-areas</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <span>Personalized task recommendations will be generated</span>
                </li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              You will receive results once the analysis is complete. You may close this window.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Welcome state
  if (viewState === "welcome" && test) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getFocusAreaColor(test.specialization_focus)} flex items-center justify-center mx-auto mb-4`}>
              <Target className="w-12 h-12 text-white" />
            </div>
            <Badge className="mx-auto mb-4" variant="outline">
              Specialization Assessment
            </Badge>
            <CardTitle className="text-3xl">
              {getFocusAreaName(test.specialization_focus)}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Deep-dive assessment to identify your exact sub-specialty
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Assessment Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <Clock className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="font-semibold">{test.duration_hours * 60} Minutes</p>
                <p className="text-sm text-muted-foreground">Time Limit</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                <p className="font-semibold">{test.questions?.length || 0} Questions</p>
                <p className="text-sm text-muted-foreground">Expert Level</p>
              </div>
            </div>

            {/* What to expect */}
            <div className="p-4 border rounded-lg space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                What to Expect
              </h3>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>- Questions designed to identify your specific expertise within {getFocusAreaName(test.specialization_focus)}</li>
                <li>- Scenario-based problems requiring deep domain knowledge</li>
                <li>- Code implementation and architecture design tasks</li>
                <li>- Each question targets a different sub-specialty area</li>
              </ul>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg space-y-2">
              <h3 className="font-semibold">Instructions</h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>1. Answer all questions to the best of your ability</li>
                <li>2. Your answers are auto-saved as you type</li>
                <li>3. Focus on demonstrating depth of knowledge</li>
                <li>4. You can navigate between questions freely</li>
              </ul>
            </div>

            <Button
              className={`w-full h-12 text-lg bg-gradient-to-r ${getFocusAreaColor(test.specialization_focus)} hover:opacity-90`}
              onClick={handleStartTest}
              disabled={isStarting}
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Begin Assessment
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Once started, the timer cannot be paused. Make sure you have {test.duration_hours * 60} uninterrupted minutes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Test state
  if (viewState === "test" && test && test.questions) {
    const currentQuestion = test.questions[currentQuestionIndex];
    const currentAnswer = answerStates.get(currentQuestion?.id) || {
      answer: currentQuestion?.answer?.candidate_answer || "",
      code: currentQuestion?.answer?.candidate_code || "",
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        {/* Anti-Cheat Warning Modal */}
        <AntiCheatWarningModal
          isOpen={showAntiCheatWarning}
          onClose={() => setShowAntiCheatWarning(false)}
          warningCount={warningData.warningCount}
          violationScore={warningData.violationScore}
        />

        {/* Disqualification Modal */}
        <DisqualificationModal
          isOpen={showDisqualification}
          reason={disqualificationReason}
        />

        {/* Header */}
        <header className={`sticky top-0 z-50 bg-gradient-to-r ${getFocusAreaColor(test.specialization_focus)} text-white shadow-lg`}>
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6" />
                <div>
                  <h1 className="font-semibold">{getFocusAreaName(test.specialization_focus)}</h1>
                  <p className="text-xs text-white/80">Specialization Assessment</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Violation Counter */}
                {antiCheat.tabSwitchCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <Eye className="w-3 h-3 mr-1" />
                    {antiCheat.tabSwitchCount} violations
                  </Badge>
                )}

                {/* Sync Status */}
                <div className="flex items-center gap-2 text-sm">
                  {syncStatus === "syncing" && (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-white/80">Saving...</span>
                    </>
                  )}
                  {syncStatus === "synced" && (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-300" />
                      <span className="text-white/80">Saved</span>
                    </>
                  )}
                  {syncStatus === "error" && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-300" />
                      <span className="text-white/80">Error saving</span>
                    </>
                  )}
                </div>

                {/* Timer */}
                <div className="bg-white/20 rounded-lg px-4 py-2">
                  <Timer
                    initialSeconds={(() => {
                      if (!test.start_time) return test.duration_hours * 3600;
                      const startMs = new Date(test.start_time).getTime();
                      const endMs = startMs + test.duration_hours * 3600 * 1000;
                      const nowMs = Date.now();
                      const remainingMs = endMs - nowMs;
                      return Math.max(0, Math.floor(remainingMs / 1000));
                    })()}
                    onExpire={handleTimeExpired}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCompleteConfirm(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-white/80 mb-1">
                <span>Progress: {progress.answered} of {progress.total} answered</span>
                <span>{progress.percentage.toFixed(0)}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2 bg-white/20" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Question Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {test.questions.map((q, idx) => {
                  const hasAnswer = answersRef.current.get(q.id)?.answer ||
                                    answersRef.current.get(q.id)?.code ||
                                    q.answer?.candidate_answer ||
                                    q.answer?.candidate_code;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                        idx === currentQuestionIndex
                          ? `bg-gradient-to-r ${getFocusAreaColor(test.specialization_focus)} text-white`
                          : hasAnswer
                          ? "bg-green-500/20 text-green-600 border border-green-500/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === test.questions.length - 1}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Question Card */}
            {currentQuestion && (
              <Card className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      Question {currentQuestionIndex + 1} of {test.questions.length}
                    </Badge>
                    {currentQuestion.language && (
                      <Badge variant="secondary" className="text-xs">
                        {currentQuestion.language}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Question Text */}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {currentQuestion.question_text}
                    </p>
                  </div>

                  {/* Question Code (if any) */}
                  {currentQuestion.question_code && (
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm font-mono whitespace-pre-wrap">
                        {currentQuestion.question_code}
                      </pre>
                    </div>
                  )}

                  {/* Hints (if any) */}
                  {currentQuestion.hints && currentQuestion.hints.length > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Hints:</p>
                      <ul className="text-sm text-blue-600 dark:text-blue-400 list-disc list-inside space-y-1">
                        {currentQuestion.hints.map((hint, idx) => (
                          <li key={idx}>{hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Answer Input */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Your Answer</label>
                      <Textarea
                        placeholder="Type your answer here..."
                        className="min-h-[150px] resize-y"
                        value={currentAnswer.answer}
                        onChange={(e) =>
                          handleAnswerChange(currentQuestion.id, e.target.value, currentAnswer.code)
                        }
                      />
                    </div>

                    {/* Code Input (for questions with code) */}
                    {(currentQuestion.question_code || currentQuestion.language) && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Code Solution {currentQuestion.language && `(${currentQuestion.language})`}
                        </label>
                        <Textarea
                          placeholder="// Write your code here..."
                          className="min-h-[200px] font-mono text-sm resize-y bg-slate-50 dark:bg-slate-900"
                          value={currentAnswer.code}
                          onChange={(e) =>
                            handleAnswerChange(currentQuestion.id, currentAnswer.answer, e.target.value)
                          }
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bottom Navigation */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous Question
              </Button>
              {currentQuestionIndex === test.questions.length - 1 ? (
                <Button
                  className={`bg-gradient-to-r ${getFocusAreaColor(test.specialization_focus)}`}
                  onClick={() => setShowCompleteConfirm(true)}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Assessment
                </Button>
              ) : (
                <Button
                  className={`bg-gradient-to-r ${getFocusAreaColor(test.specialization_focus)}`}
                  onClick={goToNextQuestion}
                >
                  Next Question
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* Complete Confirmation Dialog */}
        <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Assessment?</DialogTitle>
              <DialogDescription>
                You have answered {progress.answered} of {progress.total} questions.
                {progress.answered < progress.total && (
                  <span className="text-yellow-500 block mt-2">
                    Warning: You have {progress.total - progress.answered} unanswered question(s).
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Once submitted, your answers will be analyzed by AI to determine your primary sub-specialty
                within {getFocusAreaName(test.specialization_focus)}.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompleteConfirm(false)}>
                Continue Working
              </Button>
              <Button
                className={`bg-gradient-to-r ${getFocusAreaColor(test.specialization_focus)}`}
                onClick={handleCompleteTest}
                disabled={isSubmittingAll}
              >
                {isSubmittingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Assessment
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Fallback for unexpected states - show loading or error
  console.warn("SpecializationTest: Unexpected state", { viewState, hasTest: !!test, hasQuestions: test?.questions?.length });

  // If viewState is test but questions are missing, show error
  if (viewState === "test" && (!test || !test.questions || test.questions.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Questions Found</h2>
            <p className="text-muted-foreground">
              This test doesn&apos;t have any questions yet. Please contact the administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default fallback - show loading
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );
}
