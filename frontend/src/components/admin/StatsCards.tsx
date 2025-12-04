"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileCheck, Clock, TrendingUp } from "lucide-react";
import { Candidate, Report } from "@/types";

interface StatsCardsProps {
  candidates: Candidate[];
  reports: Report[];
}

export function StatsCards({ candidates, reports }: StatsCardsProps) {
  const totalCandidates = candidates.length;
  const completedTests = candidates.filter(
    (c) => c.tests?.some((t) => t.status === "completed" || t.status === "expired")
  ).length;
  const pendingTests = candidates.filter(
    (c) => c.tests?.some((t) => t.status === "pending" || t.status === "in_progress")
  ).length;
  const avgScore =
    reports.length > 0
      ? reports.reduce((sum, r) => sum + (r.overall_score || 0), 0) / reports.length
      : 0;

  const stats = [
    {
      title: "Total Candidates",
      value: totalCandidates,
      icon: Users,
      description: "Registered candidates",
      color: "text-blue-500",
    },
    {
      title: "Completed Tests",
      value: completedTests,
      icon: FileCheck,
      description: "Assessments finished",
      color: "text-green-500",
    },
    {
      title: "Pending Tests",
      value: pendingTests,
      icon: Clock,
      description: "Awaiting completion",
      color: "text-yellow-500",
    },
    {
      title: "Avg. Score",
      value: `${avgScore.toFixed(1)}%`,
      icon: TrendingUp,
      description: "Across all tests",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
