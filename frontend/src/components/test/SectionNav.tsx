"use client";

import { cn } from "@/lib/utils";
import { getCategoryLabel } from "@/lib/utils";
import { Question } from "@/types";
import {
  Brain,
  Code,
  Bug,
  Network,
  Radio,
  CheckCircle,
  Circle,
} from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  brain_teaser: Brain,
  coding: Code,
  code_review: Bug,
  system_design: Network,
  signal_processing: Radio,
};

interface SectionNavProps {
  sections: Record<string, Question[]>;
  currentSection: string;
  onSectionChange: (section: string) => void;
}

export function SectionNav({
  sections,
  currentSection,
  onSectionChange,
}: SectionNavProps) {
  const sectionOrder = [
    "brain_teaser",
    "coding",
    "code_review",
    "system_design",
    "signal_processing",
  ];

  const orderedSections = sectionOrder.filter((s) => sections[s]);

  return (
    <nav className="space-y-1">
      {orderedSections.map((section) => {
        const questions = sections[section];
        const answeredCount = questions.filter((q) => q.is_answered).length;
        const isComplete = answeredCount === questions.length;
        const Icon = categoryIcons[section] || Circle;

        return (
          <button
            key={section}
            onClick={() => onSectionChange(section)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
              currentSection === section
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {getCategoryLabel(section)}
              </p>
              <p className="text-xs opacity-80">
                {answeredCount}/{questions.length} completed
              </p>
            </div>
            {isComplete && (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
