"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { testsApi, answersApi, feedbackApi } from "@/lib/api";
import { TestWithQuestions } from "@/types";
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
import {
  getQuestTitle,
  getQuestDeity,
  getQuestDifficultyLabel,
  getDifficultyLabel,
} from "@/lib/utils";
import { QUEST_BRANDING, QUEST_CATEGORIES } from "@/config/questTheme";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Scroll,
  Hammer,
  Flame,
  Building2,
  Activity,
  Sparkles,
  Swords,
  Save,
  AlertCircle,
  Cloud,
  CloudOff,
  WifiOff,
  Send,
  MessageSquare,
  Wrench,
  Coffee,
} from "lucide-react";
import { BreakOverlay } from "@/components/test/BreakOverlay";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import {
  AntiCheatWarningModal,
  DisqualificationModal,
} from "@/components/test/AntiCheatWarningModal";
import { AgreementScreen } from "@/components/test/AgreementScreen";

type ViewState = "loading" | "welcome" | "agreement" | "test" | "completed" | "expired" | "error";

// localStorage keys for test state persistence
const TEST_STATE_KEY_PREFIX = "kos_test_state_";
const SUBMISSION_STATE_KEY_PREFIX = "kos_submission_state_";

function getTestStateKey(token: string): string {
  return `${TEST_STATE_KEY_PREFIX}${token}`;
}

function getSubmissionStateKey(token: string): string {
  return `${SUBMISSION_STATE_KEY_PREFIX}${token}`;
}

interface PersistedTestState {
  currentSection: string;
  feedbackEnabled: boolean;
  timestamp: number;
}

interface SubmissionState {
  [questionId: number]: {
    submitted: boolean;
    score?: number;
    feedback?: string;
    submittedAt: number;
  };
}

export default function TestPage() {
  const params = useParams();
  const token = params.token as string;

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [test, setTest] = useState<TestWithQuestions | null>(null);

  // Initialize currentSection from localStorage if available
  const [currentSection, setCurrentSection] = useState<string>(() => {
    if (typeof window !== "undefined" && token) {
      try {
        const stored = localStorage.getItem(getTestStateKey(token));
        if (stored) {
          const parsed: PersistedTestState = JSON.parse(stored);
          // Only restore if state is recent (within 24 hours)
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            return parsed.currentSection || "";
          }
        }
      } catch (e) {
        console.error("Error reading test state from localStorage:", e);
      }
    }
    return "";
  });
  const [error, setError] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);

  // Section navigation state
  const [showSavingOverlay, setShowSavingOverlay] = useState(false);

  // Complete test confirmation
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [incompleteInfo, setIncompleteInfo] = useState<{
    total: number;
    answered: number;
    sections: { name: string; answered: number; total: number }[];
  } | null>(null);

  // Track unsaved changes across questions
  const unsavedQuestionsRef = useRef<Set<number>>(new Set());
  const hasUnsavedChanges = useRef(false);

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const localAnswersRef = useRef<Map<number, { answer: string; code: string }>>(new Map());

  // Batch submit state
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [batchSubmitProgress, setBatchSubmitProgress] = useState({ current: 0, total: 0 });
  const [showBatchSubmitConfirm, setShowBatchSubmitConfirm] = useState(false);

  // Question card refs for scrolling
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Live feedback state - persisted in localStorage (default ON for better UX)
  const [feedbackEnabled, setFeedbackEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      // Try test-specific state first
      if (token) {
        try {
          const stored = localStorage.getItem(getTestStateKey(token));
          if (stored) {
            const parsed: PersistedTestState = JSON.parse(stored);
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000 && parsed.feedbackEnabled !== undefined) {
              return parsed.feedbackEnabled;
            }
          }
        } catch (e) {
          console.error("Error reading feedback state:", e);
        }
      }
      // Fall back to global preference
      const stored = localStorage.getItem("kos_feedback_enabled");
      // Default to true if not set
      return stored === null ? true : stored === "true";
    }
    return true;
  });

  // Persist feedback preference
  const handleFeedbackToggle = (enabled: boolean) => {
    setFeedbackEnabled(enabled);
    localStorage.setItem("kos_feedback_enabled", enabled.toString());
    // Also save to test-specific state
    saveTestState(currentSection, enabled);
  };

  // Submission state for tracking AI evaluation results (variable unused but setter is used)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [submissionState, setSubmissionState] = useState<SubmissionState>(() => {
    if (typeof window !== "undefined" && token) {
      try {
        const stored = localStorage.getItem(getSubmissionStateKey(token));
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error("Error reading submission state:", e);
      }
    }
    return {};
  });

  // Save test state to localStorage
  const saveTestState = useCallback((section: string, feedback?: boolean) => {
    if (!token) return;
    try {
      const state: PersistedTestState = {
        currentSection: section,
        feedbackEnabled: feedback ?? feedbackEnabled,
        timestamp: Date.now(),
      };
      localStorage.setItem(getTestStateKey(token), JSON.stringify(state));
    } catch (e) {
      console.error("Error saving test state:", e);
    }
  }, [token, feedbackEnabled]);

  // Save submission state to localStorage
  const saveSubmissionState = useCallback((questionId: number, data: { submitted: boolean; score?: number; feedback?: string }) => {
    if (!token) return;
    setSubmissionState(prev => {
      const newState = {
        ...prev,
        [questionId]: {
          ...data,
          submittedAt: Date.now(),
        },
      };
      try {
        localStorage.setItem(getSubmissionStateKey(token), JSON.stringify(newState));
      } catch (e) {
        console.error("Error saving submission state:", e);
      }
      return newState;
    });
  }, [token]);

  // Clear test state on completion
  const clearTestState = useCallback(() => {
    if (!token) return;
    try {
      localStorage.removeItem(getTestStateKey(token));
      localStorage.removeItem(getSubmissionStateKey(token));
      // Also clear any question-specific localStorage entries
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`kos_quest_answer_${token}`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error("Error clearing test state:", e);
    }
  }, [token]);

  // Anti-cheat state (legacy - kept for backward compatibility)
  const [showTabWarning, setShowTabWarning] = useState(false);
  const isTestActive = useRef(false);

  // Mutex to prevent multiple simultaneous complete calls
  const isCompletingRef = useRef(false);

  // Break state - must be before antiCheat hook since it's used there
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const [remainingBreakTime, setRemainingBreakTime] = useState(0);
  const [maxSingleBreak, setMaxSingleBreak] = useState(1200); // 20 min default
  const [isStartingBreak, setIsStartingBreak] = useState(false);
  const [isEndingBreak, setIsEndingBreak] = useState(false);

  // Enhanced anti-cheat modal state
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false);
  const [warningData, setWarningData] = useState({ warningCount: 0, violationScore: 0 });
  const [showDisqualification, setShowDisqualification] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState("");

  // Enhanced anti-cheat hook
  const antiCheat = useAntiCheat({
    token,
    isActive: viewState === "test" && !isOnBreak,
    onWarning: (warningCount, violationScore) => {
      setWarningData({ warningCount, violationScore });
      setShowAntiCheatWarning(true);
    },
    onDisqualification: (reason) => {
      setDisqualificationReason(reason);
      setShowDisqualification(true);
    },
  });

  // Improvement feedback state (shown on completion)
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    message: string;
    autoImplemented: boolean;
  } | null>(null);

  const fetchTest = useCallback(async () => {
    try {
      const response = await testsApi.getByToken(token);
      setTest(response.data);

      // Check for disqualification FIRST - block everything if disqualified
      if (response.data.is_disqualified) {
        setDisqualificationReason(
          response.data.disqualification_reason || "Your assessment was terminated due to integrity violations."
        );
        setShowDisqualification(true);
        setViewState("test"); // Keep in test view but modal will block everything
        return; // Don't process further
      }

      // Update break state from response
      setIsOnBreak(response.data.is_on_break || false);
      setRemainingBreakTime(response.data.remaining_break_time_seconds || 0);
      setMaxSingleBreak(response.data.max_single_break_seconds || 1200);

      if (response.data.status === "pending") {
        // Check if NDA is signed, if not show agreement screen first
        if (!response.data.nda_signature) {
          setViewState("agreement");
        } else {
          setViewState("welcome");
        }
      } else if (response.data.status === "in_progress") {
        setViewState("test");
        const sections = Object.keys(response.data.questions_by_section);
        if (sections.length > 0) {
          // Check if currentSection (from localStorage) is valid for this test
          if (!currentSection || !sections.includes(currentSection)) {
            setCurrentSection(sections[0]);
            saveTestState(sections[0]);
          }
        }
      } else if (response.data.status === "on_break") {
        setViewState("test");
        setIsOnBreak(true);
        // Set break start time to now if not already set (approximate)
        if (!breakStartTime) {
          setBreakStartTime(new Date());
        }
        const sections = Object.keys(response.data.questions_by_section);
        if (sections.length > 0 && (!currentSection || !sections.includes(currentSection))) {
          setCurrentSection(sections[0]);
          saveTestState(sections[0]);
        }
      } else if (response.data.status === "completed") {
        setViewState("completed");
        // Clear persisted state on completion
        clearTestState();
      } else if (response.data.status === "expired") {
        setViewState("expired");
        // Clear persisted state on expiry
        clearTestState();
      }
    } catch (err) {
      console.error("Error fetching test:", err);
      setError("Test not found or invalid link");
      setViewState("error");
    }
  }, [token, currentSection, saveTestState, clearTestState, breakStartTime]);

  useEffect(() => {
    fetchTest();
  }, [fetchTest]);

  // Beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current && viewState === "test") {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [viewState]);

  // Tab/window switch detection (legacy - show warning on focus return)
  // The actual tracking is done by useAntiCheat hook
  useEffect(() => {
    const handleWindowFocus = () => {
      if (isTestActive.current && antiCheat.tabSwitchCount > 0) {
        setShowTabWarning(true);
      }
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [antiCheat.tabSwitchCount]);

  useEffect(() => {
    isTestActive.current = viewState === "test";
  }, [viewState]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Track local answer changes
  const handleLocalChange = useCallback((questionId: number, answer: string, code: string) => {
    localAnswersRef.current.set(questionId, { answer, code });
    setPendingCount(localAnswersRef.current.size);
  }, []);

  // Scroll to next unanswered question after submission
  const handleScrollToNext = useCallback((currentQuestionId: number) => {
    if (!test) return;

    const sections = test.questions_by_section;
    const sectionNames = Object.keys(sections);
    const currentSectionIndex = sectionNames.indexOf(currentSection);

    // Find the next unanswered question in current section
    const currentQuestions = sections[currentSection] || [];
    const currentIndex = currentQuestions.findIndex(q => q.id === currentQuestionId);

    // Look for next unanswered in current section
    for (let i = currentIndex + 1; i < currentQuestions.length; i++) {
      if (!currentQuestions[i].is_answered) {
        const ref = questionRefs.current.get(currentQuestions[i].id);
        if (ref) {
          ref.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
    }

    // If all remaining questions in section are answered, check next sections
    for (let s = currentSectionIndex + 1; s < sectionNames.length; s++) {
      const sectionQuestions = sections[sectionNames[s]] || [];
      const hasUnanswered = sectionQuestions.some(q => !q.is_answered);
      if (hasUnanswered) {
        // Switch to next section with unanswered questions
        setCurrentSection(sectionNames[s]);
        saveTestState(sectionNames[s]);
        return;
      }
    }

    // Check earlier sections too (wrap around)
    for (let s = 0; s < currentSectionIndex; s++) {
      const sectionQuestions = sections[sectionNames[s]] || [];
      const hasUnanswered = sectionQuestions.some(q => !q.is_answered);
      if (hasUnanswered) {
        setCurrentSection(sectionNames[s]);
        saveTestState(sectionNames[s]);
        return;
      }
    }

    // All questions answered - stay on current question
  }, [test, currentSection, saveTestState]);

  // Handle save status changes from QuestionCard
  const handleSaveStatusChange = useCallback((questionId: number, hasUnsaved: boolean) => {
    if (hasUnsaved) {
      unsavedQuestionsRef.current.add(questionId);
    } else {
      unsavedQuestionsRef.current.delete(questionId);
    }
    hasUnsavedChanges.current = unsavedQuestionsRef.current.size > 0;
  }, []);

  // Save all questions in current section before navigation
  const saveAllQuestionsInSection = async (): Promise<boolean> => {
    const saveQuestions = (window as unknown as { __saveQuestion?: Record<number, () => Promise<boolean>> }).__saveQuestion;
    if (!saveQuestions) return true;

    const currentQuestions = test?.questions_by_section[currentSection] || [];
    const savePromises = currentQuestions
      .filter((q) => saveQuestions[q.id])
      .map((q) => saveQuestions[q.id]());

    try {
      const results = await Promise.all(savePromises);
      return results.every(Boolean);
    } catch {
      return false;
    }
  };

  // Handle section change with save guard
  const handleSectionChange = async (newSection: string) => {
    if (newSection === currentSection) return;

    // Check if there are unsaved changes
    if (unsavedQuestionsRef.current.size > 0) {
      setShowSavingOverlay(true);

      await saveAllQuestionsInSection();

      setShowSavingOverlay(false);
      setCurrentSection(newSection);
    } else {
      setCurrentSection(newSection);
    }
    // Persist section change to localStorage
    saveTestState(newSection);
  };

  const handleStartTest = async () => {
    setIsStarting(true);
    try {
      await testsApi.start(token);
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

  const handleCompleteTestClick = () => {
    if (!test) return;

    // Calculate incomplete sections info
    const sections = test.questions_by_section;
    const totalQuestions = Object.values(sections).flat().length;
    const answeredQuestions = Object.values(sections)
      .flat()
      .filter((q) => q.is_answered).length;

    const sectionInfo = Object.entries(sections).map(([name, questions]) => ({
      name: getQuestDeity(name),
      answered: questions.filter((q) => q.is_answered).length,
      total: questions.length,
    }));

    setIncompleteInfo({
      total: totalQuestions,
      answered: answeredQuestions,
      sections: sectionInfo,
    });
    setShowCompleteConfirm(true);
  };

  const handleConfirmComplete = async () => {
    // Prevent multiple simultaneous complete calls
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    setShowCompleteConfirm(false);

    // Save all questions first
    setShowSavingOverlay(true);
    await saveAllQuestionsInSection();
    setShowSavingOverlay(false);

    try {
      await testsApi.complete(token);
      // Clear persisted state on completion
      clearTestState();
      setViewState("completed");
    } catch (err) {
      console.error("Error completing test:", err);
      // Still transition to completed if already completed (idempotent)
      if (viewState !== "completed") {
        setViewState("completed");
        clearTestState();
      }
    } finally {
      isCompletingRef.current = false;
    }
  };

  const handleTimeExpired = async () => {
    // Prevent multiple simultaneous complete calls
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    // Save all before expiry
    await saveAllQuestionsInSection();

    try {
      await testsApi.complete(token);
      // Clear persisted state on expiry
      clearTestState();
      setViewState("expired");
    } catch (err) {
      console.error("Error on time expire:", err);
      // Still transition to expired if already completed (idempotent)
      if (viewState !== "expired" && viewState !== "completed") {
        setViewState("expired");
        clearTestState();
      }
    } finally {
      isCompletingRef.current = false;
    }
  };

  const handleAnswerSubmitted = (questionId?: number, score?: number, feedback?: string) => {
    if (questionId) {
      saveSubmissionState(questionId, { submitted: true, score, feedback });
    }
    fetchTest();
  };

  // Handle improvement feedback submission
  const handleFeedbackSubmit = async () => {
    if (feedbackText.trim().length < 10) return;

    setFeedbackSubmitting(true);
    try {
      const response = await feedbackApi.submit({
        raw_feedback: feedbackText,
        test_access_token: token,
      });
      setFeedbackResult({
        message: response.data.message,
        autoImplemented: response.data.auto_implemented,
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setFeedbackResult({
        message: "Thank you for your feedback! It has been recorded.",
        autoImplemented: false,
      });
      setFeedbackSubmitted(true);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Handle starting a break
  const handleStartBreak = async () => {
    if (isStartingBreak || remainingBreakTime <= 0) return;

    setIsStartingBreak(true);
    try {
      const response = await testsApi.startBreak(token);
      if (response.data.success) {
        setIsOnBreak(true);
        setBreakStartTime(new Date(response.data.break_start_time));
        setRemainingBreakTime(response.data.remaining_break_time_seconds);
        setMaxSingleBreak(response.data.max_single_break_seconds);
      }
    } catch (err) {
      console.error("Error starting break:", err);
      alert("Failed to start break. Please try again.");
    } finally {
      setIsStartingBreak(false);
    }
  };

  // Handle ending a break
  const handleEndBreak = async () => {
    if (isEndingBreak) return;

    setIsEndingBreak(true);
    try {
      const response = await testsApi.endBreak(token);
      if (response.data.success) {
        setIsOnBreak(false);
        setBreakStartTime(null);
        setRemainingBreakTime(response.data.remaining_break_time_seconds);
        // Refresh test data to get updated timer
        await fetchTest();
      }
    } catch (err) {
      console.error("Error ending break:", err);
      alert("Failed to end break. Please try again.");
    } finally {
      setIsEndingBreak(false);
    }
  };

  // Format break time for display
  const formatBreakTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  // Sync all pending answers to backend
  const syncAllAnswers = async () => {
    if (localAnswersRef.current.size === 0) return;

    setSyncStatus("syncing");
    const drafts = Array.from(localAnswersRef.current.entries()).map(([questionId, data]) => ({
      question_id: questionId,
      candidate_answer: data.answer || undefined,
      candidate_code: data.code || undefined,
    }));

    try {
      await answersApi.batchSaveDrafts(drafts);
      localAnswersRef.current.clear();
      setPendingCount(0);
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (error) {
      console.error("Batch sync error:", error);
      setSyncStatus("error");
    }
  };

  // Batch submit all answers for AI evaluation
  const handleBatchSubmit = async () => {
    if (!test) return;
    setShowBatchSubmitConfirm(false);

    // Get all questions with answers
    const allQuestions = Object.values(test.questions_by_section).flat();
    const answersToSubmit = allQuestions.filter(q => {
      const local = localAnswersRef.current.get(q.id);
      const hasLocal = local && (local.answer?.trim() || local.code?.trim());
      const hasDraft = q.draft_answer?.trim() || q.draft_code?.trim();
      const hasExisting = q.answer?.candidate_answer?.trim() || q.answer?.candidate_code?.trim();
      return hasLocal || hasDraft || hasExisting;
    });

    if (answersToSubmit.length === 0) {
      alert("No answers to submit");
      return;
    }

    setIsBatchSubmitting(true);
    setBatchSubmitProgress({ current: 0, total: answersToSubmit.length });

    try {
      const batchData = answersToSubmit.map(q => {
        const local = localAnswersRef.current.get(q.id);
        return {
          question_id: q.id,
          candidate_answer: local?.answer || q.draft_answer || q.answer?.candidate_answer || undefined,
          candidate_code: local?.code || q.draft_code || q.answer?.candidate_code || undefined,
        };
      });

      // Submit in batches of 5 to show progress
      const batchSize = 5;
      for (let i = 0; i < batchData.length; i += batchSize) {
        const batch = batchData.slice(i, i + batchSize);
        await answersApi.batchSubmit(batch);
        setBatchSubmitProgress({ current: Math.min(i + batchSize, batchData.length), total: batchData.length });
      }

      // Clear local storage and refresh
      localAnswersRef.current.clear();
      setPendingCount(0);
      await fetchTest();
    } catch (error) {
      console.error("Batch submit error:", error);
      alert("Some answers failed to submit. Please try again.");
    } finally {
      setIsBatchSubmitting(false);
      setBatchSubmitProgress({ current: 0, total: 0 });
    }
  };

  // Get unsubmitted answer count
  const getUnsubmittedCount = () => {
    if (!test) return 0;
    return Object.values(test.questions_by_section)
      .flat()
      .filter(q => !q.is_answered && (
        localAnswersRef.current.get(q.id)?.answer?.trim() ||
        localAnswersRef.current.get(q.id)?.code?.trim() ||
        q.draft_answer?.trim() ||
        q.draft_code?.trim()
      )).length;
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

  // Agreement Screen - shown before welcome when NDA not signed
  if (viewState === "agreement" && test) {
    return (
      <AgreementScreen
        candidateName={test.candidate_name}
        testToken={token}
        onComplete={() => {
          // Refresh test data to get updated NDA status
          fetchTest();
        }}
      />
    );
  }

  const categoryIcons: Record<string, React.ElementType> = {
    brain_teaser: Scroll,
    coding: Hammer,
    code_review: Flame,
    system_design: Building2,
    signal_processing: Activity,
    general_engineering: Wrench,
  };

  if (viewState === "welcome" && test) {
    const sections = Object.keys(test.questions_by_section);

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <div className="text-center mb-8">
            <div className="mb-4">
              <Image
                src="/kos-quest-logo.png"
                alt="KOS Quest"
                width={200}
                height={200}
                className="mx-auto"
                priority
              />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {QUEST_BRANDING.name}
            </h1>
            <p className="text-amber-400 text-lg font-medium">
              {QUEST_BRANDING.tagline}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {QUEST_BRANDING.subtitle}
            </p>
          </div>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
            <CardHeader className="text-center border-b border-slate-700 pb-6">
              <CardTitle className="text-2xl text-white">
                {QUEST_BRANDING.welcome.title}, {test.candidate_name}!
              </CardTitle>
              <CardDescription className="text-slate-300 text-base mt-2">
                {QUEST_BRANDING.welcome.intro}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                {QUEST_BRANDING.welcome.instructions.map((instruction, i) => (
                  <div key={i} className="flex items-start gap-3 text-slate-300">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-sm">{instruction}</span>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400 text-sm">Quest Duration</span>
                  </div>
                  <span className="text-xl font-bold text-white">
                    {test.duration_hours} hour(s)
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-400 text-sm">Challenge Level</span>
                  </div>
                  <span className="text-xl font-bold text-white">
                    {getQuestDifficultyLabel(test.difficulty)}
                  </span>
                  <span className="text-slate-400 text-sm ml-2">
                    ({getDifficultyLabel(test.difficulty)})
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Scroll className="w-5 h-5 text-amber-400" />
                  Your Trials Await
                </h3>
                <div className="grid gap-3">
                  {sections.map((cat) => {
                    const category = QUEST_CATEGORIES[cat];
                    const Icon = categoryIcons[cat] || Scroll;
                    const questionCount = test.questions_by_section[cat]?.length || 0;

                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-amber-500/50 transition-colors"
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category?.color.primary + "20" }}
                        >
                          <Icon
                            className="w-6 h-6"
                            style={{ color: category?.color.primary }}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white">
                            {category?.title || cat}
                          </p>
                          <p className="text-sm text-slate-400">
                            {category?.shortDescription}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-slate-600 text-slate-300"
                        >
                          {questionCount} challenges
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
                <p className="text-sm text-amber-400">
                  <strong>Prepare yourself:</strong> Once you begin your quest, the sands of time will flow.
                  Ensure you have a stable connection and sufficient time to complete all trials.
                </p>
              </div>

              {/* Live AI Feedback Toggle */}
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <Label htmlFor="feedback-toggle" className="text-white font-medium cursor-pointer">
                        Enable Live AI Feedback
                      </Label>
                      <p className="text-sm text-slate-400">
                        Get real-time hints and suggestions while you answer
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="feedback-toggle"
                    checked={feedbackEnabled}
                    onCheckedChange={handleFeedbackToggle}
                  />
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold"
                size="lg"
                onClick={handleStartTest}
                disabled={isStarting}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Preparing the Arena...
                  </>
                ) : (
                  <>
                    <Swords className="w-5 h-5 mr-2" />
                    Begin Your Quest
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-slate-500 text-sm mt-6">
            {QUEST_BRANDING.name} - {QUEST_BRANDING.subtitle}
          </p>
        </div>
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
            <p className="text-muted-foreground mb-4">
              Thank you for completing the assessment. Your responses have been
              submitted and will be reviewed shortly.
            </p>

            {/* Feedback Section */}
            {!feedbackSubmitted ? (
              <div className="mt-6 pt-6 border-t text-left">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Help Us Improve
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Before you go, we&apos;d love your feedback: What would you suggest
                  to improve this interview system?
                </p>
                <Textarea
                  placeholder="Share your suggestions... (e.g., new question topics, UI improvements, technical terms that need explanation)"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="min-h-[100px] mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleFeedbackSubmit}
                    disabled={feedbackSubmitting || feedbackText.trim().length < 10}
                    className="flex-1"
                  >
                    {feedbackSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Feedback
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFeedbackSubmitted(true)}
                  >
                    Skip
                  </Button>
                </div>
                {feedbackText.trim().length > 0 && feedbackText.trim().length < 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Please enter at least 10 characters
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t">
                {feedbackResult && (
                  <div className={`p-4 rounded-lg ${feedbackResult.autoImplemented ? 'bg-green-500/10 border border-green-500/20' : 'bg-primary/10 border border-primary/20'}`}>
                    <p className="text-sm">
                      {feedbackResult.autoImplemented && (
                        <Sparkles className="w-4 h-4 inline mr-2 text-green-500" />
                      )}
                      {feedbackResult.message}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  You may close this window now.
                </p>
              </div>
            )}
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
        {/* Saving Overlay */}
        {showSavingOverlay && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <Card className="bg-background border shadow-lg">
              <CardContent className="pt-6 flex items-center gap-3">
                <Save className="w-5 h-5 animate-pulse text-primary" />
                <span>Saving your answers...</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Switch Warning Dialog */}
        <Dialog open={showTabWarning} onOpenChange={setShowTabWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-yellow-500">
                <Eye className="w-5 h-5" />
                Activity Detected
              </DialogTitle>
              <DialogDescription className="pt-2">
                <p className="mb-2">
                  You left the test window. This activity has been logged and
                  will be visible to the reviewer.
                </p>
                <div className="space-y-1 text-sm">
                  <p className="text-yellow-500 font-medium">
                    Tab switches: {antiCheat.tabSwitchCount}
                  </p>
                  {antiCheat.copyAttemptCount > 0 && (
                    <p className="text-yellow-500">Copy attempts: {antiCheat.copyAttemptCount}</p>
                  )}
                  {antiCheat.pasteAttemptCount > 0 && (
                    <p className="text-yellow-500">Paste events: {antiCheat.pasteAttemptCount}</p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowTabWarning(false)}>
                I Understand, Continue Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Enhanced Anti-Cheat Warning Modal */}
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

        {/* Complete Test Confirmation Dialog */}
        <Dialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Submit Test?
              </DialogTitle>
              <DialogDescription className="pt-2">
                Are you sure you want to submit your test? You cannot make changes after submission.
              </DialogDescription>
            </DialogHeader>

            {incompleteInfo && (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Progress:</span>
                  <span className={incompleteInfo.answered < incompleteInfo.total ? "text-yellow-500" : "text-green-500"}>
                    {incompleteInfo.answered} / {incompleteInfo.total} answered
                  </span>
                </div>

                {incompleteInfo.sections.some((s) => s.answered < s.total) && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-500 font-medium mb-2">
                      Incomplete Sections:
                    </p>
                    <ul className="text-sm space-y-1">
                      {incompleteInfo.sections
                        .filter((s) => s.answered < s.total)
                        .map((s, i) => (
                          <li key={i} className="flex justify-between text-muted-foreground">
                            <span>{s.name}&apos;s Challenge</span>
                            <span>{s.answered}/{s.total}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCompleteConfirm(false)}>
                Continue Editing
              </Button>
              <Button onClick={handleConfirmComplete}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Submit Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Submit Confirmation Dialog */}
        <Dialog open={showBatchSubmitConfirm} onOpenChange={setShowBatchSubmitConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Submit All Answers?
              </DialogTitle>
              <DialogDescription className="pt-2">
                This will submit all your draft answers for AI evaluation at once.
                You can still edit and re-submit individual answers afterward.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                <strong>{getUnsubmittedCount()}</strong> answers will be submitted for evaluation.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowBatchSubmitConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={handleBatchSubmit}>
                <Send className="w-4 h-4 mr-2" />
                Submit All Answers
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Break Overlay */}
        <BreakOverlay
          isVisible={isOnBreak}
          breakStartTime={breakStartTime}
          maxSingleBreakSeconds={maxSingleBreak}
          remainingBreakTimeSeconds={remainingBreakTime}
          onResumeTest={handleEndBreak}
          isResuming={isEndingBreak}
        />

        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Image
                  src="/kos-quest-logo.png"
                  alt="KOS Quest"
                  width={32}
                  height={32}
                  className="rounded"
                />
                <span className="font-bold">KOS Quest</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {test.candidate_name}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Sync Status Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                {!isOnline ? (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <WifiOff className="w-3.5 h-3.5" />
                    Offline
                  </span>
                ) : syncStatus === "syncing" ? (
                  <span className="flex items-center gap-1 text-blue-400 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Syncing...
                  </span>
                ) : syncStatus === "synced" ? (
                  <span className="flex items-center gap-1 text-green-500">
                    <Cloud className="w-3.5 h-3.5" />
                    Synced
                  </span>
                ) : syncStatus === "error" ? (
                  <span className="flex items-center gap-1 text-red-500">
                    <CloudOff className="w-3.5 h-3.5" />
                    Sync failed
                  </span>
                ) : pendingCount > 0 ? (
                  <button
                    onClick={syncAllAnswers}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    {pendingCount} pending
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Cloud className="w-3.5 h-3.5" />
                    Saved
                  </span>
                )}
              </div>

              {antiCheat.tabSwitchCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  {antiCheat.tabSwitchCount} violations
                </Badge>
              )}

              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {answeredQuestions}/{totalQuestions}
                </span>
              </div>

              {test.time_remaining_seconds !== null && !isOnBreak && (
                <Timer
                  initialSeconds={test.time_remaining_seconds}
                  onExpire={handleTimeExpired}
                />
              )}

              {/* Take Break Button */}
              {remainingBreakTime > 0 && !isOnBreak && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartBreak}
                  disabled={isStartingBreak}
                  className="text-amber-600 border-amber-500/50 hover:bg-amber-500/10"
                >
                  {isStartingBreak ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Coffee className="w-4 h-4 mr-2" />
                  )}
                  Break ({formatBreakTime(remainingBreakTime)})
                </Button>
              )}

              {/* Batch Submit Button */}
              {getUnsubmittedCount() > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBatchSubmitConfirm(true)}
                  disabled={isBatchSubmitting}
                >
                  {isBatchSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {batchSubmitProgress.current}/{batchSubmitProgress.total}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit All ({getUnsubmittedCount()})
                    </>
                  )}
                </Button>
              )}

              <Button onClick={handleCompleteTestClick}>
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
                  <CardTitle className="text-base">Your Trials</CardTitle>
                </CardHeader>
                <CardContent>
                  <SectionNav
                    sections={sections}
                    currentSection={currentSection}
                    onSectionChange={handleSectionChange}
                  />
                </CardContent>
              </Card>
            </aside>

            {/* Questions */}
            <main className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {getQuestTitle(currentSection)}
                </h2>
                <p className="text-muted-foreground">
                  {currentQuestions.length} challenges in {getQuestDeity(currentSection)}&apos;s trial
                </p>
              </div>

              {currentQuestions.map((question, index) => (
                <div
                  key={question.id}
                  ref={(el) => {
                    if (el) {
                      questionRefs.current.set(question.id, el);
                    } else {
                      questionRefs.current.delete(question.id);
                    }
                  }}
                >
                  <QuestionCard
                    question={question}
                    questionNumber={index + 1}
                    totalQuestions={currentQuestions.length}
                    onAnswerSubmitted={handleAnswerSubmitted}
                    onSaveStatusChange={handleSaveStatusChange}
                    onLocalChange={handleLocalChange}
                    onScrollToNext={() => handleScrollToNext(question.id)}
                    testToken={token}
                    feedbackEnabled={feedbackEnabled}
                  />
                </div>
              ))}
            </main>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
