"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { applicationsApi, specializationApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  FileText,
  Star,
  Heart,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Play,
  Save,
  CheckCircle,
  Clock,
  ExternalLink,
  Brain,
  Code,
  Wrench,
  Cpu,
  BookOpen,
  Layers,
  Target,
} from "lucide-react";
import { formatPacificDate } from "@/lib/utils";

// Status configuration
const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  },
  reviewing: {
    label: "Reviewing",
    className: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  },
  skills_assessment: {
    label: "Skills Done",
    className: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  },
  analyzed: {
    label: "Analyzed",
    className: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  },
  test_generated: {
    label: "Test Sent",
    className: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30",
  },
  test_in_progress: {
    label: "Testing",
    className: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  },
  hired: {
    label: "Hired",
    className: "bg-green-600/20 text-green-500 border-green-500/30",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/20 text-red-500 border-red-500/30",
  },
};

// Category metadata for skill display
const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  technical: {
    label: "Technical Skills",
    icon: <BookOpen className="w-5 h-5" />,
    color: "text-blue-500",
  },
  languages: {
    label: "Programming Languages",
    icon: <Code className="w-5 h-5" />,
    color: "text-green-500",
  },
  frameworks: {
    label: "Frameworks & Libraries",
    icon: <Layers className="w-5 h-5" />,
    color: "text-purple-500",
  },
  tools: {
    label: "Tools & Platforms",
    icon: <Wrench className="w-5 h-5" />,
    color: "text-orange-500",
  },
  competencies: {
    label: "Core Competencies",
    icon: <Cpu className="w-5 h-5" />,
    color: "text-cyan-500",
  },
};

interface SkillAssessment {
  id: number;
  category: string;
  skill_name: string;
  self_rating: number | null;
  kimi_rating: number | null;
  kimi_confidence: number | null;
  kimi_evidence: string | null;
  created_at: string;
}

interface ApplicationDetail {
  id: number;
  full_name: string;
  email: string;
  application_token: string;
  status: string;
  self_description: string | null;
  has_resume: boolean;
  skills_completed: boolean;
  skills_submitted_at: string | null;
  suggested_position: string | null;
  position_fit_score: number | null;
  created_at: string;
  updated_at: string;
  phone: string | null;
  location: string | null;
  graduation_date: string | null;
  preferred_start_date: string | null;
  availability: string | null;
  preferred_trial_date: string | null;
  motivation: string | null;
  admired_engineers: string | null;
  overall_self_rating: number | null;
  unique_trait: string | null;
  resume_filename: string | null;
  resume_text: string | null;
  kimi_analysis: Record<string, unknown> | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  candidate_id: number | null;
  skill_assessments: SkillAssessment[];
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = Number(params.id);

  // State
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [analyzing, setAnalyzing] = useState(false);
  const [creatingCandidate, setCreatingCandidate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [status, setStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [testDuration, setTestDuration] = useState(2);
  const [difficulty, setDifficulty] = useState("mid");

  // Specialization test state
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [specFocusArea, setSpecFocusArea] = useState("ml");
  const [specDuration, setSpecDuration] = useState(60);
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [focusAreas, setFocusAreas] = useState<Array<{
    id: string;
    name: string;
    description: string;
    sub_specialties: string[];
  }>>([]);

  // Expanded skill categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["technical", "languages"])
  );

  // Fetch application
  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const response = await applicationsApi.getAdmin(applicationId);
        setApplication(response.data);
        setStatus(response.data.status);
        setAdminNotes(response.data.admin_notes || "");
        setReviewedBy(response.data.reviewed_by || "");
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        setError(error.response?.data?.detail || "Failed to load application");
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [applicationId]);

  // Fetch focus areas for specialization tests
  useEffect(() => {
    const fetchFocusAreas = async () => {
      try {
        const response = await specializationApi.getFocusAreas();
        setFocusAreas(response.data);
      } catch (error) {
        console.error("Error fetching focus areas:", error);
      }
    };
    fetchFocusAreas();
  }, []);

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return formatPacificDate(dateStr, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (statusKey: string) => {
    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
    return (
      <Badge variant="outline" className={`${config.className} text-sm`}>
        {config.label}
      </Badge>
    );
  };

  // Toggle skill category
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

  // Group skills by category
  const skillsByCategory = application?.skill_assessments.reduce(
    (acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    },
    {} as Record<string, SkillAssessment[]>
  ) || {};

  // Get rating color
  const getRatingColor = (rating: number | null) => {
    if (rating === null) return "text-muted-foreground";
    if (rating >= 8) return "text-green-500";
    if (rating >= 6) return "text-blue-500";
    if (rating >= 4) return "text-yellow-500";
    return "text-red-500";
  };

  // Handle save
  const handleSave = async () => {
    if (!application) return;
    setSaving(true);

    try {
      await applicationsApi.update(applicationId, {
        status,
        admin_notes: adminNotes,
        reviewed_by: reviewedBy,
      });

      // Refresh
      const response = await applicationsApi.getAdmin(applicationId);
      setApplication(response.data);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  // Handle analyze
  const handleAnalyze = async () => {
    if (!application) return;
    setAnalyzing(true);

    try {
      await applicationsApi.analyze(application.application_token, true);

      // Refresh
      const response = await applicationsApi.getAdmin(applicationId);
      setApplication(response.data);
    } catch (err) {
      console.error("Failed to analyze:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle create candidate
  const handleCreateCandidate = async () => {
    if (!application) return;
    setCreatingCandidate(true);

    try {
      const response = await applicationsApi.createCandidate(applicationId, {
        test_duration_hours: testDuration,
        difficulty,
        categories: [],
      });

      setCreateDialogOpen(false);

      // Refresh and redirect
      alert(
        `Candidate created successfully!\nTest ID: ${response.data.test_id}\nAccess Token: ${response.data.access_token}`
      );
      router.push(`/admin/candidates`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || "Failed to create candidate");
    } finally {
      setCreatingCandidate(false);
    }
  };

  // Handle generate specialization test
  const handleGenerateSpecTest = async () => {
    if (!application || !application.candidate_id) return;
    setGeneratingSpec(true);

    try {
      const response = await specializationApi.generate({
        candidate_id: application.candidate_id,
        focus_area: specFocusArea,
        duration_minutes: specDuration,
      });

      setSpecDialogOpen(false);

      if (response.data.success) {
        alert(
          `Specialization test generated!\nTest ID: ${response.data.test_id}\nQuestions: ${response.data.questions_generated}\nAccess Token: ${response.data.access_token}`
        );
        router.push("/admin/specialization-results");
      } else {
        alert(response.data.message || "Failed to generate test");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || "Failed to generate specialization test");
    } finally {
      setGeneratingSpec(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-4">
        <Link href="/admin/applications">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Applications
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error || "Application not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/applications">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{application.full_name}</h1>
            <p className="text-muted-foreground">{application.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(application.status)}
          {application.candidate_id && (
            <Link href="/admin/candidates">
              <Badge variant="outline" className="bg-primary/20 text-primary">
                <ExternalLink className="w-3 h-3 mr-1" />
                Candidate #{application.candidate_id}
              </Badge>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{application.email}</p>
                  </div>
                </div>

                {application.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{application.phone}</p>
                    </div>
                  </div>
                )}

                {application.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium">{application.location}</p>
                    </div>
                  </div>
                )}

                {application.graduation_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Graduation</p>
                      <p className="font-medium">{application.graduation_date}</p>
                    </div>
                  </div>
                )}

                {application.self_description && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Role</p>
                      <p className="font-medium">{application.self_description}</p>
                    </div>
                  </div>
                )}

                {application.overall_self_rating && (
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Self Rating</p>
                      <p className="font-medium">{application.overall_self_rating}/100</p>
                    </div>
                  </div>
                )}

                {application.availability && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Availability</p>
                      <p className="font-medium capitalize">
                        {application.availability.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Applied</p>
                    <p className="font-medium">{formatDate(application.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Text fields */}
              {application.motivation && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Heart className="w-3 h-3" /> Motivation
                  </p>
                  <p className="text-sm">{application.motivation}</p>
                </div>
              )}

              {application.admired_engineers && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">
                    Admired Engineers
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {application.admired_engineers}
                  </p>
                </div>
              )}

              {application.unique_trait && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> What Makes Them Unique
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {application.unique_trait}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resume */}
          {application.resume_text && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Resume Text
                  {application.resume_filename && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {application.resume_filename}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-muted/50 max-h-96 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {application.resume_text}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skill Assessments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Skill Self-Assessments
              </CardTitle>
              <CardDescription>
                {application.skill_assessments.length} skills rated
                {application.skills_submitted_at && (
                  <> - Submitted {formatDate(application.skills_submitted_at)}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(skillsByCategory).length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No skill assessments submitted yet.
                  </AlertDescription>
                </Alert>
              ) : (
                Object.entries(skillsByCategory).map(([category, skills]) => {
                  const meta = CATEGORY_META[category] || {
                    label: category,
                    icon: <Code className="w-5 h-5" />,
                    color: "text-primary",
                  };
                  const isExpanded = expandedCategories.has(category);
                  const avgRating =
                    skills.reduce((sum, s) => sum + (s.self_rating || 0), 0) /
                    skills.filter((s) => s.self_rating !== null).length;

                  return (
                    <Collapsible
                      key={category}
                      open={isExpanded}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <span className={meta.color}>{meta.icon}</span>
                            <div>
                              <p className="font-medium">{meta.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {skills.length} skills, avg{" "}
                                {isNaN(avgRating) ? "-" : avgRating.toFixed(1)}
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 pl-4">
                          {skills.map((skill) => (
                            <div
                              key={skill.id}
                              className="flex items-center justify-between p-2 rounded bg-muted/20"
                            >
                              <span className="text-sm">{skill.skill_name}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-24">
                                  <Progress
                                    value={(skill.self_rating || 0) * 10}
                                    className="h-2"
                                  />
                                </div>
                                <span
                                  className={`text-sm font-medium w-6 text-right ${getRatingColor(
                                    skill.self_rating
                                  )}`}
                                >
                                  {skill.self_rating || "-"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Kimi Analysis Results */}
          {application.kimi_analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Kimi2 Analysis
                </CardTitle>
                <CardDescription>
                  AI-powered assessment based on resume and skill ratings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Position Recommendation */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Best Position Fit</p>
                    <p className="text-lg font-bold text-primary">
                      {(application.kimi_analysis as Record<string, unknown>).best_position as string || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Fit Score</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${
                        ((application.kimi_analysis as Record<string, unknown>).fit_score as number || 0) >= 70 ? "text-green-500" :
                        ((application.kimi_analysis as Record<string, unknown>).fit_score as number || 0) >= 50 ? "text-yellow-500" : "text-red-500"
                      }`}>
                        {(application.kimi_analysis as Record<string, unknown>).fit_score as number || 0}%
                      </span>
                    </div>
                    <Progress
                      value={(application.kimi_analysis as Record<string, unknown>).fit_score as number || 0}
                      className="h-2 mt-2"
                    />
                  </div>
                </div>

                {/* Overall Assessment */}
                {(application.kimi_analysis as Record<string, unknown>).overall_assessment && (
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground mb-2">Overall Assessment</p>
                    <p className="text-sm">
                      {(application.kimi_analysis as Record<string, unknown>).overall_assessment as string}
                    </p>
                  </div>
                )}

                {/* Skill Verification */}
                {((application.kimi_analysis as Record<string, unknown>).skill_verification as Array<Record<string, unknown>>)?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      Skill Verification
                    </p>
                    <div className="space-y-2">
                      {((application.kimi_analysis as Record<string, unknown>).skill_verification as Array<Record<string, unknown>>).map((skill, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{skill.skill as string}</p>
                            <p className="text-xs text-muted-foreground">{skill.notes as string}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Self</p>
                              <p className="font-medium">{skill.self_rating as number}</p>
                            </div>
                            <div className="text-muted-foreground">→</div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Adjusted</p>
                              <p className={`font-medium ${
                                (skill.adjusted_rating as number) >= 8 ? "text-green-500" :
                                (skill.adjusted_rating as number) >= 6 ? "text-blue-500" :
                                (skill.adjusted_rating as number) >= 4 ? "text-yellow-500" : "text-red-500"
                              }`}>
                                {skill.adjusted_rating as number}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                skill.resume_evidence === "strong" ? "bg-green-500/20 text-green-500 border-green-500/30" :
                                skill.resume_evidence === "moderate" ? "bg-blue-500/20 text-blue-500 border-blue-500/30" :
                                skill.resume_evidence === "weak" ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" :
                                "bg-red-500/20 text-red-500 border-red-500/30"
                              }`}
                            >
                              {skill.resume_evidence as string}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & Growth Areas */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Strengths */}
                  {((application.kimi_analysis as Record<string, unknown>).strengths as string[])?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2 text-green-500">
                        <CheckCircle className="w-4 h-4" />
                        Strengths
                      </p>
                      <ul className="space-y-1">
                        {((application.kimi_analysis as Record<string, unknown>).strengths as string[]).map((s, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Areas for Growth */}
                  {((application.kimi_analysis as Record<string, unknown>).areas_for_growth as string[])?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2 text-yellow-500">
                        <Lightbulb className="w-4 h-4" />
                        Areas for Growth
                      </p>
                      <ul className="space-y-1">
                        {((application.kimi_analysis as Record<string, unknown>).areas_for_growth as string[]).map((a, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Interview Questions */}
                {((application.kimi_analysis as Record<string, unknown>).interview_questions as string[])?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      Suggested Interview Questions
                    </p>
                    <div className="space-y-2">
                      {((application.kimi_analysis as Record<string, unknown>).interview_questions as string[]).map((q, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-muted/30 border-l-2 border-primary">
                          <p className="text-sm">{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleAnalyze}
                disabled={analyzing || !application.skills_completed}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Run Kimi2 Analysis
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                onClick={() => setCreateDialogOpen(true)}
                disabled={!!application.candidate_id}
              >
                <Play className="w-4 h-4 mr-2" />
                {application.candidate_id
                  ? "Candidate Created"
                  : "Create Candidate & Test"}
              </Button>

              {application.candidate_id && (
                <>
                  <Link href={`/admin/candidates`} className="block">
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Candidate
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSpecDialogOpen(true)}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Generate Specialization Test
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status & Notes Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="skills_assessment">Skills Done</SelectItem>
                    <SelectItem value="analyzed">Analyzed</SelectItem>
                    <SelectItem value="test_generated">Test Sent</SelectItem>
                    <SelectItem value="test_in_progress">Testing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reviewed By</Label>
                <Input
                  placeholder="Your name"
                  value={reviewedBy}
                  onChange={(e) => setReviewedBy(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea
                  placeholder="Add notes about this application..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>

              {application.reviewed_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Last reviewed: {formatDate(application.reviewed_at)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Position Fit Card */}
          {application.suggested_position && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Position Fit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Suggested Position</p>
                  <p className="font-bold text-primary">
                    {application.suggested_position}
                  </p>
                </div>

                {application.position_fit_score !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Fit Score</span>
                      <span className="font-medium">
                        {application.position_fit_score.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={application.position_fit_score} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Checklist Card */}
          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div
                className={`flex items-center gap-2 p-2 rounded ${
                  application.has_resume ? "bg-green-500/10" : "bg-muted/50"
                }`}
              >
                {application.has_resume ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Resume uploaded</span>
              </div>

              <div
                className={`flex items-center gap-2 p-2 rounded ${
                  application.skills_completed ? "bg-green-500/10" : "bg-muted/50"
                }`}
              >
                {application.skills_completed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Skills assessment</span>
              </div>

              <div
                className={`flex items-center gap-2 p-2 rounded ${
                  application.kimi_analysis ? "bg-green-500/10" : "bg-muted/50"
                }`}
              >
                {application.kimi_analysis ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Kimi2 analysis</span>
              </div>

              <div
                className={`flex items-center gap-2 p-2 rounded ${
                  application.candidate_id ? "bg-green-500/10" : "bg-muted/50"
                }`}
              >
                {application.candidate_id ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Candidate created</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Candidate Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Candidate & Generate Test</DialogTitle>
            <DialogDescription>
              This will create a candidate record and generate an assessment test
              for {application.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Test Duration (hours)</Label>
              <Select
                value={testDuration.toString()}
                onValueChange={(v) => setTestDuration(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                    <SelectItem key={h} value={h.toString()}>
                      {h} hour{h > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid-Level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCandidate} disabled={creatingCandidate}>
              {creatingCandidate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Create & Generate Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialization Test Dialog */}
      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Specialization Test</DialogTitle>
            <DialogDescription>
              Create a 1-hour deep-dive test to identify {application.full_name}&apos;s
              exact sub-specialty within their focus area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Focus Area</Label>
              <Select value={specFocusArea} onValueChange={setSpecFocusArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Select focus area" />
                </SelectTrigger>
                <SelectContent>
                  {focusAreas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {focusAreas.find((a) => a.id === specFocusArea)?.description && (
                <p className="text-sm text-muted-foreground">
                  {focusAreas.find((a) => a.id === specFocusArea)?.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select
                value={specDuration.toString()}
                onValueChange={(v) => setSpecDuration(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes (Recommended)</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="120">120 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {focusAreas.find((a) => a.id === specFocusArea)?.sub_specialties && (
              <div className="space-y-2">
                <Label>Sub-specialties to identify</Label>
                <div className="flex flex-wrap gap-1">
                  {focusAreas
                    .find((a) => a.id === specFocusArea)
                    ?.sub_specialties.slice(0, 6)
                    .map((ss) => (
                      <Badge key={ss} variant="secondary" className="text-xs">
                        {ss}
                      </Badge>
                    ))}
                  {(focusAreas.find((a) => a.id === specFocusArea)?.sub_specialties
                    .length || 0) > 6 && (
                    <Badge variant="secondary" className="text-xs">
                      +
                      {(focusAreas.find((a) => a.id === specFocusArea)?.sub_specialties
                        .length || 0) - 6}{" "}
                      more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateSpecTest} disabled={generatingSpec}>
              {generatingSpec ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Generate Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
