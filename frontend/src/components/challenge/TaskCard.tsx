"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChallengeTask, TaskResponse } from "@/types";
import { challengesApi } from "@/lib/api";
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
import { CodeEditor } from "@/components/test/CodeEditor";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Send,
  CheckCircle,
  Save,
  RefreshCw,
  Cloud,
  CloudOff,
  Edit3,
  CheckCircle2,
} from "lucide-react";

interface TaskCardProps {
  task: ChallengeTask;
  taskNumber: number;
  totalTasks: number;
  testId: number;
  existingResponse?: TaskResponse | null;
  onTaskSubmitted: () => void;
  onSaveStatusChange?: (taskId: string, hasUnsaved: boolean) => void;
}

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "retrying";

export function TaskCard({
  task,
  taskNumber,
  totalTasks,
  testId,
  existingResponse,
  onTaskSubmitted,
  onSaveStatusChange,
}: TaskCardProps) {
  const [response, setResponse] = useState(existingResponse?.response_text || "");
  const [code, setCode] = useState(existingResponse?.response_code || "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(existingResponse?.is_submitted || false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const [editedAfterSubmit, setEditedAfterSubmit] = useState(false);
  const originalSubmittedResponse = useRef(existingResponse?.response_text || "");
  const originalSubmittedCode = useRef(existingResponse?.response_code || "");

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const latestResponseRef = useRef(response);
  const latestCodeRef = useRef(code);
  const lastSavedResponseRef = useRef(existingResponse?.response_text || "");
  const lastSavedCodeRef = useRef(existingResponse?.response_code || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isSavingRef = useRef(false);
  const maxRetries = 3;

  // Keep refs in sync
  useEffect(() => {
    latestResponseRef.current = response;
    latestCodeRef.current = code;
  }, [response, code]);

  // Check if edited after submission
  useEffect(() => {
    if (submitted) {
      const hasChanged =
        response !== originalSubmittedResponse.current ||
        code !== originalSubmittedCode.current;
      setEditedAfterSubmit(hasChanged);
    }
  }, [response, code, submitted]);

  // Notify parent about unsaved changes
  useEffect(() => {
    const hasUnsaved =
      latestResponseRef.current !== lastSavedResponseRef.current ||
      latestCodeRef.current !== lastSavedCodeRef.current;
    onSaveStatusChange?.(task.id, hasUnsaved);
  }, [response, code, task.id, onSaveStatusChange]);

  // Core save function
  const performSave = useCallback(async (): Promise<boolean> => {
    const responseToSave = latestResponseRef.current;
    const codeToSave = latestCodeRef.current;

    if (
      responseToSave === lastSavedResponseRef.current &&
      codeToSave === lastSavedCodeRef.current
    ) {
      setSaveStatus("idle");
      return true;
    }

    if (!responseToSave?.trim() && !codeToSave?.trim()) {
      setSaveStatus("idle");
      return true;
    }

    if (isSavingRef.current) {
      return false;
    }

    isSavingRef.current = true;
    setSaveStatus(retryCountRef.current > 0 ? "retrying" : "saving");

    try {
      await challengesApi.saveTaskDraft(testId, {
        task_id: task.id,
        response_text: responseToSave || undefined,
        response_code: codeToSave || undefined,
      });

      lastSavedResponseRef.current = responseToSave;
      lastSavedCodeRef.current = codeToSave;
      retryCountRef.current = 0;
      setSaveStatus("saved");

      setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);

      isSavingRef.current = false;
      return true;
    } catch (error) {
      console.error("Auto-save error:", error);
      retryCountRef.current++;

      if (retryCountRef.current <= maxRetries) {
        setSaveStatus("retrying");
        isSavingRef.current = false;
        setTimeout(() => performSave(), 2000 * retryCountRef.current);
        return false;
      } else {
        setSaveStatus("error");
        retryCountRef.current = 0;
        isSavingRef.current = false;
        setTimeout(() => {
          setSaveStatus((s) => (s === "error" ? "idle" : s));
        }, 5000);
        return false;
      }
    }
  }, [testId, task.id]);

  // Debounced auto-save
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const hasChanges =
      response !== lastSavedResponseRef.current ||
      code !== lastSavedCodeRef.current;

    if (hasChanges && (response.trim() || code.trim())) {
      setSaveStatus("pending");
      debounceTimerRef.current = setTimeout(() => {
        performSave();
      }, 1500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [response, code, performSave]);

  // Expose save function for parent
  useEffect(() => {
    type SaveFn = () => Promise<boolean>;
    const win = window as unknown as { __saveTask?: Record<string, SaveFn> };
    win.__saveTask = win.__saveTask || {};
    win.__saveTask[task.id] = async () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return performSave();
    };

    return () => {
      delete win.__saveTask?.[task.id];
    };
  }, [task.id, performSave]);

  const handleSubmitClick = () => {
    if (!response.trim() && !code.trim()) return;
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await performSave();

    setLoading(true);
    try {
      await challengesApi.submitTask(testId, {
        task_id: task.id,
        response_text: response || undefined,
        response_code: code || undefined,
      });

      setSubmitted(true);
      setEditedAfterSubmit(false);
      originalSubmittedResponse.current = response;
      originalSubmittedCode.current = code;
      lastSavedResponseRef.current = response;
      lastSavedCodeRef.current = code;
      onTaskSubmitted();
    } catch (error) {
      console.error("Error submitting task:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case "pending":
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Cloud className="w-3 h-3" />
            Waiting...
          </span>
        );
      case "saving":
        return (
          <span className="flex items-center gap-1 text-xs text-blue-400 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
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
            Saved
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 text-xs text-red-500">
            <CloudOff className="w-3 h-3" />
            Save failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for AI Evaluation?</DialogTitle>
            <DialogDescription className="pt-2">
              Your response will be evaluated and scored by AI. You can still edit
              and re-submit before completing the challenge.
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
          "transition-all duration-300 bg-slate-800/50 border-slate-700",
          submitted &&
            !editedAfterSubmit &&
            "border-l-4 border-l-green-500 border-green-500/30",
          submitted &&
            editedAfterSubmit &&
            "border-l-4 border-l-yellow-500 border-yellow-500/30"
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                  {taskNumber}
                </span>
                {task.title}
                {submitted && !editedAfterSubmit && (
                  <Badge variant="outline" className="border-green-500 text-green-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Submitted
                  </Badge>
                )}
                {submitted && editedAfterSubmit && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                    <Edit3 className="w-3 h-3 mr-1" />
                    Edited
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Task {taskNumber} of {totalTasks}
              </CardDescription>
            </div>
            {renderSaveStatus()}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">{task.description}</p>

          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
              Requirements
            </p>
            <ul className="space-y-1">
              {task.requirements.map((req, i) => (
                <li
                  key={i}
                  className="text-sm text-slate-300 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white">Your Response:</p>
            </div>

            <div className="space-y-4">
              <Textarea
                placeholder="Describe your approach, solution, and reasoning..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={6}
                className="bg-slate-900/50 border-slate-700 text-slate-200"
              />

              <div>
                <p className="text-sm text-slate-400 mb-2">Code (if applicable):</p>
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  language="python"
                  readOnly={false}
                  height="200px"
                />
              </div>
            </div>
          </div>

          {existingResponse?.feedback && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400 uppercase tracking-wide mb-1">
                AI Feedback
              </p>
              <p className="text-sm text-slate-300">{existingResponse.feedback}</p>
              {existingResponse.score !== null && (
                <p className="text-sm text-blue-400 mt-2">
                  Score: {existingResponse.score}%
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSubmitClick}
              disabled={loading || (!response.trim() && !code.trim())}
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
                  Submit Response
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
