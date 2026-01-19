"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { competitionsApi } from "@/lib/api";
import { formatPacificDate } from "@/lib/utils";
import { CompetitionDetail, RankingsResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  Trophy,
  Users,
  CheckCircle,
  Clock,
  Medal,
  Copy,
  RefreshCw,
} from "lucide-react";

export default function CompetitionDetailPage() {
  const params = useParams();
  const competitionId = parseInt(params.id as string);

  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [rankings, setRankings] = useState<RankingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [qualifying, setQualifying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [compRes, rankingsRes] = await Promise.all([
        competitionsApi.get(competitionId),
        competitionsApi.getRankings(competitionId, 0, 100),
      ]);
      setCompetition(compRes.data);
      setRankings(rankingsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleQualify = async () => {
    if (!confirm(`Mark top ${competition?.qualified_count} candidates as qualified?`)) return;
    setQualifying(true);
    try {
      await competitionsApi.qualifyTopCandidates(competitionId);
      fetchData();
    } catch (error) {
      console.error("Error qualifying candidates:", error);
    } finally {
      setQualifying(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await competitionsApi.update(competitionId, { status: newStatus });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      registration_open: { variant: "default", label: "Registration Open" },
      screening_active: { variant: "secondary", label: "Screening Active" },
      screening_closed: { variant: "outline", label: "Screening Closed" },
      live_active: { variant: "default", label: "Live Competition" },
      completed: { variant: "outline", label: "Completed" },
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const formatDatePT = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return formatPacificDate(dateStr, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 50) return <Badge variant="destructive">High</Badge>;
    if (riskScore >= 25) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const copyRegistrationLink = async () => {
    const link = `${window.location.origin}/competition/register?id=${competitionId}`;
    // Try navigator.clipboard first, then fallbacks
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(link);
        return;
      } catch (err) {
        console.warn("navigator.clipboard.writeText failed:", err);
      }
    }
    // Fallback: execCommand
    try {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch {
      window.prompt("Copy this link manually:", link);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Competition not found</p>
        <Link href="/admin/competitions">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Competitions
          </Button>
        </Link>
      </div>
    );
  }

  const completionRate = competition.registration_count > 0
    ? (competition.completed_count / competition.registration_count) * 100
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/competitions">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{competition.name}</h1>
            <p className="text-muted-foreground">{competition.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(competition.status)}
          <Select
            value={competition.status}
            onValueChange={handleStatusChange}
            disabled={updatingStatus}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registration_open">Registration Open</SelectItem>
              <SelectItem value="screening_active">Screening Active</SelectItem>
              <SelectItem value="screening_closed">Screening Closed</SelectItem>
              <SelectItem value="live_active">Live Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competition.registration_count.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              of {competition.max_participants.toLocaleString()} max
            </p>
            <Progress
              value={(competition.registration_count / competition.max_participants) * 100}
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competition.completed_count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Qualified</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankings?.qualified_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {competition.qualified_count} slots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cutoff Score</CardTitle>
            <Medal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rankings?.cutoff_score?.toFixed(1) || "--"}%
            </div>
            <p className="text-xs text-muted-foreground">Minimum to qualify</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deadline</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {formatDatePT(competition.screening_deadline)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={copyRegistrationLink}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Registration Link
        </Button>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        {competition.status === "screening_closed" && !rankings?.qualified_count && (
          <Button onClick={handleQualify} disabled={qualifying}>
            {qualifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Qualifying...
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 mr-2" />
                Qualify Top {competition.qualified_count}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rankings">
        <TabsList>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="registrations">All Registrations</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>
                Top performers ranked by screening score
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rankings?.rankings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed screenings yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Consistency</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings?.rankings.map((entry) => (
                      <TableRow key={entry.registration_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.rank <= 3 && (
                              <Medal className={`w-4 h-4 ${
                                entry.rank === 1 ? "text-yellow-500" :
                                entry.rank === 2 ? "text-gray-400" :
                                "text-amber-600"
                              }`} />
                            )}
                            <span className="font-bold">#{entry.rank}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.candidate_name}</p>
                            <p className="text-xs text-muted-foreground">{entry.candidate_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${
                            entry.screening_score >= 80 ? "text-green-500" :
                            entry.screening_score >= 60 ? "text-yellow-500" :
                            "text-red-500"
                          }`}>
                            {entry.screening_score.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {entry.consistency_score.toFixed(0)}%
                        </TableCell>
                        <TableCell>
                          {getRiskBadge(entry.risk_score)}
                        </TableCell>
                        <TableCell>
                          {entry.is_qualified ? (
                            <Badge className="bg-green-500">Qualified</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDatePT(entry.screening_completed_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Registrations</CardTitle>
              <CardDescription>
                Everyone who registered for this competition
              </CardDescription>
            </CardHeader>
            <CardContent>
              {competition.registrations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No registrations yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Registered At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Qualified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competition.registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{reg.candidate_name}</p>
                            <p className="text-xs text-muted-foreground">{reg.candidate_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDatePT(reg.registered_at)}
                        </TableCell>
                        <TableCell>
                          {reg.screening_completed ? (
                            <Badge variant="secondary">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {reg.screening_score !== null ? (
                            <span className={`font-medium ${
                              reg.screening_score >= 80 ? "text-green-500" :
                              reg.screening_score >= 60 ? "text-yellow-500" :
                              "text-red-500"
                            }`}>
                              {reg.screening_score.toFixed(1)}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {reg.is_qualified ? (
                            <Badge className="bg-green-500">
                              <Trophy className="w-3 h-3 mr-1" />
                              #{reg.qualification_rank}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
