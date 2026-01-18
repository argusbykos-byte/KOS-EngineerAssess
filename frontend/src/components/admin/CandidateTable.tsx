"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { testsApi, reportsApi } from "@/lib/api";
import { Candidate, TestSummary } from "@/types";
import {
  getCategoryLabel,
  getDifficultyLabel,
  getScoreColor,
  formatPacificDate,
} from "@/lib/utils";
import {
  Play,
  FileText,
  Mail,
  Clock,
  Trash2,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Plus,
  History,
  Calendar,
  AlertTriangle,
  Sparkles,
  Brain,
  RotateCcw,
  MousePointer,
  Clipboard,
} from "lucide-react";
import Link from "next/link";

interface CandidateTableProps {
  candidates: Candidate[];
  onDelete: (id: number) => void;
  onRefresh: () => void;
}

// Helper to format date in Pacific Time
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  return formatPacificDate(dateString, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper to copy text to clipboard with fallbacks for HTTP
async function copyToClipboard(text: string): Promise<boolean> {
  // Try navigator.clipboard first (works on HTTPS and localhost)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed:", err);
    }
  }

  // Fallback: Use execCommand (deprecated but works on HTTP)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    }
  } catch (err) {
    console.warn("execCommand copy failed:", err);
  }

  // Final fallback: Show prompt dialog
  window.prompt("Copy this link manually:", text);
  return false;
}

// Test status badge component
function TestStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    in_progress: { label: "In Progress", className: "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse" },
    completed: { label: "Completed", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    expired: { label: "Expired", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  };

  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}

// Progress messages for AI operations - these cycle indefinitely until API returns
const TEST_PROGRESS_MESSAGES = [
  "Connecting to Kimi2 AI...",
  "Analyzing candidate profile and skills...",
  "Generating brain teaser questions...",
  "Creating personalized coding challenges...",
  "Building code review exercises...",
  "Designing system design problems...",
  "Adding signal processing questions...",
  "Crafting follow-up scenarios...",
  "Reviewing question difficulty balance...",
  "Optimizing question set for candidate level...",
  "Still generating questions (this can take 10-30 minutes)...",
  "AI is generating multiple question batches...",
  "Each category requires a separate AI call...",
  "Complex profiles need more time for personalization...",
  "Still working on personalized questions...",
  "AI is ensuring question quality and relevance...",
  "Almost there, finalizing question set...",
];

const REPORT_PROGRESS_MESSAGES = [
  "Connecting to Kimi2 AI...",
  "Loading candidate answers...",
  "Evaluating brain teaser responses...",
  "Scoring coding challenge solutions...",
  "Reviewing code review answers...",
  "Assessing system design responses...",
  "Analyzing signal processing work...",
  "Calculating section scores...",
  "Generating detailed feedback...",
  "Creating AI summary...",
  "Determining final recommendation...",
  "Still analyzing (this can take 1-3 minutes)...",
  "Almost there, finalizing report...",
];

export function CandidateTable({
  candidates,
  onDelete,
  onRefresh,
}: CandidateTableProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedTestLink, setGeneratedTestLink] = useState<string>("");
  const [generatedForCandidate, setGeneratedForCandidate] = useState<string>("");
  const [expandedCandidates, setExpandedCandidates] = useState<Set<number>>(new Set());
  const [showDeleteTestDialog, setShowDeleteTestDialog] = useState(false);
  const [testToDelete, setTestToDelete] = useState<{ id: number; candidateName: string } | null>(null);

  // Reset integrity monitoring state
  const [resettingTabSwitches, setResettingTabSwitches] = useState<number | null>(null);
  const [resettingPasteAttempts, setResettingPasteAttempts] = useState<number | null>(null);

  // Reinstate disqualified test state
  const [reinstating, setReinstating] = useState<number | null>(null);
  const [showReinstateDialog, setShowReinstateDialog] = useState(false);
  const [testToReinstate, setTestToReinstate] = useState<{
    id: number;
    candidateName: string;
    disqualificationReason: string | null;
    disqualifiedAt: string | null;
  } | null>(null);

  // Mark completed state
  const [markingCompleted, setMarkingCompleted] = useState<number | null>(null);

  // CRITICAL BUG FIX: Global operation state to prevent double-clicks and show progress
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationType, setGenerationType] = useState<"test" | "report" | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCloseOption, setShowCloseOption] = useState(false); // Show close button after timeout
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationInProgressRef = useRef(false); // Mutex to prevent double-clicks
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
      }
    };
  }, []);

  // Format elapsed time as mm:ss
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start progress animation for long-running operations
  // CRITICAL: This animation runs UNTIL stopProgressAnimation is called (when API returns)
  const startProgressAnimation = (type: "test" | "report") => {
    const messages = type === "test" ? TEST_PROGRESS_MESSAGES : REPORT_PROGRESS_MESSAGES;
    let messageIndex = 0;
    let percent = 0;
    let tickCount = 0;

    setProgressMessage(messages[0]);
    setProgressPercent(0);
    setElapsedSeconds(0);

    // Track elapsed time
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Progress animation - cycles through messages, progress caps at 85% until API returns
    progressIntervalRef.current = setInterval(() => {
      tickCount++;

      // Progress increases slowly and caps at 85% - never shows "complete" until API returns
      if (percent < 40) {
        percent += Math.random() * 3 + 1; // Initial progress
      } else if (percent < 60) {
        percent += Math.random() * 2 + 0.5; // Slower mid progress
      } else if (percent < 75) {
        percent += Math.random() * 1 + 0.2; // Even slower
      } else if (percent < 85) {
        percent += Math.random() * 0.5 + 0.1; // Very slow near cap
      }
      percent = Math.min(percent, 85); // Cap at 85% until API actually returns

      // Cycle through messages - loop back to later messages after going through all
      const cycleStart = Math.max(0, messages.length - 5); // Loop through last 5 messages
      if (messageIndex < messages.length - 1) {
        // Go through all messages first
        if (tickCount % 3 === 0) { // Change message every ~2.4 seconds
          messageIndex++;
        }
      } else {
        // After going through all, cycle through the last few
        if (tickCount % 4 === 0) {
          messageIndex = cycleStart + ((messageIndex - cycleStart + 1) % (messages.length - cycleStart));
        }
      }

      setProgressPercent(percent);
      setProgressMessage(messages[messageIndex]);
    }, 800);
  };

  // Stop progress animation - ONLY called when API actually returns
  const stopProgressAnimation = (success: boolean = true) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    if (success) {
      setProgressPercent(100);
      setProgressMessage("Complete!");
    } else {
      setProgressMessage("Cancelled or failed");
    }

    // Brief delay before closing to show completion state
    setTimeout(() => {
      setIsGenerating(false);
      setGenerationType(null);
      setProgressPercent(0);
      setProgressMessage("");
      setElapsedSeconds(0);
      setShowCloseOption(false);
      operationInProgressRef.current = false;
      abortControllerRef.current = null;
    }, success ? 800 : 300);
  };

  // Handle closing after timeout (user wants to check later)
  const handleCloseAndCheckLater = () => {
    stopProgressAnimation(false);
    setLoading(null);
    onRefresh(); // Refresh the candidate list in case the operation succeeded
  };

  // Cancel the current operation
  const handleCancelOperation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopProgressAnimation(false);
  };

  const toggleExpanded = (candidateId: number) => {
    const newExpanded = new Set(expandedCandidates);
    if (newExpanded.has(candidateId)) {
      newExpanded.delete(candidateId);
    } else {
      newExpanded.add(candidateId);
    }
    setExpandedCandidates(newExpanded);
  };

  // Use configured frontend URL for shareable links, fallback to window.location.origin
  const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_FRONTEND_URL || window.location.origin;
  };

  const handleCreateTest = async (candidateId: number) => {
    // BUG 1 FIX: Prevent double-clicks with mutex
    if (operationInProgressRef.current || isGenerating) {
      console.log("Operation already in progress, ignoring click");
      return;
    }
    operationInProgressRef.current = true;

    setLoading(candidateId);
    setIsGenerating(true);
    setGenerationType("test");
    startProgressAnimation("test");

    try {
      const candidate = candidates.find(c => c.id === candidateId);
      const response = await testsApi.create(candidateId);
      const testLink = `${getBaseUrl()}/test/${response.data.access_token}`;

      // Stop progress animation before showing success
      stopProgressAnimation();

      // Show dialog with the link (after a brief delay for progress to show 100%)
      setTimeout(() => {
        setGeneratedTestLink(testLink);
        setGeneratedForCandidate(candidate?.name || "");
        setShowLinkDialog(true);
        onRefresh();
      }, 600);
    } catch (err: unknown) {
      console.error("Error creating test:", err);

      // Type the error properly
      const axiosError = err as {
        code?: string;
        response?: { status?: number; data?: { detail?: string } };
        message?: string;
      };

      // Check if this is a timeout error (backend might still be processing)
      const isTimeout = axiosError.code === "ECONNABORTED" || axiosError.message?.includes("timeout");
      const isNetworkError = axiosError.code === "ERR_NETWORK" || !axiosError.response;

      if (isTimeout || isNetworkError) {
        // Don't show error for timeout - backend may still be processing
        setProgressMessage("Still processing... This is taking longer than expected.");
        setShowCloseOption(true);
        console.log("Request timed out or network error - backend may still be processing");
        return; // Don't stop the animation or reset state
      }

      // For actual HTTP errors, stop and show failure
      stopProgressAnimation(false);
      operationInProgressRef.current = false;
    } finally {
      setLoading(null);
    }
  };

  const copyGeneratedLink = async () => {
    await copyToClipboard(generatedTestLink);
    setCopied("dialog");
    setTimeout(() => setCopied(null), 3000);
  };

  const handleGenerateReport = async (testId: number) => {
    // BUG 1 FIX: Prevent double-clicks with mutex
    if (operationInProgressRef.current || isGenerating) {
      console.log("Operation already in progress, ignoring click");
      return;
    }
    operationInProgressRef.current = true;

    setLoading(testId);
    setIsGenerating(true);
    setGenerationType("report");
    startProgressAnimation("report");

    try {
      await reportsApi.generate(testId);
      stopProgressAnimation();
      // Delay refresh to allow progress UI to show 100%
      setTimeout(() => {
        onRefresh();
      }, 600);
    } catch (err: unknown) {
      console.error("Error generating report:", err);

      // Type the error properly
      const axiosError = err as {
        code?: string;
        response?: { status?: number; data?: { detail?: string } };
        message?: string;
      };

      // Check if this is a timeout error (backend might still be processing)
      const isTimeout = axiosError.code === "ECONNABORTED" || axiosError.message?.includes("timeout");
      const isNetworkError = axiosError.code === "ERR_NETWORK" || !axiosError.response;

      if (isTimeout || isNetworkError) {
        // Don't show error for timeout - backend may still be processing
        setProgressMessage("Still processing... This is taking longer than expected.");
        setShowCloseOption(true);
        console.log("Request timed out or network error - backend may still be processing");
        return; // Don't stop the animation or reset state
      }

      // For actual HTTP errors, stop and show failure
      stopProgressAnimation(false);
      operationInProgressRef.current = false;
    } finally {
      setLoading(null);
    }
  };

  const copyTestLink = async (token: string) => {
    const testLink = `${getBaseUrl()}/test/${token}`;
    await copyToClipboard(testLink);
    setCopied(token);
    setTimeout(() => setCopied(null), 3000);
  };

  const handleDeleteTest = async () => {
    if (!testToDelete) return;

    setDeleting(testToDelete.id);
    try {
      await testsApi.delete(testToDelete.id);
      onRefresh();
    } catch (error) {
      console.error("Error deleting test:", error);
    } finally {
      setDeleting(null);
      setShowDeleteTestDialog(false);
      setTestToDelete(null);
    }
  };

  const confirmDeleteTest = (testId: number, candidateName: string) => {
    setTestToDelete({ id: testId, candidateName });
    setShowDeleteTestDialog(true);
  };

  // Reset tab switches handler
  const handleResetTabSwitches = async (testId: number) => {
    setResettingTabSwitches(testId);
    try {
      await testsApi.resetTabSwitches(testId);
      onRefresh();
    } catch (error) {
      console.error("Error resetting tab switches:", error);
      alert("Failed to reset tab switches");
    } finally {
      setResettingTabSwitches(null);
    }
  };

  // Reset paste attempts handler
  const handleResetPasteAttempts = async (testId: number) => {
    setResettingPasteAttempts(testId);
    try {
      await testsApi.resetPasteAttempts(testId);
      onRefresh();
    } catch (error) {
      console.error("Error resetting paste attempts:", error);
      alert("Failed to reset paste attempts");
    } finally {
      setResettingPasteAttempts(null);
    }
  };

  // Show reinstate confirmation dialog
  const confirmReinstateTest = (
    testId: number,
    candidateName: string,
    disqualificationReason: string | null,
    disqualifiedAt: string | null
  ) => {
    setTestToReinstate({
      id: testId,
      candidateName,
      disqualificationReason,
      disqualifiedAt,
    });
    setShowReinstateDialog(true);
  };

  // Handle reinstate test - give candidate another chance
  const handleReinstateTest = async () => {
    if (!testToReinstate) return;

    setReinstating(testToReinstate.id);
    try {
      await testsApi.reinstateTest(testToReinstate.id);
      onRefresh();
    } catch (error) {
      console.error("Error reinstating test:", error);
      alert("Failed to reinstate test. The test may not be in a disqualified state.");
    } finally {
      setReinstating(null);
      setShowReinstateDialog(false);
      setTestToReinstate(null);
    }
  };

  // Handle mark test as completed
  const handleMarkCompleted = async (testId: number) => {
    setMarkingCompleted(testId);
    try {
      await testsApi.markCompleted(testId);
      onRefresh();
    } catch (error) {
      console.error("Error marking test as completed:", error);
      alert("Failed to mark test as completed.");
    } finally {
      setMarkingCompleted(null);
    }
  };

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No candidates yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a candidate to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render a single test row
  const renderTestRow = (test: TestSummary, isLatest: boolean, candidateName: string) => {
    const hasCompletedTest = test.status === "completed" || test.status === "expired";

    return (
      <div
        key={test.id}
        className={`p-3 rounded-lg ${isLatest ? "bg-muted/50" : "bg-muted/30"} ${!isLatest && "ml-4 border-l-2 border-muted"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TestStatusBadge status={test.status} />
                {isLatest && (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                    Latest
                  </Badge>
                )}
                {test.overall_score !== null && (
                  <span className={`text-sm font-medium ${getScoreColor(test.overall_score)}`}>
                    {test.overall_score.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created: {formatDate(test.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {test.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyTestLink(test.access_token)}
              >
                {copied === test.access_token ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
            )}

            {/* Reset buttons for in_progress tests */}
            {test.status === "in_progress" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-300"
                  onClick={() => handleResetTabSwitches(test.id)}
                  disabled={resettingTabSwitches === test.id}
                  title="Reset tab switch violations"
                >
                  {resettingTabSwitches === test.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <MousePointer className="w-4 h-4 mr-1" />
                      Reset Tabs
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
                  onClick={() => handleResetPasteAttempts(test.id)}
                  disabled={resettingPasteAttempts === test.id}
                  title="Reset paste attempt violations"
                >
                  {resettingPasteAttempts === test.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Clipboard className="w-4 h-4 mr-1" />
                      Reset Pastes
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Reinstate button for disqualified tests */}
            {test.is_disqualified && (
              <Button
                size="sm"
                variant="outline"
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
                onClick={() => confirmReinstateTest(
                  test.id,
                  candidateName,
                  test.disqualification_reason || null,
                  test.disqualified_at || null
                )}
                disabled={reinstating === test.id}
                title={test.disqualification_reason || "Reinstate this disqualified test"}
              >
                {reinstating === test.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reinstate Test
                  </>
                )}
              </Button>
            )}

            {/* Mark Completed button for in_progress tests that have been scored */}
            {test.status === "in_progress" && test.overall_score !== null && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                onClick={() => handleMarkCompleted(test.id)}
                disabled={markingCompleted === test.id}
                title="Mark this test as completed"
              >
                {markingCompleted === test.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Mark Completed
                  </>
                )}
              </Button>
            )}

            {hasCompletedTest && !test.overall_score && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleGenerateReport(test.id)}
                disabled={loading === test.id || isGenerating}
              >
                {loading === test.id ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-1" />
                )}
                {loading === test.id ? "Generating..." : "Generate Report"}
              </Button>
            )}

            {test.overall_score !== null && test.overall_score !== undefined && (
              <Link href={`/admin/reports/${test.id}`}>
                <Button size="sm" variant="secondary">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View Report
                </Button>
              </Link>
            )}

            {/* Delete test button */}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => confirmDeleteTest(test.id, candidateName)}
              disabled={deleting === test.id}
            >
              {deleting === test.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* CRITICAL BUG FIX: AI Operation Progress Dialog - stays open until API returns */}
      <Dialog open={isGenerating} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {generationType === "test" ? (
                <>
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  Generating Test Questions
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 text-blue-500 animate-pulse" />
                  Generating Assessment Report
                </>
              )}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {showCloseOption
                ? "The request is taking longer than expected. The backend may still be processing."
                : generationType === "test"
                  ? "Kimi2 AI is creating personalized questions. This can take 10-30 minutes for complex profiles with multiple categories."
                  : "Kimi2 AI is analyzing answers and generating a detailed assessment. This typically takes 1-3 minutes."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{progressMessage}</span>
                <span className="font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Elapsed: {formatElapsedTime(elapsedSeconds)}</span>
              </div>
              <span className="text-muted-foreground">
                {showCloseOption
                  ? "Backend is still working..."
                  : elapsedSeconds > 600
                    ? "Still working, complex profiles take longer..."
                    : elapsedSeconds > 300
                      ? "Taking a while, please be patient..."
                      : elapsedSeconds > 120
                        ? "AI is working hard on this..."
                        : "Please wait, do not close this window"}
              </span>
            </div>

            {/* Show close option after timeout */}
            {showCloseOption && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  You can close this dialog and check the candidate list later.
                  The test/report may have already been created.
                </p>
                <Button
                  variant="outline"
                  onClick={handleCloseAndCheckLater}
                  className="w-full"
                >
                  Close & Check Candidate List
                </Button>
              </div>
            )}
          </div>
          {!showCloseOption && (
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelOperation}
                className="text-destructive hover:text-destructive"
              >
                Cancel
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Test Confirmation Dialog */}
      <Dialog open={showDeleteTestDialog} onOpenChange={setShowDeleteTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Interview?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will permanently delete this interview for{" "}
              <strong>{testToDelete?.candidateName}</strong>, including all
              answers, scores, and any generated reports. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteTestDialog(false);
                setTestToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTest}
              disabled={deleting === testToDelete?.id}
            >
              {deleting === testToDelete?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Interview
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reinstate Disqualified Test Confirmation Dialog */}
      <Dialog open={showReinstateDialog} onOpenChange={setShowReinstateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Reinstate Disqualified Test?
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <div>
                <strong>Candidate:</strong> {testToReinstate?.candidateName}
              </div>
              {testToReinstate?.disqualifiedAt && (
                <div>
                  <strong>Disqualified:</strong> {formatDate(testToReinstate.disqualifiedAt)}
                </div>
              )}
              {testToReinstate?.disqualificationReason && (
                <div>
                  <strong>Reason:</strong> {testToReinstate.disqualificationReason}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              This will:
            </p>
            <ul className="text-sm space-y-1.5 ml-4">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Change status back to &quot;In Progress&quot;
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Clear ALL violation counters (tabs, pastes, etc.)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Allow candidate to continue their test
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Give them a fresh start
              </li>
            </ul>
            <div className="p-3 bg-muted rounded-lg text-xs">
              <p className="font-medium mb-1">Violation Scoring System:</p>
              <p className="text-muted-foreground">
                Tab switch = 1.0 pt | Paste = 2.0 pt | Copy = 1.0 pt |
                Dev tools = 3.0 pt | Right click = 0.5 pt | Focus loss = 0.5 pt |
                Threshold = 5.0 pts
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReinstateDialog(false);
                setTestToReinstate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleReinstateTest}
              disabled={reinstating === testToReinstate?.id}
            >
              {reinstating === testToReinstate?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Reinstating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Yes, Reinstate Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-green-500" />
              Test Created Successfully
            </DialogTitle>
            <DialogDescription className="pt-2">
              Test link generated for <strong>{generatedForCandidate}</strong>.
              Share this link with the candidate to start their assessment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 items-center">
            <Input
              readOnly
              value={generatedTestLink}
              className="font-mono text-sm"
            />
            <Button size="sm" onClick={copyGeneratedLink}>
              {copied === "dialog" ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {candidates.map((candidate, index) => {
          const tests = candidate.tests || [];
          const latestTest = tests[0]; // Already sorted by created_at desc
          const hasMultipleTests = tests.length > 1;
          const isExpanded = expandedCandidates.has(candidate.id);

          // Difficulty color mapping
          const difficultyColors: Record<string, string> = {
            junior: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            mid: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            senior: "bg-violet-500/20 text-violet-400 border-violet-500/30",
          };

          return (
            <Card
              key={candidate.id}
              className="group relative overflow-hidden animate-fade-in hover:border-primary/30 transition-all duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Hover glow effect */}
              <div className="absolute -inset-px bg-gradient-to-r from-primary/10 via-transparent to-cyan-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <CardHeader className="relative pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-semibold tracking-tight group-hover:text-primary transition-colors">
                      {candidate.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="font-medium">{candidate.email}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-medium ${difficultyColors[candidate.difficulty] || ""}`}>
                      {getDifficultyLabel(candidate.difficulty)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-medium bg-secondary/80">
                      <Clock className="w-3 h-3 mr-1" />
                      {candidate.test_duration_hours}h
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                {/* Category badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {candidate.categories.map((cat, i) => {
                    const categoryColors = [
                      "bg-blue-500/15 text-blue-400 border-blue-500/30",
                      "bg-purple-500/15 text-purple-400 border-purple-500/30",
                      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
                      "bg-pink-500/15 text-pink-400 border-pink-500/30",
                      "bg-orange-500/15 text-orange-400 border-orange-500/30",
                    ];
                    return (
                      <Badge key={cat} variant="outline" className={`text-xs font-medium ${categoryColors[i % categoryColors.length]}`}>
                        {getCategoryLabel(cat)}
                      </Badge>
                    );
                  })}
                </div>

                {/* Extracted skills */}
                {candidate.extracted_skills && candidate.extracted_skills.length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-cyan-500/5 border border-primary/10">
                    <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                      Extracted Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.extracted_skills.slice(0, 8).map((skill) => (
                        <Badge
                          key={skill}
                          className="text-xs bg-gradient-to-r from-primary/20 to-primary/10 text-primary border-primary/30 hover:from-primary/30 hover:to-primary/20 transition-colors cursor-default"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {candidate.extracted_skills.length > 8 && (
                        <Badge variant="secondary" className="text-xs bg-secondary/50">
                          +{candidate.extracted_skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Test History Section */}
                {tests.length > 0 ? (
                  <div className="mb-4">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(candidate.id)}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            Test History ({tests.length} test{tests.length > 1 ? "s" : ""})
                          </p>
                        </div>
                        {hasMultipleTests && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7">
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-1" />
                                  Hide older
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-4 h-4 mr-1" />
                                  Show all
                                </>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>

                      {/* Always show latest test */}
                      {latestTest && renderTestRow(latestTest, true, candidate.name)}

                      {/* Older tests (collapsible) */}
                      {hasMultipleTests && (
                        <CollapsibleContent className="space-y-2 mt-2">
                          {tests.slice(1).map((test) => renderTestRow(test, false, candidate.name))}
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  {/* Create New Test button - always visible */}
                  <Button
                    size="sm"
                    onClick={() => handleCreateTest(candidate.id)}
                    disabled={loading === candidate.id || isGenerating}
                    variant={tests.length > 0 ? "outline" : "default"}
                  >
                    {loading === candidate.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : tests.length > 0 ? (
                      <Plus className="w-4 h-4 mr-1" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    {loading === candidate.id ? "Generating..." : tests.length > 0 ? "New Test" : "Create Test"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive ml-auto"
                    onClick={() => onDelete(candidate.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
