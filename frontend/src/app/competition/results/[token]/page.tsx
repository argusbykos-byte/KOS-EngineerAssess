"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { competitionsApi } from "@/lib/api";
import { ScreeningResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Trophy,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Medal,
  Activity,
} from "lucide-react";

function ResultsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const competitionId = parseInt(searchParams.get("competition") || "0");

  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!competitionId) {
        setError("Competition ID is required");
        setLoading(false);
        return;
      }

      try {
        const res = await competitionsApi.getResults(competitionId, token);
        setResult(res.data);
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string } } };
        setError(err.response?.data?.detail || "Failed to load results");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [competitionId, token]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 50) return <Badge variant="destructive">High Risk</Badge>;
    if (riskScore >= 25) return <Badge variant="secondary">Medium Risk</Badge>;
    return <Badge variant="outline">Low Risk</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive">{error}</p>
            <Link href="/competition" className="mt-4 inline-block">
              <Button variant="outline">
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back to Competitions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result?.screening_completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Test Not Completed</h2>
            <p className="text-muted-foreground">
              You haven&apos;t completed the screening test yet.
            </p>
            <Link href={`/competition/screening/${token}?competition=${competitionId}`}>
              <Button>Continue Test</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {result.is_qualified ? (
                <Trophy className="w-16 h-16 text-yellow-500" />
              ) : result.screening_score && result.screening_score >= 60 ? (
                <CheckCircle className="w-16 h-16 text-green-500" />
              ) : (
                <XCircle className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
            <CardTitle className="text-2xl">Screening Results</CardTitle>
            <CardDescription>
              {result.competition_name} - {result.candidate_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score */}
            <div className="text-center">
              <div className={`text-5xl font-bold ${getScoreColor(result.screening_score || 0)}`}>
                {result.screening_score?.toFixed(1)}%
              </div>
              <p className="text-muted-foreground mt-1">Overall Score</p>
            </div>

            <Progress value={result.screening_score || 0} className="h-3" />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-2xl font-bold">{result.questions_answered}</p>
                <p className="text-xs text-muted-foreground">Answered</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-2xl font-bold">{result.total_questions}</p>
                <p className="text-xs text-muted-foreground">Total Questions</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-2xl font-bold">
                  {result.screening_percentile?.toFixed(1) || "--"}%
                </p>
                <p className="text-xs text-muted-foreground">Percentile</p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                {result.is_qualified ? (
                  <>
                    <Medal className="w-6 h-6 mx-auto text-yellow-500" />
                    <p className="text-xs text-muted-foreground">Qualified!</p>
                  </>
                ) : result.qualification_rank ? (
                  <>
                    <p className="text-2xl font-bold">#{result.qualification_rank}</p>
                    <p className="text-xs text-muted-foreground">Rank</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold">Pending</p>
                    <p className="text-xs text-muted-foreground">Ranking</p>
                  </>
                )}
              </div>
            </div>

            {/* Qualification Status */}
            {result.is_qualified !== null && (
              <div className={`p-4 rounded-lg text-center ${
                result.is_qualified ? "bg-green-500/10 border border-green-500/30" : "bg-muted"
              }`}>
                {result.is_qualified ? (
                  <>
                    <Trophy className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                    <p className="font-bold text-green-500">Congratulations! You Qualified!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You are ranked #{result.qualification_rank} and have qualified for the live competition.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Thank you for participating!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Unfortunately, you did not qualify for the live competition this time.
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Behavioral Metrics */}
        {result.behavioral_metrics && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Behavioral Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <p className="font-bold">
                    {result.behavioral_metrics.average_response_time?.toFixed(0) || "--"}s
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                </div>
                <div>
                  <p className="font-bold">
                    {result.behavioral_metrics.fastest_response?.toFixed(0) || "--"}s
                  </p>
                  <p className="text-xs text-muted-foreground">Fastest</p>
                </div>
                <div>
                  <p className="font-bold">
                    {result.behavioral_metrics.slowest_response?.toFixed(0) || "--"}s
                  </p>
                  <p className="text-xs text-muted-foreground">Slowest</p>
                </div>
                <div>
                  <p className="font-bold">
                    {result.behavioral_metrics.consistency_score?.toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Consistency</p>
                </div>
              </div>

              {result.behavioral_metrics.anomaly_flags.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Flags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.behavioral_metrics.anomaly_flags.map((flag, idx) => (
                      <Badge
                        key={idx}
                        variant={flag.severity === "high" ? "destructive" : "secondary"}
                      >
                        {flag.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm">Risk Assessment</span>
                {getRiskBadge(result.behavioral_metrics.risk_score)}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center mt-8">
          <Link href="/competition">
            <Button variant="outline">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Competitions
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
