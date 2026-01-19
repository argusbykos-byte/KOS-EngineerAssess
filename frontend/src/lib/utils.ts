import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  QUEST_CATEGORIES,
  QUEST_DIFFICULTY,
  QUEST_RECOMMENDATIONS,
  type QuestCategory,
} from "@/config/questTheme";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score >= 85) return "text-green-500";
  if (score >= 70) return "text-blue-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

export function getRecommendationBadge(recommendation: string | null): {
  label: string;
  className: string;
} {
  switch (recommendation) {
    case "strong_hire":
      return { label: "Strong Hire", className: "bg-green-500/20 text-green-500 border-green-500/50" };
    case "hire":
      return { label: "Hire", className: "bg-blue-500/20 text-blue-500 border-blue-500/50" };
    case "maybe":
      return { label: "Maybe", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" };
    case "no_hire":
      return { label: "No Hire", className: "bg-red-500/20 text-red-500 border-red-500/50" };
    default:
      return { label: "Pending", className: "bg-muted text-muted-foreground border-muted" };
  }
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    brain_teaser: "Brain Teasers",
    coding: "Coding Challenges",
    code_review: "Code Review",
    system_design: "System Design",
    signal_processing: "Signal Processing",
    general_engineering: "General Engineering",
    backend: "Backend",
    ml: "Machine Learning",
    fullstack: "Full-Stack",
    python: "Python",
    react: "React",
    // Specialization tracks (Phase 3)
    ai_researcher: "AI Researcher",
    ai_ml_engineer: "AI/ML Engineer",
    frontend: "Frontend Engineer",
    ui_ux: "UI/UX Designer",
    cybersecurity: "Cybersecurity",
    hardware_ee: "PCB/EE Engineer",
    firmware: "Firmware Engineer",
    biomedical: "Biomedical Engineer",
  };
  return labels[category] || category;
}

export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    junior: "Junior",
    mid: "Mid-Level",
    senior: "Senior",
  };
  return labels[difficulty] || difficulty;
}

// KOS Quest themed helpers
export function getQuestCategory(categoryId: string): QuestCategory | undefined {
  return QUEST_CATEGORIES[categoryId];
}

export function getQuestTitle(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.title : getCategoryLabel(categoryId);
}

export function getQuestDeity(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.deity : categoryId;
}

export function getQuestShortName(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? `${category.deity}'s Challenge` : getCategoryLabel(categoryId);
}

export function getQuestDescription(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.shortDescription : "";
}

export function getQuestIcon(categoryId: string): string {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.icon : "HelpCircle";
}

export function getQuestColors(categoryId: string): QuestCategory["color"] | null {
  const category = QUEST_CATEGORIES[categoryId];
  return category ? category.color : null;
}

export function getQuestDifficultyLabel(difficulty: string): string {
  const questDiff = QUEST_DIFFICULTY[difficulty as keyof typeof QUEST_DIFFICULTY];
  return questDiff ? questDiff.name : getDifficultyLabel(difficulty);
}

export function getQuestRecommendation(recommendation: string): {
  name: string;
  description: string;
  color: string;
  icon: string;
} | null {
  return QUEST_RECOMMENDATIONS[recommendation as keyof typeof QUEST_RECOMMENDATIONS] || null;
}

export function getQuestRecommendationBadge(recommendation: string | null): {
  label: string;
  questLabel: string;
  className: string;
  description: string;
} {
  const questRec = recommendation ? QUEST_RECOMMENDATIONS[recommendation as keyof typeof QUEST_RECOMMENDATIONS] : null;
  const badge = getRecommendationBadge(recommendation);

  return {
    ...badge,
    questLabel: questRec?.name || badge.label,
    description: questRec?.description || "",
  };
}

// ============================================================================
// DATE/TIME UTILITIES - Pacific Time (KOS is based in Palo Alto, California)
// ============================================================================

/**
 * Simple date formatting function for compatibility with existing local implementations.
 * Formats a date string to a readable format.
 *
 * @param dateString - ISO string or date string to format
 * @returns Formatted date string like "Jan 15, 2026" or empty string if invalid
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * KOS headquarters timezone - America/Los_Angeles (Pacific Time)
 * All user-facing dates should be displayed in this timezone.
 */
const PACIFIC_TIMEZONE = "America/Los_Angeles";

/**
 * Convert a UTC date string or Date to Pacific Time and format it.
 * Backend stores all timestamps in UTC, this converts for display.
 *
 * @param dateInput - ISO string, Date object, or null/undefined
 * @param options - Intl.DateTimeFormat options (default: long date format)
 * @returns Formatted date string in Pacific Time
 */
export function formatPacificDate(
  dateInput: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  }
): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // Check for invalid date
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    ...options,
    timeZone: PACIFIC_TIMEZONE,
  });
}

/**
 * Format a date with time in Pacific Time.
 *
 * @param dateInput - ISO string, Date object, or null/undefined
 * @returns Formatted datetime string like "January 11, 2026 at 3:45 PM PST"
 */
export function formatPacificDateTime(
  dateInput: string | Date | null | undefined
): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  if (isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC_TIMEZONE,
    timeZoneName: "short",
  });
}

/**
 * Format just the time in Pacific Time.
 *
 * @param dateInput - ISO string, Date object, or null/undefined
 * @returns Formatted time string like "3:45 PM"
 */
export function formatPacificTime(
  dateInput: string | Date | null | undefined
): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  if (isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PACIFIC_TIMEZONE,
  });
}

/**
 * Format a short date in Pacific Time (MM/DD/YYYY).
 *
 * @param dateInput - ISO string, Date object, or null/undefined
 * @returns Formatted date string like "1/11/2026"
 */
export function formatPacificShortDate(
  dateInput: string | Date | null | undefined
): string {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: PACIFIC_TIMEZONE,
  });
}
