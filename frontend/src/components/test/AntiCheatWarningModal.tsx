"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, Ban } from "lucide-react";

interface AntiCheatWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  warningCount: number;
  violationScore: number;
  maxWarnings?: number;
}

export function AntiCheatWarningModal({
  isOpen,
  onClose,
  warningCount,
  violationScore,
  maxWarnings = 3,
}: AntiCheatWarningModalProps) {
  const warningsRemaining = Math.max(0, maxWarnings - warningCount);
  const isLastWarning = warningsRemaining <= 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <ShieldAlert className="w-6 h-6" />
            Integrity Warning #{warningCount}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Warning about suspicious activity detected during assessment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm font-medium text-yellow-500 mb-2">
              Suspicious activity has been detected.
            </p>
            <p className="text-sm text-muted-foreground">
              Actions such as switching tabs, copying content, using developer tools,
              or right-clicking are monitored and logged. These behaviors may affect
              your assessment outcome.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Violation Score:</span>
            <span className="font-mono text-sm font-medium">{violationScore.toFixed(1)}</span>
          </div>

          {isLastWarning ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-500">
                    Final Warning
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This is your last warning. Further violations will result in
                    automatic disqualification from the assessment.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have <span className="font-medium text-foreground">{warningsRemaining}</span> warning(s)
              remaining before potential disqualification.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            I Understand, Continue Assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DisqualificationModalProps {
  isOpen: boolean;
  reason: string;
}

export function DisqualificationModal({
  isOpen,
  reason,
}: DisqualificationModalProps) {
  const handleClose = () => {
    // Try to close the tab/window
    window.close();
    // If window.close() doesn't work (most browsers block it for tabs not opened by script),
    // redirect to a completion page or home
    setTimeout(() => {
      window.location.href = "/test-ended";
    }, 100);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <Ban className="w-6 h-6" />
            Assessment Terminated
          </DialogTitle>
          <DialogDescription className="sr-only">
            Your assessment has been disqualified due to integrity violations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm font-medium text-red-500 mb-2">
              Your assessment has been disqualified.
            </p>
            <p className="text-sm text-muted-foreground">
              {reason}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            This decision has been logged and will be reviewed by the assessment team.
            If you believe this is an error, please contact the administrator.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose} variant="destructive" className="w-full">
            Close Assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
