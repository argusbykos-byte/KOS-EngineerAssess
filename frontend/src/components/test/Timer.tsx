"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimerProps {
  initialSeconds: number;
  onExpire?: () => void;
}

export function Timer({ initialSeconds, onExpire }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onExpire?.();
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, onExpire]);

  const isWarning = seconds < 600; // Less than 10 minutes
  const isCritical = seconds < 120; // Less than 2 minutes

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg",
        isCritical
          ? "bg-red-500/20 text-red-500 animate-pulse"
          : isWarning
          ? "bg-yellow-500/20 text-yellow-500"
          : "bg-muted text-foreground"
      )}
    >
      {isCritical ? (
        <AlertTriangle className="w-5 h-5" />
      ) : (
        <Clock className="w-5 h-5" />
      )}
      <span>{formatDuration(seconds)}</span>
    </div>
  );
}
