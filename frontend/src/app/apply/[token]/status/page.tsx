"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { applicationsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle,
  Clock,
  FileText,
  User,
  Mail,
  MapPin,
  Briefcase,
  Star,
  Calendar,
  ExternalLink,
  Sparkles,
  ArrowRight,
  PartyPopper,
} from "lucide-react";

// Status configuration
const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    progress: number;
  }
> = {
  pending: {
    label: "Pending Review",
    description: "Your application has been received and is awaiting review.",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    progress: 20,
  },
  reviewing: {
    label: "Under Review",
    description: "Our team is currently reviewing your application.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    progress: 40,
  },
  skills_assessment: {
    label: "Skills Assessment",
    description: "Skills assessment received. Analysis in progress.",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    progress: 50,
  },
  analyzed: {
    label: "Analysis Complete",
    description: "Your profile has been analyzed. Awaiting next steps.",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    progress: 60,
  },
  test_generated: {
    label: "Test Ready",
    description: "Your assessment test is ready. Check your email for the link.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    progress: 75,
  },
  test_in_progress: {
    label: "Test In Progress",
    description: "You are currently taking the assessment test.",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    progress: 85,
  },
  completed: {
    label: "Completed",
    description: "All assessments complete. Results under final review.",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    progress: 100,
  },
  hired: {
    label: "Hired!",
    description: "Congratulations! You have been selected to join our team.",
    color: "text-green-600",
    bgColor: "bg-green-500/20",
    progress: 100,
  },
  rejected: {
    label: "Not Selected",
    description: "Thank you for applying. Unfortunately, we cannot proceed at this time.",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    progress: 100,
  },
};

interface ApplicationData {
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
  motivation: string | null;
  overall_self_rating: number | null;
}

export default function ApplicationStatusPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationData | null>(null);

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const res = await applicationsApi.get(token);
        setApplication(res.data);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        setError(
          error.response?.data?.detail || "Failed to load application status"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error || "Application not found"}</p>
            <Link href="/apply">
              <Button variant="outline">Start New Application</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig =
    STATUS_CONFIG[application.status] || STATUS_CONFIG.pending;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Image
            src="/kos-quest-logo.png"
            alt="KOS Quest"
            width={48}
            height={48}
            className="rounded-lg shadow-md"
          />
          <div>
            <h1 className="text-xl font-bold">Application Status</h1>
            <p className="text-sm text-muted-foreground">
              Track your application progress
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
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
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">Skills</span>
          </div>
          <div className="w-12 h-px bg-green-500" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Complete</span>
          </div>
        </div>

        {/* Success Message */}
        {application.status === "hired" ? (
          <div className="text-center mb-8 p-8 rounded-2xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
            <PartyPopper className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-3xl font-bold text-green-500 mb-2">
              Congratulations!
            </h2>
            <p className="text-lg text-muted-foreground">
              You have been selected to join the KOS team!
            </p>
          </div>
        ) : (
          <Alert className="mb-8 border-green-500/30 bg-green-500/10">
            <Sparkles className="w-5 h-5 text-green-500" />
            <AlertDescription className="ml-2">
              <span className="font-medium text-green-500">
                Thank you for completing your application!
              </span>{" "}
              We have received your information and skill assessment.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className={statusConfig.color} />
                  Current Status
                </CardTitle>
                <CardDescription>
                  Last updated: {formatDate(application.updated_at)}
                </CardDescription>
              </div>
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                {statusConfig.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">{statusConfig.description}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{statusConfig.progress}%</span>
                </div>
                <Progress value={statusConfig.progress} className="h-2" />
              </div>

              {application.status === "test_generated" && (
                <Alert className="mt-4">
                  <AlertDescription>
                    Check your email for the assessment test link. If you
                    haven&apos;t received it, please contact us.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Application Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Application Summary
            </CardTitle>
            <CardDescription>Your submitted information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="font-medium">{application.full_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{application.email}</p>
                </div>
              </div>

              {application.location && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{application.location}</p>
                  </div>
                </div>
              )}

              {application.self_description && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="font-medium">{application.self_description}</p>
                  </div>
                </div>
              )}

              {application.overall_self_rating && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Star className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Self Rating</p>
                    <p className="font-medium">{application.overall_self_rating}/100</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Applied On</p>
                  <p className="font-medium">
                    {new Date(application.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {application.motivation && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Motivation</p>
                <p className="text-sm">{application.motivation}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Application Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm">Application form submitted</span>
              </div>

              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  application.has_resume ? "bg-green-500/10" : "bg-yellow-500/10"
                }`}
              >
                {application.has_resume ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500" />
                )}
                <span className="text-sm">
                  Resume uploaded{" "}
                  {!application.has_resume && "(optional but recommended)"}
                </span>
              </div>

              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  application.skills_completed
                    ? "bg-green-500/10"
                    : "bg-yellow-500/10"
                }`}
              >
                {application.skills_completed ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-500" />
                )}
                <div className="flex-1">
                  <span className="text-sm">Skills assessment completed</span>
                  {application.skills_submitted_at && (
                    <p className="text-xs text-muted-foreground">
                      Submitted {formatDate(application.skills_submitted_at)}
                    </p>
                  )}
                </div>
                {!application.skills_completed && (
                  <Link href={`/apply/${token}/skills`}>
                    <Button variant="outline" size="sm">
                      Complete
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results (if available) */}
        {application.suggested_position && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Profile Analysis
              </CardTitle>
              <CardDescription>
                Based on your skills and experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">
                    Suggested Position
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {application.suggested_position}
                  </p>
                </div>

                {application.position_fit_score && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Position Fit Score</span>
                      <span className="font-medium">
                        {application.position_fit_score.toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={application.position_fit_score}
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">1. Review Process:</strong>{" "}
                Our team will review your application and skill assessment. This
                typically takes 1-2 business days.
              </p>
              <p>
                <strong className="text-foreground">2. Assessment Test:</strong>{" "}
                If selected, you&apos;ll receive an email with a link to complete our
                comprehensive engineering assessment.
              </p>
              <p>
                <strong className="text-foreground">3. Interview:</strong> Top
                candidates will be invited for a technical interview and trial
                day at our office.
              </p>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Bookmark this page to check your status
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const url = window.location.href;
                  let copied = false;
                  // Try navigator.clipboard first
                  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                    try {
                      await navigator.clipboard.writeText(url);
                      copied = true;
                    } catch (err) {
                      console.warn("navigator.clipboard.writeText failed:", err);
                    }
                  }
                  // Fallback: execCommand
                  if (!copied) {
                    try {
                      const textArea = document.createElement("textarea");
                      textArea.value = url;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-999999px";
                      document.body.appendChild(textArea);
                      textArea.select();
                      copied = document.execCommand("copy");
                      document.body.removeChild(textArea);
                    } catch (err) {
                      console.warn("execCommand copy failed:", err);
                    }
                  }
                  if (copied) {
                    alert("Link copied to clipboard!");
                  } else {
                    window.prompt("Copy this link manually:", url);
                  }
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Copy Status Page Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
