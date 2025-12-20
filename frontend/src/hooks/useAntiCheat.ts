"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { testsApi } from "@/lib/api";

export type ViolationType =
  | "tab_switch"
  | "paste_attempt"
  | "copy_attempt"
  | "right_click"
  | "dev_tools_open"
  | "focus_loss";

export interface AntiCheatState {
  tabSwitchCount: number;
  pasteAttemptCount: number;
  copyAttemptCount: number;
  rightClickCount: number;
  devToolsOpenCount: number;
  focusLossCount: number;
  violationScore: number;
  warningCount: number;
  isDisqualified: boolean;
  disqualificationReason: string | null;
}

export interface AntiCheatConfig {
  warning_threshold: number;
  disqualification_threshold: number;
  violation_weights: Record<string, number>;
}

interface UseAntiCheatOptions {
  token: string;
  isActive: boolean;
  onWarning?: (warningCount: number, violationScore: number) => void;
  onDisqualification?: (reason: string) => void;
}

export function useAntiCheat({
  token,
  isActive,
  onWarning,
  onDisqualification,
}: UseAntiCheatOptions) {
  const [state, setState] = useState<AntiCheatState>({
    tabSwitchCount: 0,
    pasteAttemptCount: 0,
    copyAttemptCount: 0,
    rightClickCount: 0,
    devToolsOpenCount: 0,
    focusLossCount: 0,
    violationScore: 0,
    warningCount: 0,
    isDisqualified: false,
    disqualificationReason: null,
  });

  const isActiveRef = useRef(isActive);
  const devToolsCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDevToolsCheck = useRef<number>(0);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const logEvent = useCallback(
    async (eventType: ViolationType, details?: string) => {
      if (!isActiveRef.current) return;

      try {
        const response = await testsApi.logAntiCheatEvent(token, {
          event_type: eventType,
          timestamp: new Date().toISOString(),
          details,
        });

        const data = response.data;

        setState({
          tabSwitchCount: data.tab_switch_count || 0,
          pasteAttemptCount: data.paste_attempt_count || 0,
          copyAttemptCount: data.copy_attempt_count || 0,
          rightClickCount: data.right_click_count || 0,
          devToolsOpenCount: data.dev_tools_open_count || 0,
          focusLossCount: data.focus_loss_count || 0,
          violationScore: data.violation_score || 0,
          warningCount: data.warning_count || 0,
          isDisqualified: data.is_disqualified || false,
          disqualificationReason: data.disqualification_reason || null,
        });

        if (data.should_warn && onWarning) {
          onWarning(data.warning_count, data.violation_score);
        }

        if (data.is_disqualified && onDisqualification) {
          onDisqualification(data.disqualification_reason || "Violation threshold exceeded");
        }
      } catch (error) {
        console.error("Error logging anti-cheat event:", error);
      }
    },
    [token, onWarning, onDisqualification]
  );

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActiveRef.current) {
        logEvent("tab_switch");
      }
    };

    const handleWindowBlur = () => {
      if (isActiveRef.current) {
        logEvent("focus_loss", "Window lost focus");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [logEvent]);

  // Copy prevention
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (!isActiveRef.current) return;

      // Allow copying from specific elements (like code output)
      const target = e.target as HTMLElement;
      if (target.closest("[data-allow-copy]")) return;

      e.preventDefault();
      logEvent("copy_attempt", "Attempted to copy content");
    };

    const handleCut = (e: ClipboardEvent) => {
      if (!isActiveRef.current) return;
      e.preventDefault();
      logEvent("copy_attempt", "Attempted to cut content");
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
    };
  }, [logEvent]);

  // Right-click prevention
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (!isActiveRef.current) return;

      // Allow right-click on specific elements
      const target = e.target as HTMLElement;
      if (target.closest("[data-allow-context-menu]")) return;

      e.preventDefault();
      logEvent("right_click", "Right-click blocked");
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [logEvent]);

  // Paste detection (for tracking, not prevention - code editor needs paste)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isActiveRef.current) return;

      // Track paste but don't prevent it in code editor
      const target = e.target as HTMLElement;
      const isCodeEditor = target.closest(".monaco-editor");
      const isTextarea = target.tagName === "TEXTAREA";

      if (isCodeEditor || isTextarea) {
        logEvent("paste_attempt", `Paste in ${isCodeEditor ? "code editor" : "textarea"}`);
      }
    };

    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [logEvent]);

  // Dev tools detection
  useEffect(() => {
    if (!isActive) {
      if (devToolsCheckIntervalRef.current) {
        clearInterval(devToolsCheckIntervalRef.current);
      }
      return;
    }

    const checkDevTools = () => {
      const now = Date.now();
      // Throttle dev tools checks to once per 5 seconds
      if (now - lastDevToolsCheck.current < 5000) return;
      lastDevToolsCheck.current = now;

      // Method 1: Check window dimensions
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      // Method 2: Console timing detection
      let devToolsOpen = false;
      const element = new Image();
      Object.defineProperty(element, "id", {
        get: function () {
          devToolsOpen = true;
        },
      });

      // Method 3: debugger detection (commented out as it's intrusive)
      // const start = performance.now();
      // debugger;
      // const end = performance.now();
      // if (end - start > 100) devToolsOpen = true;

      if (widthThreshold || heightThreshold || devToolsOpen) {
        logEvent("dev_tools_open", "Developer tools detected");
      }
    };

    // Check every 2 seconds
    devToolsCheckIntervalRef.current = setInterval(checkDevTools, 2000);

    // Initial check
    checkDevTools();

    return () => {
      if (devToolsCheckIntervalRef.current) {
        clearInterval(devToolsCheckIntervalRef.current);
      }
    };
  }, [isActive, logEvent]);

  // Keyboard shortcut prevention (common dev tools shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return;

      // Detect dev tools shortcuts
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
      if (
        e.key === "F12" ||
        (ctrlOrCmd && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase())) ||
        (ctrlOrCmd && e.key.toUpperCase() === "U")
      ) {
        e.preventDefault();
        logEvent("dev_tools_open", `Dev tools shortcut: ${e.key}`);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [logEvent]);

  return {
    ...state,
    logEvent,
  };
}
