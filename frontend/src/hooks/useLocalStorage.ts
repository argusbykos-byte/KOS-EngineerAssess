"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface StoredAnswer {
  answer: string;
  code: string;
  timestamp: number;
  version: number;
  synced: boolean;
}

interface UseLocalStorageOptions {
  testToken: string;
  questionId: number;
  initialAnswer?: string;
  initialCode?: string;
}

interface UseLocalStorageReturn {
  answer: string;
  code: string;
  setAnswer: (value: string) => void;
  setCode: (value: string) => void;
  isSynced: boolean;
  markSynced: () => void;
  lastSavedTimestamp: number | null;
  clearLocal: () => void;
}

const STORAGE_KEY_PREFIX = "kos_quest_answer_";
const STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function getStorageKey(testToken: string, questionId: number): string {
  return `${STORAGE_KEY_PREFIX}${testToken}_${questionId}`;
}

export function useLocalStorage({
  testToken,
  questionId,
  initialAnswer = "",
  initialCode = "",
}: UseLocalStorageOptions): UseLocalStorageReturn {
  const storageKey = getStorageKey(testToken, questionId);
  const isInitialized = useRef(false);

  // Initialize state from localStorage or server data
  const [storedData, setStoredData] = useState<StoredAnswer>(() => {
    if (typeof window === "undefined") {
      return {
        answer: initialAnswer,
        code: initialCode,
        timestamp: Date.now(),
        version: 1,
        synced: true,
      };
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: StoredAnswer = JSON.parse(saved);

        // Check if stored data is expired
        if (Date.now() - parsed.timestamp > STORAGE_EXPIRY_MS) {
          localStorage.removeItem(storageKey);
          return {
            answer: initialAnswer,
            code: initialCode,
            timestamp: Date.now(),
            version: 1,
            synced: true,
          };
        }

        // Use localStorage data if it's newer than server data
        // or if it has unsaved changes
        if (!parsed.synced || parsed.timestamp > Date.now() - 5000) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error reading from localStorage:", e);
    }

    return {
      answer: initialAnswer,
      code: initialCode,
      timestamp: Date.now(),
      version: 1,
      synced: true,
    };
  });

  // Update localStorage when data changes
  useEffect(() => {
    if (typeof window === "undefined" || !isInitialized.current) {
      isInitialized.current = true;
      return;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(storedData));
    } catch (e) {
      console.error("Error writing to localStorage:", e);
    }
  }, [storedData, storageKey]);

  // Set answer and mark as unsynced
  const setAnswer = useCallback((value: string) => {
    setStoredData((prev) => ({
      ...prev,
      answer: value,
      timestamp: Date.now(),
      synced: false,
    }));
  }, []);

  // Set code and mark as unsynced
  const setCode = useCallback((value: string) => {
    setStoredData((prev) => ({
      ...prev,
      code: value,
      timestamp: Date.now(),
      synced: false,
    }));
  }, []);

  // Mark as synced after successful backend save
  const markSynced = useCallback(() => {
    setStoredData((prev) => ({
      ...prev,
      synced: true,
      version: prev.version + 1,
    }));
  }, []);

  // Clear local storage for this question
  const clearLocal = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }
  }, [storageKey]);

  return {
    answer: storedData.answer,
    code: storedData.code,
    setAnswer,
    setCode,
    isSynced: storedData.synced,
    markSynced,
    lastSavedTimestamp: storedData.timestamp,
    clearLocal,
  };
}

// Utility to get all pending (unsynced) answers for a test
export function getPendingAnswers(testToken: string): Array<{
  questionId: number;
  answer: string;
  code: string;
}> {
  if (typeof window === "undefined") return [];

  const pending: Array<{ questionId: number; answer: string; code: string }> = [];
  const prefix = `${STORAGE_KEY_PREFIX}${testToken}_`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data: StoredAnswer = JSON.parse(stored);
          if (!data.synced) {
            const questionId = parseInt(key.replace(prefix, ""), 10);
            pending.push({
              questionId,
              answer: data.answer,
              code: data.code,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Error reading pending answers:", e);
  }

  return pending;
}

// Utility to clear all answers for a test
export function clearTestAnswers(testToken: string): void {
  if (typeof window === "undefined") return;

  const prefix = `${STORAGE_KEY_PREFIX}${testToken}_`;
  const keysToRemove: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error("Error clearing test answers:", e);
  }
}

// Mark all answers for a test as synced
export function markAllSynced(testToken: string): void {
  if (typeof window === "undefined") return;

  const prefix = `${STORAGE_KEY_PREFIX}${testToken}_`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data: StoredAnswer = JSON.parse(stored);
          data.synced = true;
          localStorage.setItem(key, JSON.stringify(data));
        }
      }
    }
  } catch (e) {
    console.error("Error marking answers as synced:", e);
  }
}
