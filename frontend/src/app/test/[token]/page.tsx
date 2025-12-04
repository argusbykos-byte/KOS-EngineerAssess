"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { testsApi } from "@/lib/api";
import { TestWithQuestions, Question } from "@/types";
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
import { SectionNav } from "@/components/test/SectionNav";
import { QuestionCard } from "@/components/test/QuestionCard";
import { getCategoryLabel, getDifficultyLabel } from "@/lib/utils";
import {
  Loader2,
  Brain,
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
} from "lucide-react";

type ViewState = "loading" | "welcome" | "test" | "completed" | "expired" | "error";

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [test, setTest] = useState<TestWithQuestions | null>(null);
  const [currentSection, setCurrentSection] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);

  // Anti-cheat state
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const isTestActive = useRef(false);

  const fetchTest = useCallback(async () => {
    try {
      const response = await testsApi.getByToken(token);
      setTest(response.data);

      if (response.data.status === "pending") {
        setViewState("welcome");
      } else if (response.data.status === "in_progress") {
        setViewState("test");
        const sections = Object.keys(response.data.questions_by_section);
        if (sections.length > 0) {
          setCurrentSection(sections[0]);
        }
      } else if (response.data.status === "completed") {
        setViewState("completed");
      } else if (response.data.status === "expired") {
        setViewState("expired");
      }
    } catch (err) {
      console.error("Error fetching test:", err);
      setError("Test not found or invalid link");
      setViewState("error");
    }
  }, [token]);

  useEffect(() => {
    fetchTest();
  }, [fetchTest]);

  // Tab/window switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTestActive.current) {
        // User switched away from the tab
        const timestamp = new Date().toISOString();
        setTabSwitchCount((prev) => prev + 1);

        // Log to backend
        testsApi.logAntiCheatEvent(token, {
          event_type: "tab_switch",
          timestamp,
        }).catch(console.error);
      } else if (!document.hidden && isTestActive.current) {
        // User returned to the tab - show warning
        setShowTabWarning(true);
      }
    };

    const handleWindowBlur = () => {
      if (isTestActive.current) {
        const timestamp = new Date().toISOString();
        setTabSwitchCount((prev) => prev + 1);

        testsApi.logAntiCheatEvent(token, {
          event_type: "tab_switch",
          timestamp,
        }).catch(console.error);
      }
    };

    const handleWindowFocus = () => {
      if (isTestActive.current) {
        setShowTabWarning(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [token]);

  // Update isTestActive when viewState changes
  useEffect(() => {
    isTestActive.current = viewState === "test";
  }, [viewState]);

  const handleStartTest = async () => {
    console.log("Starting test with token:", token);
    setIsStarting(true);
    try {
      const response = await testsApi.start(token);
      console.log("Start test response:", response);
      await fetchTest();
    } catch (err: unknown) {
      console.error("Error starting test:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start test";
      setError(errorMessage);
      alert(`Failed to start test: ${errorMessage}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCompleteTest = async () => {
    if (!confirm("Are you sure you want to submit your test? You cannot make changes after submission.")) {
      return;
    }

    try {
      await testsApi.complete(token);
      setViewState("completed");
    } catch (err) {
      console.error("Error completing test:", err);
    }
  };

  const handleTimeExpired = async () => {
    try {
      await testsApi.complete(token);
      setViewState("expired");
    } catch (err) {
      console.error("Error on time expire:", err);
    }
  };

  const handleAnswerSubmitted = () => {
    fetchTest();
  };

  if (viewState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "welcome" && test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome, {test.candidate_name}!</CardTitle>
            <CardDescription>
              KOS AI Engineering Assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {test.duration_hours} hour(s)
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                <span className="text-muted-foreground">Difficulty</span>
                <Badge variant="outline">
                  {getDifficultyLabel(test.difficulty)}
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <p className="text-muted-foreground mb-2">Categories</p>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(test.questions_by_section).map((cat) => (
                    <Badge key={cat} variant="secondary">
                      {getCategoryLabel(cat)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
              <p className="text-sm text-yellow-500">
                <strong>Important:</strong> Once you start, the timer will begin.
                Make sure you have a stable internet connection and enough time
                to complete the assessment.
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
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
                  <Play className="w-5 h-5 mr-2" />
                  Start Assessment
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Assessment Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for completing the assessment. Your responses have been
              submitted and will be reviewed shortly.
            </p>
            <p className="text-sm text-muted-foreground">
              You may close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Time Expired</h2>
            <p className="text-muted-foreground mb-6">
              Your assessment time has ended. All submitted answers have been
              saved and will be reviewed.
            </p>
            <p className="text-sm text-muted-foreground">
              You may close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "test" && test) {
    const sections = test.questions_by_section;
    const currentQuestions = sections[currentSection] || [];
    const totalQuestions = Object.values(sections).flat().length;
    const answeredQuestions = Object.values(sections)
      .flat()
      .filter((q) => q.is_answered).length;
    const progress = (answeredQuestions / totalQuestions) * 100;

    return (
      <div className="min-h-screen bg-background">
        {/* Tab Switch Warning Dialog */}
        <Dialog open={showTabWarning} onOpenChange={setShowTabWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-yellow-500">
                <Eye className="w-5 h-5" />
                Tab Switch Detected
              </DialogTitle>
              <DialogDescription className="pt-2">
                <p className="mb-2">
                  You left the test window. This activity has been logged and
                  will be visible to the reviewer.
                </p>
                <p className="text-yellow-500 font-medium">
                  Total tab switches: {tabSwitchCount}
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowTabWarning(false)}>
                I Understand, Continue Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                <span className="font-bold">KOS AI</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {test.candidate_name}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {tabSwitchCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  {tabSwitchCount} tab switches
                </Badge>
              )}

              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {answeredQuestions}/{totalQuestions}
                </span>
              </div>

              {test.time_remaining_seconds !== null && (
                <Timer
                  initialSeconds={test.time_remaining_seconds}
                  onExpire={handleTimeExpired}
                />
              )}

              <Button onClick={handleCompleteTest}>
                Submit Test
              </Button>
            </div>
          </div>

          <div className="container pb-2">
            <Progress value={progress} className="h-1" />
          </div>
        </header>

        {/* Main Content */}
        <div className="container py-6">
          <div className="grid lg:grid-cols-[250px_1fr] gap-6">
            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sections</CardTitle>
                </CardHeader>
                <CardContent>
                  <SectionNav
                    sections={sections}
                    currentSection={currentSection}
                    onSectionChange={setCurrentSection}
                  />
                </CardContent>
              </Card>
            </aside>

            {/* Questions */}
            <main className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {getCategoryLabel(currentSection)}
                </h2>
                <p className="text-muted-foreground">
                  {currentQuestions.length} questions in this section
                </p>
              </div>

              {currentQuestions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  questionNumber={index + 1}
                  totalQuestions={currentQuestions.length}
                  onAnswerSubmitted={handleAnswerSubmitted}
                  testToken={token}
                />
              ))}
            </main>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
