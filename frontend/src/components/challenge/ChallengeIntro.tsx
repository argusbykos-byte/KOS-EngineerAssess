"use client";

import { ChallengeSpec, Track } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, Brain, Cpu } from "lucide-react";

interface ChallengeIntroProps {
  candidateName?: string;
  challenge: ChallengeSpec | null;
}

function getTrackDisplayName(track: Track): string {
  return track === "signal_processing"
    ? "Signal Processing & Feature Engineering"
    : "LLM / Generative AI";
}

function getTrackIcon(track: Track) {
  return track === "signal_processing" ? Cpu : Brain;
}

export function ChallengeIntro({ candidateName, challenge }: ChallengeIntroProps) {
  const name = candidateName || "Candidate";

  return (
    <div className="space-y-6 mb-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome to KOS Quest, {name}
        </h1>
        <p className="text-slate-400">
          Your personalized technical challenge environment
        </p>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            This application is your personalized technical challenge environment
            for KOS AI. Based on your resume, our system has selected a challenge
            that matches your experience and the role you are being considered for.
          </p>

          <p className="text-sm text-slate-300 leading-relaxed">
            You will work directly inside this application: read the challenge,
            implement your solution in your preferred tools, and document your
            approach. At the end, KOS Quest will generate a summary presentation
            from your work. You will use this presentation in a live session to
            walk us through your logic, trade-offs, and technical decisions.
          </p>

          <div className="py-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              How It Works
            </h3>
            <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2 ml-2">
              <li>Read the challenge description and tasks carefully.</li>
              <li>Implement your solution (code, models, or system design).</li>
              <li>Document your assumptions, methods, and evaluation.</li>
              <li>Upload or paste your deliverables into the provided fields.</li>
              <li>
                Submit the challenge. The system will generate a presentation draft
                for you to present in the final interview.
              </li>
            </ol>
          </div>

          {challenge && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <div className="flex items-center gap-3 mb-3">
                {(() => {
                  const Icon = getTrackIcon(challenge.track);
                  return <Icon className="w-6 h-6 text-amber-400" />;
                })()}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    Your Assigned Track
                  </p>
                  <p className="font-semibold text-white">
                    {getTrackDisplayName(challenge.track)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-300">{challenge.short_summary}</p>

              <div className="flex items-center gap-4 mt-4">
                <Badge variant="outline" className="border-slate-600">
                  <Clock className="w-3 h-3 mr-1" />
                  ~{challenge.estimated_time_hours} hours
                </Badge>
                <Badge variant="outline" className="border-slate-600">
                  {challenge.tasks.length} tasks
                </Badge>
                <Badge variant="outline" className="border-slate-600">
                  {challenge.deliverables.length} deliverables
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
