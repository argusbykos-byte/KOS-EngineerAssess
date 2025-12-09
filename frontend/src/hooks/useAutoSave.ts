"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { answersApi } from "@/lib/api";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "retrying";

interface UseAutoSaveOptions {
  questionId: number;
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  saveNow: () => Promise<boolean>;
  updateContent: (answer: string, code: string) => void;
  version: number;
}

export function useAutoSave({
  questionId,
  debounceMs = 1500,
  maxRetries = 3,
  retryDelayMs = 2000,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [version, setVersion] = useState(1);

  // Use refs to track latest values without triggering re-renders
  const latestAnswerRef = useRef<string>("");
  const latestCodeRef = useRef<string>("");
  const lastSavedAnswerRef = useRef<string>("");
  const lastSavedCodeRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  // Compute hasUnsavedChanges - used in return value
  const computeHasUnsavedChanges = () =>
    latestAnswerRef.current !== lastSavedAnswerRef.current ||
    latestCodeRef.current !== lastSavedCodeRef.current;

  // Core save function with retry logic
  const performSave = useCallback(async (): Promise<boolean> => {
    const answerToSave = latestAnswerRef.current;
    const codeToSave = latestCodeRef.current;

    // Skip if nothing to save or already saved
    if (
      answerToSave === lastSavedAnswerRef.current &&
      codeToSave === lastSavedCodeRef.current
    ) {
      setSaveStatus("idle");
      return true;
    }

    // Skip if both are empty
    if (!answerToSave?.trim() && !codeToSave?.trim()) {
      setSaveStatus("idle");
      return true;
    }

    // Prevent concurrent saves
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return false;
    }

    isSavingRef.current = true;
    setSaveStatus(retryCountRef.current > 0 ? "retrying" : "saving");

    try {
      const response = await answersApi.saveDraft({
        question_id: questionId,
        candidate_answer: answerToSave || undefined,
        candidate_code: codeToSave || undefined,
      });

      // Success! Update saved state
      lastSavedAnswerRef.current = answerToSave;
      lastSavedCodeRef.current = codeToSave;
      setLastSavedAt(new Date());
      setVersion(response.data?.version || version + 1);
      setSaveStatus("saved");
      retryCountRef.current = 0;

      // Reset to idle after showing "Saved"
      setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, 2000);

      onSaveSuccess?.();
      isSavingRef.current = false;

      // If there's a pending save, trigger it
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        setTimeout(() => performSave(), 100);
      }

      return true;
    } catch (error) {
      console.error("Auto-save error:", error);

      retryCountRef.current++;

      if (retryCountRef.current <= maxRetries) {
        setSaveStatus("retrying");
        isSavingRef.current = false;

        // Schedule retry
        setTimeout(() => {
          performSave();
        }, retryDelayMs * retryCountRef.current);

        return false;
      } else {
        // Max retries exceeded
        setSaveStatus("error");
        retryCountRef.current = 0;
        onSaveError?.(error as Error);
        isSavingRef.current = false;

        // Reset to idle after showing error
        setTimeout(() => {
          setSaveStatus((current) => (current === "error" ? "idle" : current));
        }, 5000);

        return false;
      }
    }
  }, [questionId, maxRetries, retryDelayMs, onSaveSuccess, onSaveError, version]);

  // Debounced save trigger
  const scheduleSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus("pending");

    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [debounceMs, performSave]);

  // Update content and trigger debounced save
  const updateContent = useCallback(
    (answer: string, code: string) => {
      latestAnswerRef.current = answer;
      latestCodeRef.current = code;

      // Only schedule save if content changed
      if (
        answer !== lastSavedAnswerRef.current ||
        code !== lastSavedCodeRef.current
      ) {
        scheduleSave();
      }
    },
    [scheduleSave]
  );

  // Immediate save (for section change, blur, etc.)
  const saveNow = useCallback(async (): Promise<boolean> => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    return performSave();
  }, [performSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    lastSavedAt,
    hasUnsavedChanges: computeHasUnsavedChanges(),
    saveNow,
    updateContent,
    version,
  };
}
