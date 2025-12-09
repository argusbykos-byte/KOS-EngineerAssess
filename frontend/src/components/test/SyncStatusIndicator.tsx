"use client";

import { SyncStatus } from "@/hooks/useSyncQueue";
import { Cloud, CloudOff, Loader2, Check, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
  className?: string;
}

export function SyncStatusIndicator({
  syncStatus,
  pendingCount,
  isOnline,
  className,
}: SyncStatusIndicatorProps) {
  if (!isOnline) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-yellow-500 text-xs",
          className
        )}
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="text-muted-foreground">({pendingCount} pending)</span>
        )}
      </div>
    );
  }

  switch (syncStatus) {
    case "syncing":
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 text-blue-400 text-xs animate-pulse",
            className
          )}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing...</span>
        </div>
      );

    case "synced":
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 text-green-500 text-xs",
            className
          )}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Synced</span>
        </div>
      );

    case "error":
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 text-red-500 text-xs",
            className
          )}
        >
          <CloudOff className="w-3.5 h-3.5" />
          <span>Sync failed</span>
          {pendingCount > 0 && (
            <span className="text-muted-foreground">({pendingCount} pending)</span>
          )}
        </div>
      );

    case "idle":
    default:
      if (pendingCount > 0) {
        return (
          <div
            className={cn(
              "flex items-center gap-1.5 text-muted-foreground text-xs",
              className
            )}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>{pendingCount} pending</span>
          </div>
        );
      }
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 text-muted-foreground text-xs",
            className
          )}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>All saved</span>
        </div>
      );
  }
}
