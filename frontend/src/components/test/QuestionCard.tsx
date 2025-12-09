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
import { CodeEditor } from "./CodeEditor";
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
  onAnswerSubmitted: () => void;
  onSaveStatusChange?: (questionId: number, hasUnsaved: boolean) => void;
  onLocalChange?: (questionId: number, answer: string, code: string) => void;
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
  testToken,
  feedbackEnabled = false,
}: QuestionCardProps) {
  // Initialize from localStorage first, then fall back to server data
  const [answer, setAnswerState] = useState(() => {
    if (typeof window !== "undefined" && testToken) {
      try {
        const stored = localStorage.getItem(getStorageKey(testToken, question.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          // Use local if it's newer or has unsaved changes
          if (!parsed.synced || parsed.answer || parsed.code) {
            return parsed.answer || "";
          }
        }
      } catch (e) {
        console.error("Error reading localStorage:", e);
      }
    }
    return question.draft_answer || question.answer?.candidate_answer || "";
  });

  const [code, setCodeState] = useState(() => {
    if (typeof window !== "undefined" && testToken) {
      try {
        const stored = localStorage.getItem(getStorageKey(testToken, question.id));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!parsed.synced || parsed.answer || parsed.code) {
            return parsed.code || "";
          }
        }
      } catch (e) {
        console.error("Error reading localStorage:", e);
      }
    }
    return question.draft_code || question.answer?.candidate_code || "";
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(question.is_answered || false);
  const [showHint, setShowHint] = useState(false);
  const [pasteAttempted, setPasteAttempted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

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

  const isCodeQuestion =
    question.category === "coding" || question.category === "code_review";

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

  // Handle paste blocking
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

  const handleSubmitClick = () => {
    if (!answer.trim() && !code.trim()) return;
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false);

    // Sync any pending changes first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await syncToBackend();

    const finalTimeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);

    setLoading(true);
    try {
      await answersApi.submit({
        question_id: question.id,
        candidate_answer: answer || undefined,
        candidate_code: code || undefined,
        time_spent_seconds: finalTimeSpent,
      });

      setSubmitted(true);
      setEditedAfterSubmit(false);
      originalSubmittedAnswer.current = answer;
      originalSubmittedCode.current = code;
      lastSyncedAnswerRef.current = answer;
      lastSyncedCodeRef.current = code;

      // Clear local storage after successful submit
      if (testToken) {
        try {
          localStorage.removeItem(getStorageKey(testToken, question.id));
        } catch (e) {
          console.error("Error clearing localStorage:", e);
        }
      }

      onAnswerSubmitted();
    } catch (error) {
      console.error("Error submitting answer:", error);
    } finally {
      setLoading(false);
    }
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
            "border-l-4 border-l-yellow-500 border-yellow-500/30 bg-yellow-500/5"
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

            {isCodeQuestion ? (
              <div className="space-y-4">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language={question.category === "coding" ? "python" : "javascript"}
                  readOnly={false}
                  height="250px"
                />
                <Textarea
                  placeholder="Explain your solution..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onPaste={handlePaste}
                  rows={3}
                />
              </div>
            ) : (
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

          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {submitted && question.answer?.previous_score !== undefined && (
                <span>Previous score: {question.answer.previous_score}%</span>
              )}
            </div>
            <Button
              onClick={handleSubmitClick}
              disabled={loading || (!answer.trim() && !code.trim())}
              className={cn(
                "transition-all duration-300",
                submitted && !editedAfterSubmit && "bg-green-600 hover:bg-green-700"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evaluating...
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
