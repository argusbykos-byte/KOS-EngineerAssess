"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Coffee, Play, Clock, AlertTriangle } from "lucide-react";

interface BreakOverlayProps {
  isVisible: boolean;
  breakStartTime: Date | null;
  maxSingleBreakSeconds: number;
  remainingBreakTimeSeconds: number;
  onResumeTest: () => void;
  isResuming?: boolean;
}

export function BreakOverlay({
  isVisible,
  breakStartTime,
  maxSingleBreakSeconds,
  remainingBreakTimeSeconds,
  onResumeTest,
  isResuming = false,
}: BreakOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Calculate elapsed time since break started
  useEffect(() => {
    if (!isVisible || !breakStartTime) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - breakStartTime.getTime()) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isVisible, breakStartTime]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  if (!isVisible) return null;

  // Calculate remaining time for this break
  const maxAllowed = Math.min(maxSingleBreakSeconds, remainingBreakTimeSeconds);
  const remainingInBreak = Math.max(0, maxAllowed - elapsedSeconds);
  const progressPercent = maxAllowed > 0 ? (elapsedSeconds / maxAllowed) * 100 : 0;
  const isOvertime = elapsedSeconds > maxAllowed;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4 bg-slate-900 border-slate-700">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <Coffee className="w-8 h-8 text-amber-400" />
          </div>
          <CardTitle className="text-2xl text-white">Break Time</CardTitle>
          <p className="text-slate-400 text-sm mt-2">
            Your test timer is paused. Take a moment to rest.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current break timer */}
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-2">Break Duration</p>
            <div className={`text-4xl font-mono font-bold ${isOvertime ? "text-red-400 animate-pulse" : "text-white"}`}>
              {formatTime(elapsedSeconds)}
            </div>
            {isOvertime && (
              <div className="flex items-center justify-center gap-2 mt-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Break time exceeded!</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-400">
              <span>0:00</span>
              <span>{formatTime(maxAllowed)}</span>
            </div>
            <Progress
              value={Math.min(progressPercent, 100)}
              className={`h-2 ${isOvertime ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500"}`}
            />
            <p className="text-center text-sm text-slate-400">
              {isOvertime
                ? "Time exceeded - please resume"
                : `${formatTime(remainingInBreak)} remaining for this break`}
            </p>
          </div>

          {/* Total break time remaining */}
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Total Break Time Left</span>
              </div>
              <span className="text-amber-400 font-mono">
                {formatTime(Math.max(0, remainingBreakTimeSeconds - elapsedSeconds))}
              </span>
            </div>
          </div>

          {/* Max single break info */}
          <p className="text-xs text-slate-500 text-center">
            Maximum single break: {Math.floor(maxSingleBreakSeconds / 60)} minutes
          </p>

          {/* Resume button */}
          <Button
            onClick={onResumeTest}
            disabled={isResuming}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold"
            size="lg"
          >
            {isResuming ? (
              <>Resuming...</>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Resume Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
