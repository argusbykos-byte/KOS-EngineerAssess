"use client";

import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/kos-quest-logo.png"
            alt="KOS Quest"
            width={80}
            height={80}
            className="rounded-xl shadow-lg"
          />
        </div>

        <h1 className="text-3xl font-bold text-foreground">
          KOS Engineering Assessment
        </h1>

        <p className="text-muted-foreground">
          If you have received a test link, please use it to access your assessment.
        </p>

        <p className="text-sm text-muted-foreground/70">
          For administrator access, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}
