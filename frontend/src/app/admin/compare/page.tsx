"use client";

import { useEffect, useState } from "react";
import { reportsApi } from "@/lib/api";
import { Report } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Users,
  BarChart3,
  X,
  ArrowUpDown,
} from "lucide-react";
import {
  ComparisonRadarChart,
  generateSkillDataFromReport,
} from "@/components/charts/SkillRadarChart";
import { getRecommendationBadge, getScoreColor } from "@/lib/utils";

interface ReportWithComparison extends Report {
  selected?: boolean;
}

export default function CompareCandidatesPage() {
  const [reports, setReports] = useState<ReportWithComparison[]>([]);
  const [selectedReports, setSelectedReports] = useState<ReportWithComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>("overall_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await reportsApi.list();
        setReports(response.data.map((r: Report) => ({ ...r, selected: false })));
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  const toggleSelection = (reportId: number) => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId) {
          const newSelected = !r.selected;
          if (newSelected && selectedReports.length >= 5) {
            return r; // Max 5 candidates
          }
          return { ...r, selected: newSelected };
        }
        return r;
      })
    );

    setSelectedReports((prev) => {
      const report = reports.find((r) => r.id === reportId);
      if (!report) return prev;

      const isSelected = prev.some((r) => r.id === reportId);
      if (isSelected) {
        return prev.filter((r) => r.id !== reportId);
      } else if (prev.length < 5) {
        return [...prev, report];
      }
      return prev;
    });
  };

  const clearSelection = () => {
    setReports((prev) => prev.map((r) => ({ ...r, selected: false })));
    setSelectedReports([]);
  };

  const sortReports = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedReports = [...reports].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField] ?? 0;
    const bVal = (b as unknown as Record<string, unknown>)[sortField] ?? 0;
    const multiplier = sortDirection === "asc" ? 1 : -1;
    return (Number(aVal) - Number(bVal)) * multiplier;
  });

  const comparisonData = selectedReports.map((report, index) => {
    const colors = [
      { fill: "rgba(99, 102, 241, 0.4)", stroke: "#6366f1" },
      { fill: "rgba(236, 72, 153, 0.4)", stroke: "#ec4899" },
      { fill: "rgba(34, 197, 94, 0.4)", stroke: "#22c55e" },
      { fill: "rgba(249, 115, 22, 0.4)", stroke: "#f97316" },
      { fill: "rgba(139, 92, 246, 0.4)", stroke: "#8b5cf6" },
    ];

    return {
      name: report.candidate_name || `Candidate ${index + 1}`,
      data: generateSkillDataFromReport(report),
      fillColor: colors[index % colors.length].fill,
      strokeColor: colors[index % colors.length].stroke,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compare Candidates</h1>
          <p className="text-muted-foreground">
            Select up to 5 candidates to compare their assessment results
          </p>
        </div>
        {selectedReports.length > 0 && (
          <Button onClick={clearSelection} variant="outline" size="sm">
            <X className="w-4 h-4 mr-2" />
            Clear Selection ({selectedReports.length})
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Candidate Selection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Select Candidates
            </CardTitle>
            <CardDescription>
              Choose candidates from completed assessments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => sortReports("overall_score")}
                  >
                    <div className="flex items-center gap-1">
                      Score
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Difficulty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReports.map((report) => {
                  const badge = getRecommendationBadge(report.recommendation);
                  const isSelected = selectedReports.some((r) => r.id === report.id);

                  return (
                    <TableRow
                      key={report.id}
                      className={isSelected ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(report.id)}
                          disabled={!isSelected && selectedReports.length >= 5}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{report.candidate_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {report.candidate_email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={getScoreColor(report.overall_score)}>
                          {report.overall_score?.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{report.difficulty}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Selected Candidates Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Selected ({selectedReports.length}/5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Select candidates to compare
              </p>
            ) : (
              selectedReports.map((report, index) => {
                const colors = [
                  "#6366f1",
                  "#ec4899",
                  "#22c55e",
                  "#f97316",
                  "#8b5cf6",
                ];
                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors[index] }}
                      />
                      <span className="text-sm font-medium truncate max-w-[120px]">
                        {report.candidate_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${getScoreColor(report.overall_score)}`}>
                        {report.overall_score?.toFixed(0)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleSelection(report.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Charts */}
      {selectedReports.length >= 2 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Skills Comparison</CardTitle>
              <CardDescription>
                Radar chart comparing skill levels across candidates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonRadarChart datasets={comparisonData} height={400} />
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <CardDescription>
                Detailed section scores for each candidate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {["brain_teaser", "coding", "code_review", "system_design", "signal_processing"].map(
                (section) => {
                  const sectionName = section
                    .split("_")
                    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                    .join(" ");

                  const sectionKey = `${section}_score` as keyof Report;

                  return (
                    <div key={section}>
                      <p className="text-sm font-medium mb-2">{sectionName}</p>
                      <div className="space-y-2">
                        {selectedReports.map((report, index) => {
                          const score = report[sectionKey] as number | null;
                          const colors = [
                            "#6366f1",
                            "#ec4899",
                            "#22c55e",
                            "#f97316",
                            "#8b5cf6",
                          ];

                          if (score == null) return null;

                          return (
                            <div key={report.id} className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: colors[index] }}
                              />
                              <span className="text-xs w-24 truncate">
                                {report.candidate_name}
                              </span>
                              <div className="flex-1">
                                <Progress
                                  value={score}
                                  className="h-2"
                                  style={
                                    {
                                      "--progress-background": colors[index],
                                    } as React.CSSProperties
                                  }
                                />
                              </div>
                              <span className="text-xs font-medium w-10 text-right">
                                {score.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Comparison Table */}
      {selectedReports.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Comparison</CardTitle>
            <CardDescription>
              Side-by-side comparison of all metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {selectedReports.map((report) => (
                      <TableHead key={report.id} className="text-center">
                        {report.candidate_name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Overall Score</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        <span className={getScoreColor(report.overall_score)}>
                          {report.overall_score?.toFixed(1)}%
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Recommendation</TableCell>
                    {selectedReports.map((report) => {
                      const badge = getRecommendationBadge(report.recommendation);
                      return (
                        <TableCell key={report.id} className="text-center">
                          <Badge className={badge.className}>{badge.label}</Badge>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Brain Teaser</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        {report.brain_teaser_score?.toFixed(0) ?? "-"}%
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Coding</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        {report.coding_score?.toFixed(0) ?? "-"}%
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Code Review</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        {report.code_review_score?.toFixed(0) ?? "-"}%
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">System Design</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        {report.system_design_score?.toFixed(0) ?? "-"}%
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Signal Processing</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        {report.signal_processing_score?.toFixed(0) ?? "-"}%
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Tab Switches</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        <Badge
                          variant={
                            (report.tab_switch_count || 0) > 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {report.tab_switch_count || 0}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Paste Attempts</TableCell>
                    {selectedReports.map((report) => (
                      <TableCell key={report.id} className="text-center">
                        <Badge
                          variant={
                            (report.paste_attempt_count || 0) > 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {report.paste_attempt_count || 0}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
