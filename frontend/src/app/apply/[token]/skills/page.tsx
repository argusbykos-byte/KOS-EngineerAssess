"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { applicationsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Sparkles,
  Code,
  Wrench,
  Cpu,
  BookOpen,
  Layers,
} from "lucide-react";

// Category metadata for display
const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; description: string }
> = {
  technical: {
    label: "Technical Skills",
    icon: <BookOpen className="w-5 h-5" />,
    color: "text-blue-500",
    description: "Core technical knowledge and concepts",
  },
  languages: {
    label: "Programming Languages",
    icon: <Code className="w-5 h-5" />,
    color: "text-green-500",
    description: "Languages you have experience with",
  },
  frameworks: {
    label: "Frameworks & Libraries",
    icon: <Layers className="w-5 h-5" />,
    color: "text-purple-500",
    description: "Frameworks and tools you've worked with",
  },
  tools: {
    label: "Tools & Platforms",
    icon: <Wrench className="w-5 h-5" />,
    color: "text-orange-500",
    description: "Development tools and cloud platforms",
  },
  competencies: {
    label: "Core Competencies",
    icon: <Cpu className="w-5 h-5" />,
    color: "text-cyan-500",
    description: "Broader skill areas and domains",
  },
};

// Rating labels
const RATING_LABELS: Record<number, string> = {
  1: "No Experience",
  2: "Heard of it",
  3: "Basic Understanding",
  4: "Some Practice",
  5: "Comfortable",
  6: "Proficient",
  7: "Strong",
  8: "Advanced",
  9: "Expert",
  10: "Master",
};

interface SkillItem {
  category: string;
  skill_name: string;
  current_rating: number | null;
}

interface SkillRating {
  category: string;
  skill_name: string;
  self_rating: number;
}

export default function SkillsAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [categories, setCategories] = useState<Record<string, SkillItem[]>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["technical"])
  );
  const [totalSkills, setTotalSkills] = useState(0);
  const [completedSkills, setCompletedSkills] = useState(0);

  // Load skills form
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch application info
        const appRes = await applicationsApi.get(token);
        setCandidateName(appRes.data.full_name);

        // Fetch skills form
        const skillsRes = await applicationsApi.getSkillsForm(token);
        setCategories(skillsRes.data.categories);
        setTotalSkills(skillsRes.data.total_skills);
        setCompletedSkills(skillsRes.data.completed_skills);

        // Initialize ratings from existing data
        const existingRatings: Record<string, number> = {};
        Object.values(skillsRes.data.categories).forEach((skills) => {
          skills.forEach((skill) => {
            if (skill.current_rating !== null) {
              existingRatings[`${skill.category}:${skill.skill_name}`] =
                skill.current_rating;
            }
          });
        });
        setRatings(existingRatings);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        setError(
          error.response?.data?.detail || "Failed to load application data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Update rating
  const updateRating = useCallback((category: string, skillName: string, rating: number) => {
    const key = `${category}:${skillName}`;
    setRatings((prev) => {
      const wasRated = prev[key] !== undefined;
      const newRatings = { ...prev, [key]: rating };

      // Update completed count
      if (!wasRated) {
        setCompletedSkills((c) => c + 1);
      }

      return newRatings;
    });
  }, []);

  // Calculate category progress
  const getCategoryProgress = (categorySkills: SkillItem[], category: string) => {
    const rated = categorySkills.filter(
      (skill) => ratings[`${category}:${skill.skill_name}`] !== undefined
    ).length;
    return {
      rated,
      total: categorySkills.length,
      percent: (rated / categorySkills.length) * 100,
    };
  };

  // Submit skills
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Convert ratings to API format
      const assessments: SkillRating[] = Object.entries(ratings).map(
        ([key, rating]) => {
          const [category, skill_name] = key.split(":");
          return { category, skill_name, self_rating: rating };
        }
      );

      await applicationsApi.submitSkills(token, assessments);
      router.push(`/apply/${token}/status`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(
        error.response?.data?.detail || "Failed to submit skills. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Actual rated count
  const ratedCount = Object.keys(ratings).length;
  const progressPercent = totalSkills > 0 ? (ratedCount / totalSkills) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && Object.keys(categories).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => router.push("/apply")}>
              Start New Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/kos-quest-logo.png"
              alt="KOS Quest"
              width={48}
              height={48}
              className="rounded-lg shadow-md"
            />
            <div>
              <h1 className="text-xl font-bold">Skill Assessment</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {candidateName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              {ratedCount} / {totalSkills} skills rated
            </p>
            <Progress value={progressPercent} className="w-32 h-2 mt-1" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">Application</span>
          </div>
          <div className="w-12 h-px bg-green-500" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className="text-sm font-medium">Skills</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm text-muted-foreground">Complete</span>
          </div>
        </div>

        {/* Instructions */}
        <Alert className="mb-6">
          <AlertDescription>
            Rate your proficiency in each skill from 1 (No Experience) to 10
            (Master). Be honest - this helps us understand your strengths and
            match you with the right opportunities.
          </AlertDescription>
        </Alert>

        {/* Skill Categories */}
        <div className="space-y-4">
          {Object.entries(categories).map(([category, skills]) => {
            const meta = CATEGORY_META[category] || {
              label: category,
              icon: <Code className="w-5 h-5" />,
              color: "text-primary",
              description: "",
            };
            const progress = getCategoryProgress(skills, category);
            const isExpanded = expandedCategories.has(category);

            return (
              <Collapsible
                key={category}
                open={isExpanded}
                onOpenChange={() => toggleCategory(category)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={meta.color}>{meta.icon}</span>
                          <div>
                            <CardTitle className="text-lg">{meta.label}</CardTitle>
                            <CardDescription>{meta.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {progress.rated} / {progress.total}
                            </p>
                            <Progress
                              value={progress.percent}
                              className="w-24 h-2 mt-1"
                            />
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid gap-3">
                        {skills.map((skill) => {
                          const key = `${category}:${skill.skill_name}`;
                          const currentRating = ratings[key];

                          return (
                            <div
                              key={skill.skill_name}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {skill.skill_name}
                                </p>
                                {currentRating && (
                                  <p className="text-xs text-muted-foreground">
                                    {RATING_LABELS[currentRating]}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() =>
                                      updateRating(category, skill.skill_name, rating)
                                    }
                                    className={`w-8 h-8 rounded text-xs font-medium transition-all ${
                                      currentRating === rating
                                        ? "bg-primary text-primary-foreground scale-110 shadow-md"
                                        : currentRating !== undefined &&
                                          rating <= currentRating
                                        ? "bg-primary/30 text-primary"
                                        : "bg-muted hover:bg-muted-foreground/20"
                                    }`}
                                    title={RATING_LABELS[rating]}
                                  >
                                    {rating}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Section */}
        <div className="mt-8 text-center space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 inline-block">
            <p className="text-sm text-muted-foreground">
              You have rated{" "}
              <span className="font-bold text-foreground">{ratedCount}</span> of{" "}
              <span className="font-bold text-foreground">{totalSkills}</span>{" "}
              skills
            </p>
            {ratedCount < totalSkills && (
              <p className="text-xs text-muted-foreground mt-1">
                You can submit partial assessments and complete later
              </p>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() =>
                applicationsApi
                  .submitSkills(
                    token,
                    Object.entries(ratings).map(([key, rating]) => {
                      const [category, skill_name] = key.split(":");
                      return { category, skill_name, self_rating: rating };
                    })
                  )
                  .then(() => alert("Progress saved!"))
              }
              disabled={ratedCount === 0 || submitting}
            >
              Save Progress
            </Button>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={ratedCount === 0 || submitting}
              className="min-w-[200px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Complete Application
                  <Sparkles className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
