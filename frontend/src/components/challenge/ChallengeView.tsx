"use client";

import { ChallengeSpec } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  FileText,
  CheckCircle2,
  Presentation,
  ListChecks,
} from "lucide-react";

interface ChallengeViewProps {
  challenge: ChallengeSpec;
}

export function ChallengeView({ challenge }: ChallengeViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="border-b border-slate-700 pb-4">
        <h2 className="text-2xl font-bold text-white mb-2">{challenge.title}</h2>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            ~{challenge.estimated_time_hours} hours
          </span>
          <span className="flex items-center gap-1">
            <ListChecks className="w-4 h-4" />
            {challenge.tasks.length} tasks
          </span>
        </div>
        <p className="text-slate-300 mt-3">{challenge.short_summary}</p>
      </header>

      {/* Tasks */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-amber-400" />
          Tasks
        </h3>
        <div className="space-y-4">
          {challenge.tasks.map((task, index) => (
            <Card
              key={task.id}
              className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    {index + 1}
                  </span>
                  {task.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-300">{task.description}</p>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                    Requirements
                  </p>
                  <ul className="space-y-1">
                    {task.requirements.map((req, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-300 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Deliverables */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Deliverables
        </h3>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <ul className="space-y-2">
              {challenge.deliverables.map((deliverable, i) => (
                <li
                  key={i}
                  className="text-sm text-slate-300 flex items-start gap-2"
                >
                  <Badge variant="outline" className="shrink-0 border-slate-600">
                    {i + 1}
                  </Badge>
                  <span>{deliverable}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Auto-Generated Presentation */}
      {challenge.auto_presentation.enabled && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Presentation className="w-5 h-5 text-amber-400" />
            Auto-Generated Presentation
          </h3>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-slate-300">
                After you submit your work, KOS Quest will automatically generate
                a presentation draft to help you present your results. The deck
                will include sections such as:
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {challenge.auto_presentation.sections.map((section, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {section}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 pt-2">
                In the final interview, you will walk us through this deck and
                explain the logic behind your solution.
              </p>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
