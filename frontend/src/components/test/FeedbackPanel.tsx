"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { answersApi } from "@/lib/api";

export interface FeedbackData {
  hints: string[];
  missing_points: string[];
  strengths: string[];
  status: string;
}

interface FeedbackPanelProps {
  questionId: number;
  answer: string;
  code: string;
  enabled: boolean;
  debounceMs?: number;
  cooldownMs?: number;
  minChangeThreshold?: number;
}

type FeedbackStatus = "idle" | "loading" | "success" | "error" | "cooldown";

export function FeedbackPanel({
  questionId,
  answer,
  code,
  enabled,
  debounceMs = 3000, // Reduced from 5000 for better responsiveness
  cooldownMs = 20000, // Reduced from 30000
  minChangeThreshold = 15, // Reduced from 20
}: FeedbackPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Debug logging
  useEffect(() => {
    console.log("[FeedbackPanel] Props:", { questionId, enabled, answerLen: answer?.length, codeLen: code?.length });
  }, [questionId, enabled, answer, code]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>("");
  const isMountedRef = useRef(true);

  // Calculate content change
  const getContentLength = useCallback(() => {
    return (answer || "").length + (code || "").length;
  }, [answer, code]);

  const hasSignificantChange = useCallback(() => {
    const currentContent = `${answer}${code}`;
    const lastContent = lastContentRef.current;
    const diff = Math.abs(currentContent.length - lastContent.length);
    return diff >= minChangeThreshold;
  }, [answer, code, minChangeThreshold]);

  // Fetch feedback from API
  const fetchFeedback = useCallback(async () => {
    console.log("[FeedbackPanel] fetchFeedback called", { enabled, isMounted: isMountedRef.current });
    if (!enabled || !isMountedRef.current) return;

    // Check cooldown
    const now = Date.now();
    if (now - lastFetchTime < cooldownMs) {
      console.log("[FeedbackPanel] In cooldown, skipping");
      setStatus("cooldown");
      return;
    }

    // Check minimum content
    const contentLen = getContentLength();
    if (contentLen < 15) {
      console.log("[FeedbackPanel] Content too short:", contentLen);
      return;
    }

    console.log("[FeedbackPanel] Fetching feedback from API...");
    setStatus("loading");

    try {
      const response = await answersApi.getFeedback({
        question_id: questionId,
        candidate_answer: answer || undefined,
        candidate_code: code || undefined,
      });

      console.log("[FeedbackPanel] API response:", response.data);
      if (!isMountedRef.current) return;

      const data = response.data;
      setFeedback(data);
      setStatus("success");
      setLastFetchTime(Date.now());
      lastContentRef.current = `${answer}${code}`;
    } catch (error: unknown) {
      console.error("[FeedbackPanel] Feedback fetch error:", error);
      if (isMountedRef.current) {
        // Check if it's a 400 error (test not in progress) - silently ignore
        const axiosError = error as { response?: { status?: number } };
        if (axiosError?.response?.status === 400) {
          console.log("[FeedbackPanel] Test not in progress, ignoring");
          setStatus("idle");
          return;
        }
        setStatus("error");
      }
    }
  }, [enabled, questionId, answer, code, lastFetchTime, cooldownMs, getContentLength]);

  // Debounced trigger
  useEffect(() => {
    console.log("[FeedbackPanel] Debounce effect triggered", { enabled, contentLen: getContentLength() });
    if (!enabled) {
      console.log("[FeedbackPanel] Not enabled, skipping");
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only trigger if there's significant change
    if (!hasSignificantChange() && feedback) {
      console.log("[FeedbackPanel] No significant change, skipping");
      return;
    }

    // Don't fetch if content is too short
    if (getContentLength() < 15) {
      console.log("[FeedbackPanel] Content too short for debounce");
      return;
    }

    // Check cooldown before scheduling
    const now = Date.now();
    if (now - lastFetchTime < cooldownMs) {
      console.log("[FeedbackPanel] In cooldown period");
      return;
    }

    console.log("[FeedbackPanel] Scheduling fetch in", debounceMs, "ms");
    debounceTimerRef.current = setTimeout(() => {
      fetchFeedback();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [answer, code, enabled, debounceMs, cooldownMs, fetchFeedback, hasSignificantChange, getContentLength, lastFetchTime, feedback]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Don't render if not enabled
  if (!enabled) {
    console.log("[FeedbackPanel] Not rendering - disabled");
    return null;
  }

  // Show panel earlier to let users know it exists (5 chars instead of 20)
  if (getContentLength() < 5 && !feedback) {
    console.log("[FeedbackPanel] Not rendering - no content yet");
    return null;
  }

  const hasFeedback =
    feedback &&
    (feedback.hints.length > 0 ||
      feedback.missing_points.length > 0 ||
      feedback.strengths.length > 0);

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden bg-gradient-to-r from-blue-50 to-purple-50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-gray-700">AI Feedback</span>
          {status === "loading" && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing...
            </span>
          )}
          {status === "success" && hasFeedback && (
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              New feedback
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {status === "loading" && !feedback && (
            <div className="flex items-center justify-center py-4 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span>AI is analyzing your answer...</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Unable to get feedback. Keep writing!</span>
            </div>
          )}

          {hasFeedback && (
            <>
              {/* Strengths - Green */}
              {feedback.strengths.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-green-700 font-medium text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Strengths</span>
                  </div>
                  <ul className="space-y-1 pl-5">
                    {feedback.strengths.map((strength, index) => (
                      <li
                        key={index}
                        className="text-sm text-green-700 list-disc"
                      >
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hints - Blue */}
              {feedback.hints.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-blue-700 font-medium text-sm">
                    <Lightbulb className="w-4 h-4" />
                    <span>Hints</span>
                  </div>
                  <ul className="space-y-1 pl-5">
                    {feedback.hints.map((hint, index) => (
                      <li key={index} className="text-sm text-blue-700 list-disc">
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Points - Amber */}
              {feedback.missing_points.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-amber-700 font-medium text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Consider Adding</span>
                  </div>
                  <ul className="space-y-1 pl-5">
                    {feedback.missing_points.map((point, index) => (
                      <li
                        key={index}
                        className="text-sm text-amber-700 list-disc"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!hasFeedback && status !== "loading" && status !== "error" && (
            <p className="text-sm text-gray-500 italic">
              Keep typing to receive AI feedback on your answer...
            </p>
          )}

          {/* Status indicator */}
          <div className="flex items-center justify-end text-xs text-gray-400 pt-2 border-t border-gray-200">
            {status === "cooldown" && (
              <span>Feedback will update after cooldown...</span>
            )}
            {status === "success" && feedback?.status === "cached" && (
              <span>Using cached feedback</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
