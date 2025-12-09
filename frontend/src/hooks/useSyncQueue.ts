"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { answersApi } from "@/lib/api";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

interface QueuedSave {
  questionId: number;
  answer: string;
  code: string;
  timestamp: number;
  retryCount: number;
}

interface UseSyncQueueOptions {
  testToken: string;
  syncIntervalMs?: number;
  maxRetries?: number;
  onSyncComplete?: (questionId: number) => void;
  onSyncError?: (questionId: number, error: Error) => void;
}

interface UseSyncQueueReturn {
  syncStatus: SyncStatus;
  pendingCount: number;
  queueSave: (questionId: number, answer: string, code: string) => void;
  syncNow: () => Promise<void>;
  syncAll: () => Promise<{ success: number; failed: number }>;
  isOnline: boolean;
}

export function useSyncQueue({
  testToken,
  syncIntervalMs = 30000, // 30 seconds default
  maxRetries = 3,
  onSyncComplete,
  onSyncError,
}: UseSyncQueueOptions): UseSyncQueueReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [isOnline, setIsOnline] = useState(true);

  const queueRef = useRef<Map<number, QueuedSave>>(new Map());
  const isSyncingRef = useRef(false);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedRef = useRef<Map<number, { answer: string; code: string }>>(
    new Map()
  );

  // Track pending count for UI
  const [pendingCount, setPendingCount] = useState(0);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("idle");
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setSyncStatus("offline");
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Queue a save operation
  const queueSave = useCallback((questionId: number, answer: string, code: string) => {
    const lastSynced = lastSyncedRef.current.get(questionId);

    // Skip if content hasn't changed from last synced
    if (lastSynced && lastSynced.answer === answer && lastSynced.code === code) {
      return;
    }

    const existing = queueRef.current.get(questionId);
    queueRef.current.set(questionId, {
      questionId,
      answer,
      code,
      timestamp: Date.now(),
      retryCount: existing?.retryCount || 0,
    });

    setPendingCount(queueRef.current.size);
  }, []);

  // Sync a single item from the queue
  const syncItem = useCallback(async (item: QueuedSave): Promise<boolean> => {
    try {
      await answersApi.saveDraft({
        question_id: item.questionId,
        candidate_answer: item.answer || undefined,
        candidate_code: item.code || undefined,
      });

      // Update last synced state
      lastSyncedRef.current.set(item.questionId, {
        answer: item.answer,
        code: item.code,
      });

      // Remove from queue on success
      queueRef.current.delete(item.questionId);
      setPendingCount(queueRef.current.size);

      onSyncComplete?.(item.questionId);
      return true;
    } catch (error) {
      console.error(`Sync error for question ${item.questionId}:`, error);

      // Increment retry count
      const updated = { ...item, retryCount: item.retryCount + 1 };

      if (updated.retryCount >= maxRetries) {
        // Max retries reached, remove from queue and report error
        queueRef.current.delete(item.questionId);
        setPendingCount(queueRef.current.size);
        onSyncError?.(item.questionId, error as Error);
      } else {
        // Keep in queue for retry
        queueRef.current.set(item.questionId, updated);
      }

      return false;
    }
  }, [maxRetries, onSyncComplete, onSyncError]);

  // Sync all pending items
  const syncAll = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (isSyncingRef.current || !isOnline || queueRef.current.size === 0) {
      return { success: 0, failed: 0 };
    }

    isSyncingRef.current = true;
    setSyncStatus("syncing");

    let success = 0;
    let failed = 0;

    // Get all items to sync
    const items = Array.from(queueRef.current.values());

    // Sync each item
    for (const item of items) {
      const result = await syncItem(item);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    isSyncingRef.current = false;

    if (queueRef.current.size === 0) {
      setSyncStatus("synced");
      // Reset to idle after showing synced
      setTimeout(() => {
        setSyncStatus((current) => (current === "synced" ? "idle" : current));
      }, 2000);
    } else {
      setSyncStatus("error");
    }

    return { success, failed };
  }, [isOnline, syncItem]);

  // Sync now - triggers immediate sync
  const syncNow = useCallback(async () => {
    await syncAll();
  }, [syncAll]);

  // Setup periodic sync
  useEffect(() => {
    if (!testToken) return;

    // Clear any existing timer
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
    }

    // Setup periodic sync
    syncTimerRef.current = setInterval(() => {
      if (queueRef.current.size > 0 && isOnline && !isSyncingRef.current) {
        syncAll();
      }
    }, syncIntervalMs);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [testToken, syncIntervalMs, isOnline, syncAll]);

  // Sync on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && queueRef.current.size > 0 && isOnline) {
        syncAll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOnline, syncAll]);

  // Sync before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (queueRef.current.size > 0) {
        // Attempt to sync using navigator.sendBeacon for more reliable delivery
        const items = Array.from(queueRef.current.values());
        items.forEach((item) => {
          const data = JSON.stringify({
            question_id: item.questionId,
            candidate_answer: item.answer || undefined,
            candidate_code: item.code || undefined,
          });

          // Try sendBeacon first
          const beaconSent = navigator.sendBeacon(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/answers/draft`,
            new Blob([data], { type: "application/json" })
          );

          if (!beaconSent) {
            console.warn("sendBeacon failed for question:", item.questionId);
          }
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return {
    syncStatus,
    pendingCount,
    queueSave,
    syncNow,
    syncAll,
    isOnline,
  };
}
