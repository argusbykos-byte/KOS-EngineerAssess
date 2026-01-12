"use client";

import { useState, useEffect, useRef, ClipboardEvent, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CodeEditor, CopyPasteEvent } from "./CodeEditor";
import { CodePlayground } from "./CodePlayground";
import { FeedbackPanel } from "./FeedbackPanel";
import { Question } from "@/types";
import { answersApi, testsApi } from "@/lib/api";
import { getQuestShortName } from "@/lib/utils";
import {
  Loader2,
  Send,
  CheckCircle,
  Lightbulb,
  Clock,
  AlertTriangle,
  Save,
  RefreshCw,
  Cloud,
  CloudOff,
  Edit3,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswerSubmitted: (questionId?: number, score?: number, feedback?: string) => void;
  onSaveStatusChange?: (questionId: number, hasUnsaved: boolean) => void;
  onLocalChange?: (questionId: number, answer: string, code: string) => void;
  onScrollToNext?: () => void;
  testToken?: string;
  feedbackEnabled?: boolean;
}

type SaveStatus = "idle" | "local" | "pending" | "saving" | "saved" | "error" | "retrying";

const STORAGE_KEY_PREFIX = "kos_quest_answer_";

function getStorageKey(testToken: string, questionId: number): string {
  return `${STORAGE_KEY_PREFIX}${testToken}_${questionId}`;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswerSubmitted,
  onSaveStatusChange,
  onLocalChange,
  onScrollToNext,
  testToken,
  feedbackEnabled = false,
}: QuestionCardProps) {
  // Initialize answer state - prioritize server data for submitted questions
  const [answer, setAnswerState] = useState(() => {
    // If already submitted, always use server's submitted answer
    if (question.is_answered && question.answer?.candidate_answer) {
      return question.answer.candidate_answer;
    }

    // For non-submitted questions, try localStorage first
    if (typeof window !== "undefined" && testToken) {
      try {
        const stored = localStorage.getItem(getStorageKey(testToken, question.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          // Use local if it has actual content
          if (parsed.answer) {
            return parsed.answer;
          }
        }
      } catch (e) {
        console.error("Error reading localStorage:", e);
      }
    }
    // Fall back to draft or server data
    return question.draft_answer || question.answer?.candidate_answer || "";
  });

  // Initialize code state - prioritize server data for submitted questions
  const [code, setCodeState] = useState(() => {
    // If already submitted, always use server's submitted code
    if (question.is_answered && question.answer?.candidate_code) {
      return question.answer.candidate_code;
    }

    // For non-submitted questions, try localStorage first
    if (typeof window !== "undefined" && testToken) {
      try {
        const stored = localStorage.getItem(getStorageKey(testToken, question.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          // Use local if it has actual content
          if (parsed.code) {
            return parsed.code;
          }
        }
      } catch (e) {
        console.error("Error reading localStorage:", e);
      }
    }
    // Fall back to draft or server data
    return question.draft_code || question.answer?.candidate_code || "";
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(question.is_answered || false);
  const [showHint, setShowHint] = useState(false);
  const [pasteAttempted, setPasteAttempted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Submission success state - show success message before auto-scroll
  const [showSuccess, setShowSuccess] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Track if content has been edited after submission
  const [editedAfterSubmit, setEditedAfterSubmit] = useState(false);
  const originalSubmittedAnswer = useRef(question.answer?.candidate_answer || "");
  const originalSubmittedCode = useRef(question.answer?.candidate_code || "");

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const lastSyncedAnswerRef = useRef(question.draft_answer || question.answer?.candidate_answer || "");
  const lastSyncedCodeRef = useRef(question.draft_code || question.answer?.candidate_code || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isSyncingRef = useRef(false);
  const maxRetries = 3;

  // Time tracking
  const [timeSpent, setTimeSpent] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const hasStartedRef = useRef(false);

  // Save to localStorage immediately (local-first)
  const saveToLocal = useCallback((newAnswer: string, newCode: string) => {
    if (!testToken) return;

    try {
      const key = getStorageKey(testToken, question.id);
      const data = {
        answer: newAnswer,
        code: newCode,
        timestamp: Date.now(),
        synced: false,
      };
      localStorage.setItem(key, JSON.stringify(data));
      setSaveStatus("local");
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  }, [testToken, question.id]);

  // Sync to backend
  const syncToBackend = useCallback(async (): Promise<boolean> => {
    const answerToSync = answer;
    const codeToSync = code;

    // Skip if already synced
    if (
      answerToSync === lastSyncedAnswerRef.current &&
      codeToSync === lastSyncedCodeRef.current
    ) {
      setSaveStatus("idle");
      return true;
    }

    // Skip if both empty
    if (!answerToSync?.trim() && !codeToSync?.trim()) {
      setSaveStatus("idle");
      return true;
    }

    // Prevent concurrent syncs
    if (isSyncingRef.current) {
      return false;
    }

    isSyncingRef.current = true;
    setSaveStatus(retryCountRef.current > 0 ? "retrying" : "saving");

    try {
      await answersApi.saveDraft({
        question_id: question.id,
        candidate_answer: answerToSync || undefined,
        candidate_code: codeToSync || undefined,
      });

      // Success - update synced state
      lastSyncedAnswerRef.current = answerToSync;
      lastSyncedCodeRef.current = codeToSync;
      retryCountRef.current = 0;
      setSaveStatus("saved");

      // Mark as synced in localStorage
      if (testToken) {
        try {
          const key = getStorageKey(testToken, question.id);
          const data = {
            answer: answerToSync,
            code: codeToSync,
            timestamp: Date.now(),
            synced: true,
          };
          localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
          console.error("Error updating localStorage:", e);
        }
      }

      setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);

      isSyncingRef.current = false;
      return true;
    } catch (error) {
      console.error("Sync error:", error);
      retryCountRef.current++;

      if (retryCountRef.current <= maxRetries) {
        setSaveStatus("retrying");
        isSyncingRef.current = false;

        // Schedule retry with exponential backoff
        setTimeout(() => syncToBackend(), 2000 * retryCountRef.current);
        return false;
      } else {
        setSaveStatus("error");
        retryCountRef.current = 0;
        isSyncingRef.current = false;

        setTimeout(() => {
          setSaveStatus((s) => (s === "error" ? "local" : s));
        }, 5000);
        return false;
      }
    }
  }, [answer, code, question.id, testToken]);

  // Set answer with local-first save
  const setAnswer = useCallback((value: string) => {
    setAnswerState(value);
    saveToLocal(value, code);
    onLocalChange?.(question.id, value, code);
  }, [code, saveToLocal, question.id, onLocalChange]);

  // Set code with local-first save
  const setCode = useCallback((value: string) => {
    setCodeState(value);
    saveToLocal(answer, value);
    onLocalChange?.(question.id, answer, value);
  }, [answer, saveToLocal, question.id, onLocalChange]);

  // Check if content has been edited after submission
  useEffect(() => {
    if (submitted) {
      const hasChanged =
        answer !== originalSubmittedAnswer.current ||
        code !== originalSubmittedCode.current;
      setEditedAfterSubmit(hasChanged);
    }
  }, [answer, code, submitted]);

  // Notify parent about unsaved changes
  useEffect(() => {
    const hasUnsaved =
      answer !== lastSyncedAnswerRef.current ||
      code !== lastSyncedCodeRef.current;
    onSaveStatusChange?.(question.id, hasUnsaved);
  }, [answer, code, question.id, onSaveStatusChange]);

  // Debounced backend sync (30 seconds after last change)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const hasChanges =
      answer !== lastSyncedAnswerRef.current ||
      code !== lastSyncedCodeRef.current;

    if (hasChanges && (answer.trim() || code.trim())) {
      setSaveStatus("pending");

      // Debounce for 30 seconds before syncing
      debounceTimerRef.current = setTimeout(() => {
        syncToBackend();
      }, 30000);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [answer, code, syncToBackend]);

  // Expose save function for parent to call
  useEffect(() => {
    (window as unknown as { __saveQuestion?: Record<number, () => Promise<boolean>> }).__saveQuestion =
      (window as unknown as { __saveQuestion?: Record<number, () => Promise<boolean>> }).__saveQuestion || {};
    (window as unknown as { __saveQuestion: Record<number, () => Promise<boolean>> }).__saveQuestion[question.id] = async () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return syncToBackend();
    };

    return () => {
      delete (window as unknown as { __saveQuestion: Record<number, () => Promise<boolean>> }).__saveQuestion[question.id];
    };
  }, [question.id, syncToBackend]);

  // Sync on blur/visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        syncToBackend();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncToBackend]);

  // Time tracking
  useEffect(() => {
    if (!hasStartedRef.current) {
      startTimeRef.current = Date.now();
      hasStartedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (submitted && !editedAfterSubmit) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setTimeSpent(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [submitted, editedAfterSubmit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle paste blocking for textarea
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setPasteAttempted(true);

    if (testToken) {
      testsApi
        .logAntiCheatEvent(testToken, {
          event_type: "paste_attempt",
          timestamp: new Date().toISOString(),
        })
        .catch(console.error);
    }

    setTimeout(() => setPasteAttempted(false), 3000);
  };

  // Handle copy detection from code editor
  const handleCodeCopy = useCallback((event: CopyPasteEvent) => {
    if (testToken) {
      testsApi
        .logAntiCheatEvent(testToken, {
          event_type: "code_copy",
          timestamp: event.timestamp,
          chars: event.chars,
        })
        .catch(console.error);
    }
  }, [testToken]);

  // Handle paste detection from code editor
  const handleCodePaste = useCallback((event: CopyPasteEvent) => {
    setPasteAttempted(true);

    if (testToken) {
      testsApi
        .logAntiCheatEvent(testToken, {
          event_type: "code_paste",
          timestamp: event.timestamp,
          chars: event.chars,
          lines: event.lines,
        })
        .catch(console.error);
    }

    setTimeout(() => setPasteAttempted(false), 3000);
  }, [testToken]);

  const handleSubmitClick = () => {
    if (!answer.trim() && !code.trim()) return;
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false);
    setSubmissionError(null);

    // Sync any pending changes first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await syncToBackend();

    const finalTimeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);

    // Set loading state and mark as submitted optimistically
    setLoading(true);
    setSubmitted(true);
    setEditedAfterSubmit(false);
    originalSubmittedAnswer.current = answer;
    originalSubmittedCode.current = code;
    lastSyncedAnswerRef.current = answer;
    lastSyncedCodeRef.current = code;

    // Clear local storage immediately (optimistic)
    if (testToken) {
      try {
        localStorage.removeItem(getStorageKey(testToken, question.id));
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
    }

    // Scroll to next question IMMEDIATELY - don't wait for API
    setTimeout(() => {
      if (onScrollToNext) {
        onScrollToNext();
      }
    }, 500); // Small delay for visual transition

    // Fire off API call in background (non-blocking)
    answersApi.submit({
      question_id: question.id,
      candidate_answer: answer || undefined,
      candidate_code: code || undefined,
      time_spent_seconds: finalTimeSpent,
    })
      .then(() => {
        // API succeeded - show brief success state
        setShowSuccess(true);
        setLoading(false);

        // Notify parent to refresh data
        onAnswerSubmitted(question.id);

        // Hide success after a moment
        setTimeout(() => setShowSuccess(false), 1500);
      })
      .catch((error) => {
        console.error("Error submitting answer:", error);
        // Revert optimistic update on error
        setSubmitted(false);
        setLoading(false);
        setSubmissionError("Failed to submit. Please try again.");
        // Clear error after 5 seconds
        setTimeout(() => setSubmissionError(null), 5000);
      });
  };

  // Render save status
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case "local":
        return (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <HardDrive className="w-3 h-3" />
            Saved locally
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Cloud className="w-3 h-3" />
            Saved locally
          </span>
        );
      case "saving":
        return (
          <span className="flex items-center gap-1 text-xs text-blue-400 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Syncing...
          </span>
        );
      case "retrying":
        return (
          <span className="flex items-center gap-1 text-xs text-yellow-500 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Retrying...
          </span>
        );
      case "saved":
        return (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <Save className="w-3 h-3" />
            Synced
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <CloudOff className="w-3 h-3" />
            Sync failed (saved locally)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for AI Evaluation?</DialogTitle>
            <DialogDescription className="pt-2">
              Your answer will be evaluated and scored by AI. You can still edit
              and re-submit this answer before completing the test.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit}>
              <Send className="w-4 h-4 mr-2" />
              Submit for Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card
        className={cn(
          "transition-all duration-300",
          submitted &&
            !editedAfterSubmit &&
            "border-l-4 border-l-green-500 border-green-500/30 bg-green-500/5",
          submitted &&
            editedAfterSubmit &&
            "border-l-4 border-l-yellow-500 border-yellow-500/30 bg-yellow-500/5",
          showSuccess &&
            "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Question {questionNumber}
                {submitted && !editedAfterSubmit && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Submitted
                  </span>
                )}
                {submitted && editedAfterSubmit && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-medium">
                    <Edit3 className="w-3.5 h-3.5" />
                    Edited - Re-submit
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {questionNumber} of {totalQuestions} in{" "}
                {getQuestShortName(question.category)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {formatTime(timeSpent)}
              </Badge>
              <Badge variant="outline">{question.max_score} pts</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-invert max-w-none">
            <p className="text-foreground whitespace-pre-wrap">
              {question.question_text}
            </p>
          </div>

          {question.question_code && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Given Code:</p>
              <pre className="p-4 rounded-lg bg-muted overflow-x-auto text-sm">
                {question.question_code}
              </pre>
            </div>
          )}

          {question.hints && question.hints.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowHint(!showHint)}
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                {showHint ? "Hide Hint" : "Show Hint"}
              </Button>
              {showHint && (
                <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <ul className="text-sm space-y-1">
                    {question.hints.map((hint, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-yellow-500">•</span>
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Your Answer:</p>
              <div className="flex items-center gap-3">
                {renderSaveStatus()}
                {pasteAttempted && (
                  <span className="flex items-center gap-1 text-xs text-red-500 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    Paste is disabled
                  </span>
                )}
              </div>
            </div>

            {question.category === "coding" ? (
              // Use CodePlayground with run capability for coding questions
              <div className="space-y-4">
                <CodePlayground
                  initialCode={code}
                  onChange={setCode}
                  language={question.language || "python"}
                  height="300px"
                  showSampleData={true}
                  onCopyDetected={handleCodeCopy}
                  onPasteDetected={handleCodePaste}
                />
                <Textarea
                  placeholder="Explain your solution..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onPaste={handlePaste}
                  rows={3}
                />
              </div>
            ) : question.category === "code_review" ? (
              // Use basic CodeEditor for code review (no execution needed)
              <div className="space-y-4">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={question.language || "javascript"}
                  readOnly={false}
                  height="250px"
                  onCopyDetected={handleCodeCopy}
                  onPasteDetected={handleCodePaste}
                />
                <Textarea
                  placeholder="Explain the issues you found and your fixes..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onPaste={handlePaste}
                  rows={3}
                />
              </div>
            ) : (
              // Plain textarea for brain_teaser, system_design, signal_processing, general_engineering
              <Textarea
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onPaste={handlePaste}
                rows={6}
              />
            )}

            {/* AI Feedback Panel */}
            <FeedbackPanel
              questionId={question.id}
              answer={answer}
              code={code}
              enabled={feedbackEnabled && !submitted}
            />
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <p className="text-sm font-medium text-green-500">Evaluation complete!</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submissionError && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-500">{submissionError}</p>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {submitted && question.answer?.previous_score !== undefined && (
                <span>Previous score: {question.answer.previous_score}%</span>
              )}
            </div>
            <Button
              onClick={handleSubmitClick}
              disabled={loading || showSuccess || (!answer.trim() && !code.trim())}
              className={cn(
                "transition-all duration-300",
                submitted && !editedAfterSubmit && !showSuccess && "bg-green-600 hover:bg-green-700",
                showSuccess && "bg-green-600"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submitted!
                </>
              ) : submitted && !editedAfterSubmit ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submitted
                </>
              ) : submitted && editedAfterSubmit ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-submit
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Answer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
