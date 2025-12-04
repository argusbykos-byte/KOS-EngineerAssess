"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { reportsApi, questionsApi } from "@/lib/api";
import { Report, Question } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCategoryLabel,
  getDifficultyLabel,
  getScoreColor,
  getRecommendationBadge,
} from "@/lib/utils";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Eye,
  Clipboard,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ReportDetailPage() {
  const params = useParams();
  const testId = Number(params.testId);
  const [report, setReport] = useState<Report | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, questionsRes] = await Promise.all([
          reportsApi.getByTest(testId),
          questionsApi.getByTest(testId),
        ]);
        setReport(reportRes.data);
        setQuestions(questionsRes.data);
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };

    if (testId) {
      fetchData();
    }
  }, [testId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Report not found</p>
        <Link href="/admin/reports">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
        </Link>
      </div>
    );
  }

  const badge = getRecommendationBadge(report.recommendation);

  const sectionScores = [
    { name: "Brain Teasers", score: report.brain_teaser_score, key: "brain_teaser" },
    { name: "Coding", score: report.coding_score, key: "coding" },
    { name: "Code Review", score: report.code_review_score, key: "code_review" },
    { name: "System Design", score: report.system_design_score, key: "system_design" },
    { name: "Signal Processing", score: report.signal_processing_score, key: "signal_processing" },
  ].filter((s) => s.score !== null);

  const questionsByCategory = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/reports">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{report.candidate_name}</h1>
          <p className="text-muted-foreground">{report.candidate_email}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Assessment Summary</CardTitle>
                <CardDescription>
                  {getDifficultyLabel(report.difficulty || "")} level assessment
                </CardDescription>
              </div>
              <Badge className={badge.className}>{badge.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-5xl font-bold">
                  <span className={getScoreColor(report.overall_score)}>
                    {report.overall_score?.toFixed(1)}%
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">Overall Score</p>
              </div>

              <div className="flex-1 space-y-3">
                {sectionScores.map((section) => (
                  <div key={section.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{section.name}</span>
                      <span className={getScoreColor(section.score)}>
                        {section.score?.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={section.score || 0} />
                  </div>
                ))}
              </div>
            </div>

            {report.ai_summary && (
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">AI Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  {report.ai_summary}
                </p>
              </div>
            )}

            {report.detailed_feedback && (
              <div>
                <h3 className="font-medium mb-2">Detailed Feedback</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {report.detailed_feedback}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {report.strengths && report.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.strengths.map((strength, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.weaknesses && report.weaknesses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Anti-Cheat Monitoring Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Integrity Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Tab Switches</span>
                </div>
                <Badge
                  variant={report.tab_switch_count && report.tab_switch_count > 0 ? "destructive" : "secondary"}
                >
                  {report.tab_switch_count || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Paste Attempts</span>
                </div>
                <Badge
                  variant={report.paste_attempt_count && report.paste_attempt_count > 0 ? "destructive" : "secondary"}
                >
                  {report.paste_attempt_count || 0}
                </Badge>
              </div>

              {report.tab_switch_timestamps && report.tab_switch_timestamps.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Tab Switch Timeline:</p>
                  <div className="space-y-1">
                    {report.tab_switch_timestamps.slice(0, 5).map((timestamp, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(timestamp).toLocaleString()}
                      </p>
                    ))}
                    {report.tab_switch_timestamps.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{report.tab_switch_timestamps.length - 5} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
          <CardDescription>
            Individual question responses and scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={Object.keys(questionsByCategory)[0]}>
            <TabsList className="mb-4">
              {Object.keys(questionsByCategory).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {getCategoryLabel(category)}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(questionsByCategory).map(([category, qs]) => (
              <TabsContent key={category} value={category} className="space-y-4">
                {qs.map((question, i) => (
                  <div
                    key={question.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Question {i + 1}</h4>
                        {question.answer?.time_spent_seconds !== null && question.answer?.time_spent_seconds !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {Math.floor(question.answer.time_spent_seconds / 60)}m {question.answer.time_spent_seconds % 60}s
                          </Badge>
                        )}
                        {question.answer?.is_suspiciously_fast && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Quick Answer
                          </Badge>
                        )}
                      </div>
                      {question.answer?.score !== null && question.answer?.score !== undefined && (
                        <Badge
                          className={
                            question.answer.score >= 70
                              ? "bg-green-500/20 text-green-500"
                              : question.answer.score >= 50
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-red-500/20 text-red-500"
                          }
                        >
                          {question.answer.score.toFixed(0)}%
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm mb-3">{question.question_text}</p>

                    {question.question_code && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Given Code:
                        </p>
                        <pre className="p-3 rounded bg-muted text-xs overflow-x-auto">
                          {question.question_code}
                        </pre>
                      </div>
                    )}

                    {question.answer && (
                      <div className="space-y-3 mt-4 pt-4 border-t">
                        {question.answer.candidate_answer && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Candidate Answer:
                            </p>
                            <p className="text-sm p-3 rounded bg-muted/50">
                              {question.answer.candidate_answer}
                            </p>
                          </div>
                        )}

                        {question.answer.candidate_code && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Candidate Code:
                            </p>
                            <pre className="p-3 rounded bg-muted/50 text-xs overflow-x-auto">
                              {question.answer.candidate_code}
                            </pre>
                          </div>
                        )}

                        {question.answer.feedback && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              AI Feedback:
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {question.answer.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
