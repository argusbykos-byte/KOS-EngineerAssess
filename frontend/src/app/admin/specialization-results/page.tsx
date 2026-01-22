"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { specializationApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Target,
  Users,
  Award,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { formatPacificDate } from "@/lib/utils";

interface SpecializationResultItem {
  id: number;
  test_id: number;
  access_token: string;
  candidate_id: number;
  candidate_name: string;
  focus_area: string;
  primary_specialty: string | null;
  specialty_score: number | null;
  status: string;
  created_at: string;
}

interface FocusArea {
  id: string;
  name: string;
  description: string;
  sub_specialties: string[];
}

// Focus area color configuration
const FOCUS_AREA_COLORS: Record<string, string> = {
  ml: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  embedded: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  biomedical: "bg-green-500/20 text-green-500 border-green-500/30",
  signal_processing: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  frontend: "bg-pink-500/20 text-pink-500 border-pink-500/30",
  backend: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  cybersecurity: "bg-red-500/20 text-red-500 border-red-500/30",
};

export default function SpecializationResultsPage() {
  const router = useRouter();

  // State
  const [results, setResults] = useState<SpecializationResultItem[]>([]);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusAreaFilter, setFocusAreaFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Detail dialog
  const [selectedResult, setSelectedResult] = useState<{
    id: number;
    test_id: number;
    candidate_id: number;
    candidate_name: string | null;
    focus_area: string;
    primary_specialty: string | null;
    specialty_score: number | null;
    confidence: number | null;
    sub_specialties: Array<{
      name: string;
      score: number;
      rank: number;
      evidence: string | null;
    }>;
    recommended_tasks: string[];
    team_fit_analysis: string | null;
    created_at: string;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch focus areas on mount
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

  // Fetch results
  const fetchResults = async () => {
    setLoading(true);
    try {
      const params: { focus_area?: string; page: number; page_size: number } = {
        page,
        page_size: pageSize,
      };
      if (focusAreaFilter !== "all") {
        params.focus_area = focusAreaFilter;
      }

      const response = await specializationApi.listResults(params);
      setResults(response.data.items);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Error fetching specialization results:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, focusAreaFilter]);

  // View result details
  const viewResultDetails = async (item: SpecializationResultItem) => {
    setDetailLoading(true);
    try {
      // Use test_id (not id) - the API is /specialization/{test_id}/results
      const response = await specializationApi.getResults(item.test_id);
      setSelectedResult(response.data);
    } catch (error) {
      console.error("Error fetching result details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return formatPacificDate(dateStr, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get focus area badge
  const getFocusAreaBadge = (focusArea: string) => {
    const colorClass = FOCUS_AREA_COLORS[focusArea] || "bg-gray-500/20 text-gray-500 border-gray-500/30";
    const area = focusAreas.find((a) => a.id === focusArea);
    return (
      <Badge variant="outline" className={colorClass}>
        {area?.name || focusArea}
      </Badge>
    );
  };

  // Get score color
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 85) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  // Count by focus area
  const focusAreaCounts = results.reduce((acc, r) => {
    acc[r.focus_area] = (acc[r.focus_area] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Specialization Results
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            View candidate specialization test results and sub-specialty rankings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/team-builder")}>
            <Users className="w-4 h-4 mr-2" />
            Team Builder
          </Button>
          <Button variant="outline" onClick={fetchResults} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ML Specialists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-500">
              {focusAreaCounts.ml || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Embedded Specialists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">
              {focusAreaCounts.embedded || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Biomedical Specialists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              {focusAreaCounts.biomedical || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={focusAreaFilter} onValueChange={setFocusAreaFilter}>
          <SelectTrigger className="w-[200px] h-11">
            <SelectValue placeholder="Filter by focus area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Focus Areas</SelectItem>
            {focusAreas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No specialization results found</p>
            {focusAreaFilter !== "all" && (
              <Button
                variant="link"
                onClick={() => setFocusAreaFilter("all")}
              >
                Clear filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Focus Area</TableHead>
                <TableHead>Primary Specialty</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow
                  key={result.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => viewResultDetails(result)}
                >
                  <TableCell className="font-medium">{result.candidate_name}</TableCell>
                  <TableCell>{getFocusAreaBadge(result.focus_area)}</TableCell>
                  <TableCell>
                    {result.primary_specialty ? (
                      <span className="text-sm">{result.primary_specialty}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Pending analysis</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${getScoreColor(result.specialty_score)}`}>
                      {result.specialty_score !== null
                        ? `${result.specialty_score.toFixed(0)}%`
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {result.status === "pending" || result.status === "in_progress" ? (
                      <Badge
                        variant="outline"
                        className={`cursor-pointer hover:opacity-80 transition-opacity ${
                          result.status === "in_progress"
                            ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30"
                            : "bg-gray-500/20 text-gray-500 border-gray-500/30 hover:bg-gray-500/30"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/specialization/${result.access_token}`, '_blank');
                        }}
                        title="Open test link"
                      >
                        {result.status}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:opacity-80 transition-opacity bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewResultDetails(result);
                        }}
                        title="View results"
                      >
                        {result.status}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(result.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, total)} of {total} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : selectedResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedResult.candidate_name}
                </DialogTitle>
                <DialogDescription>
                  {getFocusAreaBadge(selectedResult.focus_area)}
                  <span className="ml-2">Specialization Assessment</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Primary Specialty */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-500" />
                      Primary Specialty
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">
                      {selectedResult.primary_specialty || "Pending analysis"}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Score</p>
                        <p className={`text-xl font-bold ${getScoreColor(selectedResult.specialty_score)}`}>
                          {selectedResult.specialty_score !== null
                            ? `${selectedResult.specialty_score.toFixed(0)}%`
                            : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-xl font-bold">
                          {selectedResult.confidence !== null
                            ? `${selectedResult.confidence.toFixed(0)}%`
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sub-specialties Ranking */}
                {selectedResult.sub_specialties.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Sub-specialty Rankings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedResult.sub_specialties.map((ss, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {ss.rank}
                              </span>
                              <span>{ss.name}</span>
                            </div>
                            <span className={`font-medium ${getScoreColor(ss.score)}`}>
                              {ss.score.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommended Tasks */}
                {selectedResult.recommended_tasks.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-green-500" />
                        Recommended Tasks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {selectedResult.recommended_tasks.map((task, idx) => (
                          <li key={idx}>{task}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Team Fit Analysis */}
                {selectedResult.team_fit_analysis && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        Team Fit Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedResult.team_fit_analysis}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
