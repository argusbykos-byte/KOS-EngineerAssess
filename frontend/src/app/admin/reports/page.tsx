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
import {
  getCategoryLabel,
  getDifficultyLabel,
  getScoreColor,
  getRecommendationBadge,
} from "@/lib/utils";
import { Loader2, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await reportsApi.list();
        setReports(response.data);
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assessment Reports</h1>
        <p className="text-muted-foreground">
          View detailed assessment reports for all candidates
        </p>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reports generated yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Complete a test to generate a report
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => {
            const badge = getRecommendationBadge(report.recommendation);

            return (
              <Card key={report.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {report.candidate_name}
                      </CardTitle>
                      <CardDescription>{report.candidate_email}</CardDescription>
                    </div>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="mb-4">
                    <p className="text-3xl font-bold">
                      <span className={getScoreColor(report.overall_score)}>
                        {report.overall_score?.toFixed(1)}%
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {report.categories?.map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {getCategoryLabel(cat)}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="text-xs">
                      {getDifficultyLabel(report.difficulty || "")}
                    </Badge>
                  </div>

                  {report.ai_summary && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                      {report.ai_summary}
                    </p>
                  )}

                  <Link href={`/admin/reports/${report.test_id}`}>
                    <Button className="w-full" variant="outline">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Full Report
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
