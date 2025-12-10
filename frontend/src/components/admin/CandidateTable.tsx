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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { testsApi, reportsApi } from "@/lib/api";
import { Candidate, TestSummary } from "@/types";
import {
  getCategoryLabel,
  getDifficultyLabel,
  getScoreColor,
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
  ChevronDown,
  ChevronRight,
  Plus,
  History,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface CandidateTableProps {
  candidates: Candidate[];
  onDelete: (id: number) => void;
  onRefresh: () => void;
}

// Helper to format date
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Test status badge component
function TestStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-gray-500/20 text-gray-400" },
    in_progress: { label: "In Progress", className: "bg-yellow-500/20 text-yellow-500" },
    completed: { label: "Completed", className: "bg-green-500/20 text-green-500" },
    expired: { label: "Expired", className: "bg-red-500/20 text-red-500" },
  };

  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

export function CandidateTable({
  candidates,
  onDelete,
  onRefresh,
}: CandidateTableProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedTestLink, setGeneratedTestLink] = useState<string>("");
  const [generatedForCandidate, setGeneratedForCandidate] = useState<string>("");
  const [expandedCandidates, setExpandedCandidates] = useState<Set<number>>(new Set());
  const [showDeleteTestDialog, setShowDeleteTestDialog] = useState(false);
  const [testToDelete, setTestToDelete] = useState<{ id: number; candidateName: string } | null>(null);

  const toggleExpanded = (candidateId: number) => {
    const newExpanded = new Set(expandedCandidates);
    if (newExpanded.has(candidateId)) {
      newExpanded.delete(candidateId);
    } else {
      newExpanded.add(candidateId);
    }
    setExpandedCandidates(newExpanded);
  };

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

  const handleDeleteTest = async () => {
    if (!testToDelete) return;

    setDeleting(testToDelete.id);
    try {
      await testsApi.delete(testToDelete.id);
      onRefresh();
    } catch (error) {
      console.error("Error deleting test:", error);
    } finally {
      setDeleting(null);
      setShowDeleteTestDialog(false);
      setTestToDelete(null);
    }
  };

  const confirmDeleteTest = (testId: number, candidateName: string) => {
    setTestToDelete({ id: testId, candidateName });
    setShowDeleteTestDialog(true);
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

  // Render a single test row
  const renderTestRow = (test: TestSummary, isLatest: boolean, candidateName: string) => {
    const hasCompletedTest = test.status === "completed" || test.status === "expired";

    return (
      <div
        key={test.id}
        className={`p-3 rounded-lg ${isLatest ? "bg-muted/50" : "bg-muted/30"} ${!isLatest && "ml-4 border-l-2 border-muted"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TestStatusBadge status={test.status} />
                {isLatest && (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                    Latest
                  </Badge>
                )}
                {test.overall_score !== null && (
                  <span className={`text-sm font-medium ${getScoreColor(test.overall_score)}`}>
                    {test.overall_score.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created: {formatDate(test.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {test.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyTestLink(test.access_token)}
              >
                {copied === test.access_token ? (
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

            {hasCompletedTest && !test.overall_score && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleGenerateReport(test.id)}
                disabled={loading === test.id}
              >
                {loading === test.id ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-1" />
                )}
                Generate Report
              </Button>
            )}

            {test.overall_score !== null && test.overall_score !== undefined && (
              <Link href={`/admin/reports/${test.id}`}>
                <Button size="sm" variant="secondary">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View Report
                </Button>
              </Link>
            )}

            {/* Delete test button */}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => confirmDeleteTest(test.id, candidateName)}
              disabled={deleting === test.id}
            >
              {deleting === test.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Delete Test Confirmation Dialog */}
      <Dialog open={showDeleteTestDialog} onOpenChange={setShowDeleteTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Interview?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will permanently delete this interview for{" "}
              <strong>{testToDelete?.candidateName}</strong>, including all
              answers, scores, and any generated reports. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteTestDialog(false);
                setTestToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTest}
              disabled={deleting === testToDelete?.id}
            >
              {deleting === testToDelete?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Interview
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          const tests = candidate.tests || [];
          const latestTest = tests[0]; // Already sorted by created_at desc
          const hasMultipleTests = tests.length > 1;
          const isExpanded = expandedCandidates.has(candidate.id);

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

                {/* Test History Section */}
                {tests.length > 0 ? (
                  <div className="mb-4">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(candidate.id)}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            Test History ({tests.length} test{tests.length > 1 ? "s" : ""})
                          </p>
                        </div>
                        {hasMultipleTests && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7">
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-1" />
                                  Hide older
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-4 h-4 mr-1" />
                                  Show all
                                </>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>

                      {/* Always show latest test */}
                      {latestTest && renderTestRow(latestTest, true, candidate.name)}

                      {/* Older tests (collapsible) */}
                      {hasMultipleTests && (
                        <CollapsibleContent className="space-y-2 mt-2">
                          {tests.slice(1).map((test) => renderTestRow(test, false, candidate.name))}
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  {/* Create New Test button - always visible */}
                  <Button
                    size="sm"
                    onClick={() => handleCreateTest(candidate.id)}
                    disabled={loading === candidate.id}
                    variant={tests.length > 0 ? "outline" : "default"}
                  >
                    {loading === candidate.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : tests.length > 0 ? (
                      <Plus className="w-4 h-4 mr-1" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    {tests.length > 0 ? "New Test" : "Create Test"}
                  </Button>

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
