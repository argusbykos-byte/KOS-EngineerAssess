"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { competitionsApi, answersApi, testsApi } from "@/lib/api";
import { ScreeningTest, Question } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Play,
  ShieldAlert,
  X,
} from "lucide-react";

interface QuestionWithTiming extends Question {
  startTime?: number;
  timeSpent: number;
}

interface AntiCheatViolations {
  tabSwitchCount: number;
  pasteAttemptCount: number;
  copyAttemptCount: number;
  rightClickCount: number;
  devToolsOpenCount: number;
  focusLossCount: number;
}

function ScreeningContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params.token as string;
  const competitionId = parseInt(searchParams.get("competition") || "0");

  const [screening, setScreening] = useState<ScreeningTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startingMessage, setStartingMessage] = useState("Starting...");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<QuestionWithTiming[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Anti-cheat state
  const [violations, setViolations] = useState<AntiCheatViolations>({
    tabSwitchCount: 0,
    pasteAttemptCount: 0,
    copyAttemptCount: 0,
    rightClickCount: 0,
    devToolsOpenCount: 0,
    focusLossCount: 0,
  });
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [lastWarningType, setLastWarningType] = useState<string>("");
  const isTestActive = useRef(false);
  const devToolsCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastDevToolsCheck = useRef<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTime = useRef<number>(Date.now());

  // Fetch screening data
  const fetchScreening = useCallback(async () => {
    if (!competitionId) {
      setError("Competition ID is required");
      setLoading(false);
      return;
    }

    try {
      const res = await competitionsApi.getScreening(competitionId, token);
      setScreening(res.data);

      if (res.data.questions_by_section) {
        const allQuestions: QuestionWithTiming[] = [];
        Object.values(res.data.questions_by_section).forEach((sectionQuestions) => {
          (sectionQuestions as Question[]).forEach((q) => {
            allQuestions.push({ ...q, timeSpent: 0 });
          });
        });
        setQuestions(allQuestions);

        // Restore draft answers
        const drafts: Record<number, string> = {};
        allQuestions.forEach((q) => {
          if (q.draft_answer) {
            drafts[q.id] = q.draft_answer;
          }
        });
        setAnswers(drafts);
      }

      if (res.data.time_remaining_seconds !== null) {
        setTimeRemaining(res.data.time_remaining_seconds);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Failed to load screening test");
    } finally {
      setLoading(false);
    }
  }, [competitionId, token]);

  useEffect(() => {
    fetchScreening();
  }, [fetchScreening]);

  // Timer countdown - intentionally only re-run when screening state changes
  // handleSubmit and timeRemaining are accessed via closure to avoid recreating interval on every tick
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0 && screening?.screening_started && !screening?.screening_completed) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screening?.screening_started, screening?.screening_completed]);

  // Track time spent on current question
  useEffect(() => {
    questionStartTime.current = Date.now();
  }, [currentQuestionIndex]);

  // Helper to log violations and show warning
  const logViolation = useCallback((type: keyof AntiCheatViolations, warningMessage: string) => {
    if (!isTestActive.current) return;

    setViolations((prev) => ({
      ...prev,
      [type]: prev[type] + 1,
    }));
    setLastWarningType(warningMessage);
    setShowWarningBanner(true);

    // Also log to the test's anti-cheat if we have a test token
    if (screening?.test_access_token) {
      testsApi.logAntiCheatEvent(screening.test_access_token, {
        event_type: type === "tabSwitchCount" ? "tab_switch" :
                   type === "pasteAttemptCount" ? "paste_attempt" :
                   type === "copyAttemptCount" ? "copy_attempt" :
                   type === "rightClickCount" ? "right_click" :
                   type === "devToolsOpenCount" ? "dev_tools_open" : "focus_loss",
        timestamp: new Date().toISOString(),
        details: warningMessage,
      }).catch(console.error);
    }
  }, [screening?.test_access_token]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTestActive.current) {
        logViolation("tabSwitchCount", "Tab switch detected");
      }
    };

    const handleWindowBlur = () => {
      if (isTestActive.current) {
        logViolation("focusLossCount", "Window lost focus");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [logViolation]);

  // Copy prevention
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (!isTestActive.current) return;
      e.preventDefault();
      logViolation("copyAttemptCount", "Copy attempt blocked");
    };

    const handleCut = (e: ClipboardEvent) => {
      if (!isTestActive.current) return;
      e.preventDefault();
      logViolation("copyAttemptCount", "Cut attempt blocked");
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
    };
  }, [logViolation]);

  // Paste detection - block in answer fields
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isTestActive.current) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
        e.preventDefault();
        logViolation("pasteAttemptCount", "Paste attempt blocked");
      }
    };

    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [logViolation]);

  // Right-click prevention
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (!isTestActive.current) return;
      e.preventDefault();
      logViolation("rightClickCount", "Right-click blocked");
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [logViolation]);

  // Dev tools detection
  useEffect(() => {
    if (!screening?.screening_started || screening?.screening_completed) {
      if (devToolsCheckInterval.current) {
        clearInterval(devToolsCheckInterval.current);
      }
      return;
    }

    const checkDevTools = () => {
      const now = Date.now();
      if (now - lastDevToolsCheck.current < 5000) return;
      lastDevToolsCheck.current = now;

      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        logViolation("devToolsOpenCount", "Developer tools detected");
      }
    };

    devToolsCheckInterval.current = setInterval(checkDevTools, 2000);
    checkDevTools();

    return () => {
      if (devToolsCheckInterval.current) {
        clearInterval(devToolsCheckInterval.current);
      }
    };
  }, [screening?.screening_started, screening?.screening_completed, logViolation]);

  // Keyboard shortcut prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTestActive.current) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Prevent dev tools shortcuts
      if (
        e.key === "F12" ||
        (ctrlOrCmd && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase())) ||
        (ctrlOrCmd && e.key.toUpperCase() === "U")
      ) {
        e.preventDefault();
        logViolation("devToolsOpenCount", `Dev tools shortcut: ${e.key}`);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [logViolation]);

  // Update isTestActive ref when test state changes
  useEffect(() => {
    isTestActive.current = !!(screening?.screening_started && !screening?.screening_completed);
  }, [screening?.screening_started, screening?.screening_completed]);

  // Calculate total violations
  const totalViolations = Object.values(violations).reduce((sum, count) => sum + count, 0);

  const handleStartTest = async () => {
    setStarting(true);
    setError(null);

    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    // Update message to show question generation
    setStartingMessage("Generating personalized questions...");

    // Show progress updates
    const progressMessages = [
      "Generating personalized questions...",
      "AI is crafting your test... (this may take up to 90 seconds)",
      "Almost there... preparing your assessment...",
    ];
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = Math.min(messageIndex + 1, progressMessages.length - 1);
      setStartingMessage(progressMessages[messageIndex]);
    }, 20000); // Update every 20 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await competitionsApi.startScreening(competitionId, token);
        clearInterval(messageInterval);
        setStartingMessage("Loading your test...");
        await fetchScreening();
        setStarting(false);
        return; // Success - exit the function
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string } }; code?: string };
        const isTimeout = err.code === "ECONNABORTED" || err.code === "ERR_NETWORK";
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          clearInterval(messageInterval);
          if (isTimeout) {
            setError("The server is taking too long to generate questions. Please try again in a few moments.");
          } else {
            setError(err.response?.data?.detail || "Failed to start test. Please try again.");
          }
          setStarting(false);
          return;
        }

        // Retry after delay
        setStartingMessage(`Connection issue, retrying... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Auto-save draft
    answersApi.saveDraft({ question_id: questionId, candidate_answer: value }).catch(console.error);
  };

  const updateQuestionTime = () => {
    const timeSpent = Math.floor((Date.now() - questionStartTime.current) / 1000);
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === currentQuestionIndex ? { ...q, timeSpent: q.timeSpent + timeSpent } : q
      )
    );
    questionStartTime.current = Date.now();
  };

  const handleNext = () => {
    updateQuestionTime();
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    updateQuestionTime();
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    updateQuestionTime();
    setSubmitting(true);

    try {
      const answerData = questions.map((q) => ({
        question_id: q.id,
        candidate_answer: answers[q.id] || undefined,
        candidate_code: undefined,
        time_spent_seconds: q.timeSpent,
      }));

      const timingData = questions.map((q) => ({
        question_id: q.id,
        time_seconds: q.timeSpent,
        question_category: q.category,
      }));

      await competitionsApi.submitScreening(competitionId, token, {
        answers: answerData,
        time_per_question: timingData,
      });

      router.push(`/competition/results/${token}?competition=${competitionId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Failed to submit test");
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAnsweredCount = () => {
    return questions.filter((q) => answers[q.id]?.trim()).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screening?.screening_completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Test Completed</h2>
            <p className="text-muted-foreground">
              You have already completed this screening test.
            </p>
            <Button onClick={() => router.push(`/competition/results/${token}?competition=${competitionId}`)}>
              View Results
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pre-test state
  if (!screening?.screening_started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Ready to Begin?</CardTitle>
            <CardDescription>{screening?.competition_name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <p><strong>Candidate:</strong> {screening?.candidate_name}</p>
              <p><strong>Duration:</strong> {screening?.test_duration_minutes} minutes</p>
              <p><strong>Questions:</strong> {screening?.questions_count}</p>
            </div>

            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                Once you start, the timer will begin. Make sure you have a stable internet
                connection and can complete the test without interruption.
              </AlertDescription>
            </Alert>

            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>- Answer all questions to the best of your ability</li>
              <li>- You can navigate between questions</li>
              <li>- Your answers are auto-saved as drafts</li>
              <li>- The test will auto-submit when time runs out</li>
            </ul>

            {starting ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  </div>
                  <p className="text-lg font-medium text-center">{startingMessage}</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    We&apos;re preparing personalized questions based on the role requirements.
                    This typically takes 60-90 seconds.
                  </p>
                  <div className="w-full max-w-xs">
                    <Progress value={undefined} className="h-2 animate-pulse" />
                  </div>
                </div>
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={handleStartTest}>
                <Play className="mr-2 w-4 h-4" />
                Start Test
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Test in progress
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-background">
      {/* Anti-cheat warning banner */}
      {showWarningBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-between animate-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-medium">{lastWarningType}</span>
            <span className="text-sm opacity-80">
              Total violations: {totalViolations}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive-foreground hover:bg-destructive-foreground/10"
            onClick={() => setShowWarningBanner(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Header with timer */}
      <div className={`sticky ${showWarningBanner ? "top-12" : "top-0"} z-50 bg-background border-b transition-all`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{screening.competition_name}</span>
            <span className="text-muted-foreground ml-2">- {screening.candidate_name}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Violation indicator */}
            {totalViolations > 0 && (
              <Badge variant="destructive" className="text-xs">
                <ShieldAlert className="w-3 h-3 mr-1" />
                {totalViolations} violation{totalViolations !== 1 ? "s" : ""}
              </Badge>
            )}

            <div className="text-sm">
              {getAnsweredCount()} / {questions.length} answered
            </div>

            {timeRemaining !== null && (
              <Badge variant={timeRemaining < 300 ? "destructive" : "secondary"} className="text-lg px-4 py-1">
                <Clock className="w-4 h-4 mr-2" />
                {formatTime(timeRemaining)}
              </Badge>
            )}
          </div>
        </div>

        <Progress value={(getAnsweredCount() / questions.length) * 100} className="h-1" />
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Question navigation pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => {
                updateQuestionTime();
                setCurrentQuestionIndex(idx);
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                idx === currentQuestionIndex
                  ? "bg-primary text-primary-foreground"
                  : answers[q.id]?.trim()
                  ? "bg-green-500 text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {answers[q.id]?.trim() ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                idx + 1
              )}
            </button>
          ))}
        </div>

        {/* Current Question */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline">{currentQuestion?.category}</Badge>
              <span className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg whitespace-pre-wrap">{currentQuestion?.question_text}</p>

              {currentQuestion?.question_code && (
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{currentQuestion.question_code}</code>
                </pre>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your Answer</label>
              <Textarea
                placeholder="Type your answer here..."
                value={answers[currentQuestion?.id] || ""}
                onChange={(e) => handleAnswerChange(currentQuestion?.id, e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Test"
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScreeningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ScreeningContent />
    </Suspense>
  );
}
