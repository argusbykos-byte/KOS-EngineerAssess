"use client";

import Image from "next/image";

export default function TestEndedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center gap-3 mb-8">
          <Image
            src="/kos-quest-logo.png"
            alt="Quest"
            width={64}
            height={64}
            className="rounded-xl shadow-lg"
          />
        </div>

        <h1 className="text-2xl font-bold text-foreground">
          Assessment Session Ended
        </h1>

        <p className="text-muted-foreground">
          Your assessment session has ended. You may close this browser window.
        </p>

        <p className="text-sm text-muted-foreground/70">
          If you have questions, please contact the assessment administrator.
        </p>
      </div>
    </div>
  );
}
