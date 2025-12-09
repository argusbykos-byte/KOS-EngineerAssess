"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { testsApi, challengesApi } from "@/lib/api";
import { ChallengeSpec, ChallengeSubmission } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { ChallengeIntro, ChallengeView, TaskCard, DeliverablesSection } from "@/components/challenge";
import { QUEST_BRANDING } from "@/config/questTheme";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Swords,
  ListChecks,
  FileText,
  Send,
  Save,
  AlertCircle,
} from "lucide-react";

type ViewState = "loading" | "welcome" | "challenge" | "completed" | "expired" | "error";
type TabState = "overview" | "tasks" | "deliverables";

interface TestData {
  id: number;
  candidate_name: string;
  candidate_email: string;
  status: string;
  duration_hours: number;
  time_remaining_seconds: number | null;
  track: string | null;
}

export default function ChallengePage() {
  const params = useParams();
  const token = params.token as string;

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [test, setTest] = useState<TestData | null>(null);
  const [challengeSpec, setChallengeSpec] = useState<ChallengeSpec | null>(null);
  const [submission, setSubmission] = useState<ChallengeSubmission | null>(null);
  const [error, setError] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabState>("overview");

  // Submit confirmation
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSavingOverlay, setShowSavingOverlay] = useState(false);

  // Unsaved tracking
  const unsavedTasksRef = useRef<Set<string>>(new Set());
  const hasUnsavedChanges = useRef(false);

  // Anti-cheat
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const isTestActive = useRef(false);

  const fetchTest = useCallback(async () => {
    try {
      const response = await testsApi.getByToken(token);
      const testData = response.data;
      setTest({
        id: testData.id,
        candidate_name: testData.candidate_name,
        candidate_email: testData.candidate_email,
        status: testData.status,
        duration_hours: testData.duration_hours,
        time_remaining_seconds: testData.time_remaining_seconds,
        track: testData.track || null,
      });

      if (testData.status === "pending") {
        setViewState("welcome");
        // Fetch challenge spec if track is available
        if (testData.track) {
          const specResponse = await challengesApi.getSpec(testData.track);
          setChallengeSpec(specResponse.data);
        }
      } else if (testData.status === "in_progress") {
        setViewState("challenge");
        // Fetch challenge spec and submission
        if (testData.track) {
          const [specResponse, submissionResponse] = await Promise.all([
            challengesApi.getSpec(testData.track),
            challengesApi.getSubmission(testData.id).catch(() => ({ data: null })),
          ]);
          setChallengeSpec(specResponse.data);
          setSubmission(submissionResponse.data);
        }
      } else if (testData.status === "completed") {
        setViewState("completed");
      } else if (testData.status === "expired") {
        setViewState("expired");
      }
    } catch (err) {
      console.error("Error fetching test:", err);
      setError("Challenge not found or invalid link");
      setViewState("error");
    }
  }, [token]);

  useEffect(() => {
    fetchTest();
  }, [fetchTest]);

  // Beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current && viewState === "challenge") {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [viewState]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTestActive.current) {
        setTabSwitchCount((prev) => prev + 1);
        testsApi.logAntiCheatEvent(token, {
          event_type: "tab_switch",
          timestamp: new Date().toISOString(),
        }).catch(console.error);
      } else if (!document.hidden && isTestActive.current) {
        setShowTabWarning(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [token]);

  useEffect(() => {
    isTestActive.current = viewState === "challenge";
  }, [viewState]);

  const handleSaveStatusChange = useCallback((taskId: string, hasUnsaved: boolean) => {
    if (hasUnsaved) {
      unsavedTasksRef.current.add(taskId);
    } else {
      unsavedTasksRef.current.delete(taskId);
    }
    hasUnsavedChanges.current = unsavedTasksRef.current.size > 0;
  }, []);

  const handleStartChallenge = async () => {
    setIsStarting(true);
    try {
      await testsApi.start(token);
      await fetchTest();
    } catch (err: unknown) {
      console.error("Error starting challenge:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start challenge";
      setError(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmitChallengeClick = () => {
    setShowSubmitConfirm(true);
  };

  const saveAllTasks = async (): Promise<boolean> => {
    type SaveFn = () => Promise<boolean>;
    const saveTasks = (window as unknown as { __saveTask?: Record<string, SaveFn> }).__saveTask;
    if (!saveTasks) return true;

    const savePromises = Object.values(saveTasks).map((fn) => fn());
    try {
      const results = await Promise.all(savePromises);
      return results.every(Boolean);
    } catch {
      return false;
    }
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false);
    setShowSavingOverlay(true);

    await saveAllTasks();

    setIsSubmitting(true);
    try {
      if (test) {
        await challengesApi.submitChallenge(test.id);
      }
      await testsApi.complete(token);
      setViewState("completed");
    } catch (err) {
      console.error("Error submitting challenge:", err);
    } finally {
      setIsSubmitting(false);
      setShowSavingOverlay(false);
    }
  };

  const handleTimeExpired = async () => {
    await saveAllTasks();
    try {
      if (test) {
        await challengesApi.submitChallenge(test.id);
      }
      await testsApi.complete(token);
      setViewState("expired");
    } catch (err) {
      console.error("Error on time expire:", err);
    }
  };

  const handleTaskSubmitted = () => {
    fetchTest();
  };

  const handleDeliverableChanged = () => {
    fetchTest();
  };

  // Calculate progress
  const getProgress = () => {
    if (!challengeSpec || !submission) return 0;
    const submittedTasks = submission.task_responses.filter((t) => t.is_submitted).length;
    const submittedDeliverables = submission.deliverables.length;
    const totalItems = challengeSpec.tasks.length + challengeSpec.deliverables.length;
    return ((submittedTasks + submittedDeliverables) / totalItems) * 100;
  };

  if (viewState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4">
        <Card className="max-w-md bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error</h2>
            <p className="text-slate-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "welcome" && test) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <div className="text-center mb-8">
            <Image
              src="/kos-quest-logo.png"
              alt="KOS Quest"
              width={200}
              height={200}
              className="mx-auto mb-4"
              priority
            />
            <h1 className="text-4xl font-bold text-white mb-2">
              {QUEST_BRANDING.name}
            </h1>
            <p className="text-amber-400 text-lg font-medium">
              Technical Challenge Assessment
            </p>
          </div>

          <ChallengeIntro
            candidateName={test.candidate_name}
            challenge={challengeSpec}
          />

          {challengeSpec && <ChallengeView challenge={challengeSpec} />}

          <div className="mt-8">
            <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 mb-4">
              <p className="text-sm text-amber-400">
                <strong>Important:</strong> Once you begin, the timer will start.
                You have {test.duration_hours} hour(s) to complete this challenge.
                Ensure you have a stable connection.
              </p>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold"
              size="lg"
              onClick={handleStartChallenge}
              disabled={isStarting}
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Swords className="w-5 h-5 mr-2" />
                  Begin Challenge
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4">
        <Card className="max-w-lg w-full bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Challenge Complete!</h2>
            <p className="text-slate-400 mb-6">
              Thank you for completing the challenge. Your submission has been received
              and a presentation will be generated for your interview.
            </p>
            <p className="text-sm text-slate-500">
              You may close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4">
        <Card className="max-w-lg w-full bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Time Expired</h2>
            <p className="text-slate-400 mb-6">
              Your challenge time has ended. All submitted work has been saved
              and will be reviewed.
            </p>
            <p className="text-sm text-slate-500">
              You may close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewState === "challenge" && test && challengeSpec) {
    const progress = getProgress();
    const submittedTasks = submission?.task_responses.filter((t) => t.is_submitted).length || 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
        {/* Saving Overlay */}
        {showSavingOverlay && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6 flex items-center gap-3">
                <Save className="w-5 h-5 animate-pulse text-amber-400" />
                <span className="text-white">Saving your work...</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Switch Warning */}
        <Dialog open={showTabWarning} onOpenChange={setShowTabWarning}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-yellow-500">
                <Eye className="w-5 h-5" />
                Tab Switch Detected
              </DialogTitle>
              <DialogDescription className="pt-2 text-slate-400">
                <p className="mb-2">
                  You left the challenge window. This activity has been logged.
                </p>
                <p className="text-yellow-500 font-medium">
                  Total tab switches: {tabSwitchCount}
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowTabWarning(false)}>
                I Understand
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit Confirmation */}
        <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Submit Challenge?
              </DialogTitle>
              <DialogDescription className="pt-2 text-slate-400">
                Are you sure you want to submit? You cannot make changes after submission.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Tasks Submitted:</span>
                <span className={submittedTasks < challengeSpec.tasks.length ? "text-yellow-500" : "text-green-500"}>
                  {submittedTasks} / {challengeSpec.tasks.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Deliverables:</span>
                <span className={(submission?.deliverables.length || 0) < challengeSpec.deliverables.length ? "text-yellow-500" : "text-green-500"}>
                  {submission?.deliverables.length || 0} / {challengeSpec.deliverables.length}
                </span>
              </div>

              {submittedTasks < challengeSpec.tasks.length && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-400">
                    Warning: Not all tasks have been submitted for evaluation.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)} className="border-slate-600">
                Continue Working
              </Button>
              <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Submit Challenge
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Image
                src="/kos-quest-logo.png"
                alt="KOS Quest"
                width={32}
                height={32}
                className="rounded"
              />
              <div>
                <span className="font-bold text-white">KOS Quest Challenge</span>
                <p className="text-xs text-slate-400">{test.candidate_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {tabSwitchCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  {tabSwitchCount} switches
                </Badge>
              )}

              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                Progress: {Math.round(progress)}%
              </div>

              {test.time_remaining_seconds !== null && (
                <Timer
                  initialSeconds={test.time_remaining_seconds}
                  onExpire={handleTimeExpired}
                />
              )}

              <Button onClick={handleSubmitChallengeClick}>
                Submit Challenge
              </Button>
            </div>
          </div>

          <div className="container pb-2">
            <Progress value={progress} className="h-1" />
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-slate-700 bg-slate-900/50">
          <div className="container flex gap-1 pt-2">
            {[
              { id: "overview" as const, label: "Overview", icon: ListChecks },
              { id: "tasks" as const, label: "Tasks", icon: ListChecks },
              { id: "deliverables" as const, label: "Deliverables", icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-800 text-white border-b-2 border-amber-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="container py-6">
          <div className="max-w-4xl mx-auto">
            {activeTab === "overview" && (
              <ChallengeView challenge={challengeSpec} />
            )}

            {activeTab === "tasks" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Challenge Tasks
                  </h2>
                  <p className="text-slate-400">
                    Complete each task and submit for AI evaluation
                  </p>
                </div>

                {challengeSpec.tasks.map((task, index) => {
                  const existingResponse = submission?.task_responses.find(
                    (r) => r.task_id === task.id
                  );
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      taskNumber={index + 1}
                      totalTasks={challengeSpec.tasks.length}
                      testId={test.id}
                      existingResponse={existingResponse}
                      onTaskSubmitted={handleTaskSubmitted}
                      onSaveStatusChange={handleSaveStatusChange}
                    />
                  );
                })}
              </div>
            )}

            {activeTab === "deliverables" && (
              <DeliverablesSection
                testId={test.id}
                deliverableSpecs={challengeSpec.deliverables}
                existingDeliverables={submission?.deliverables || []}
                onDeliverableChanged={handleDeliverableChanged}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
