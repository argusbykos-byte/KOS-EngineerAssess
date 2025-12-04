"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { testsApi, reportsApi } from "@/lib/api";
import { Candidate } from "@/types";
import {
  getCategoryLabel,
  getDifficultyLabel,
  getScoreColor,
  getRecommendationBadge,
} from "@/lib/utils";
import {
  Play,
  FileText,
  Mail,
  Clock,
  Trash2,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";

interface CandidateTableProps {
  candidates: Candidate[];
  onDelete: (id: number) => void;
  onRefresh: () => void;
}

export function CandidateTable({
  candidates,
  onDelete,
  onRefresh,
}: CandidateTableProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedTestLink, setGeneratedTestLink] = useState<string>("");
  const [generatedForCandidate, setGeneratedForCandidate] = useState<string>("");

  const handleCreateTest = async (candidateId: number) => {
    setLoading(candidateId);
    try {
      const candidate = candidates.find(c => c.id === candidateId);
      const response = await testsApi.create(candidateId);
      const testLink = `${window.location.origin}/test/${response.data.access_token}`;

      // Show dialog with the link
      setGeneratedTestLink(testLink);
      setGeneratedForCandidate(candidate?.name || "");
      setShowLinkDialog(true);

      onRefresh();
    } catch (error) {
      console.error("Error creating test:", error);
    } finally {
      setLoading(null);
    }
  };

  const copyGeneratedLink = async () => {
    await navigator.clipboard.writeText(generatedTestLink);
    setCopied("dialog");
    setTimeout(() => setCopied(null), 3000);
  };

  const handleGenerateReport = async (testId: number) => {
    setLoading(testId);
    try {
      await reportsApi.generate(testId);
      onRefresh();
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(null);
    }
  };

  const copyTestLink = async (token: string) => {
    const testLink = `${window.location.origin}/test/${token}`;
    await navigator.clipboard.writeText(testLink);
    setCopied(token);
    setTimeout(() => setCopied(null), 3000);
  };

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No candidates yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add a candidate to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Test Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-green-500" />
              Test Created Successfully
            </DialogTitle>
            <DialogDescription className="pt-2">
              Test link generated for <strong>{generatedForCandidate}</strong>.
              Share this link with the candidate to start their assessment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 items-center">
            <Input
              readOnly
              value={generatedTestLink}
              className="font-mono text-sm"
            />
            <Button size="sm" onClick={copyGeneratedLink}>
              {copied === "dialog" ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {candidates.map((candidate) => {
          const latestTest = candidate.tests?.[0];
          const hasCompletedTest =
            latestTest?.status === "completed" || latestTest?.status === "expired";

        return (
          <Card key={candidate.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{candidate.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Mail className="w-3 h-3" />
                    {candidate.email}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getDifficultyLabel(candidate.difficulty)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {candidate.test_duration_hours}h
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-4">
                {candidate.categories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {getCategoryLabel(cat)}
                  </Badge>
                ))}
              </div>

              {candidate.extracted_skills && candidate.extracted_skills.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Extracted Skills:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {candidate.extracted_skills.slice(0, 8).map((skill) => (
                      <Badge key={skill} className="text-xs bg-primary/20 text-primary border-primary/50">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.extracted_skills.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{candidate.extracted_skills.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {latestTest && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Test Status:{" "}
                        <span
                          className={
                            latestTest.status === "completed"
                              ? "text-green-500"
                              : latestTest.status === "in_progress"
                              ? "text-yellow-500"
                              : latestTest.status === "expired"
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }
                        >
                          {latestTest.status.replace("_", " ").toUpperCase()}
                        </span>
                      </p>
                      {latestTest.overall_score !== null && (
                        <p className="text-sm mt-1">
                          Score:{" "}
                          <span className={getScoreColor(latestTest.overall_score)}>
                            {latestTest.overall_score.toFixed(1)}%
                          </span>
                        </p>
                      )}
                    </div>
                    {latestTest.status === "pending" && latestTest.access_token && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyTestLink(latestTest.access_token)}
                      >
                        {copied === latestTest.access_token ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy Link
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {!latestTest && (
                  <Button
                    size="sm"
                    onClick={() => handleCreateTest(candidate.id)}
                    disabled={loading === candidate.id}
                  >
                    {loading === candidate.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    Create Test
                  </Button>
                )}

                {hasCompletedTest && !latestTest.overall_score && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleGenerateReport(latestTest.id)}
                    disabled={loading === latestTest.id}
                  >
                    {loading === latestTest.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-1" />
                    )}
                    Generate Report
                  </Button>
                )}

                {latestTest?.overall_score !== null && latestTest?.overall_score !== undefined && (
                  <Link href={`/admin/reports/${latestTest.id}`}>
                    <Button size="sm" variant="secondary">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View Report
                    </Button>
                  </Link>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive ml-auto"
                  onClick={() => onDelete(candidate.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
        })}
      </div>
    </>
  );
}
