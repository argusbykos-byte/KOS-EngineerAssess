"use client";

import { Card } from "@/components/ui/card";
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
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-500/10 to-cyan-500/10",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400",
      borderColor: "hover:border-blue-500/30",
    },
    {
      title: "Completed Tests",
      value: completedTests,
      icon: FileCheck,
      description: "Assessments finished",
      gradient: "from-emerald-500 to-green-500",
      bgGradient: "from-emerald-500/10 to-green-500/10",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-400",
      borderColor: "hover:border-emerald-500/30",
    },
    {
      title: "Pending Tests",
      value: pendingTests,
      icon: Clock,
      description: "Awaiting completion",
      gradient: "from-amber-500 to-orange-500",
      bgGradient: "from-amber-500/10 to-orange-500/10",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-400",
      borderColor: "hover:border-amber-500/30",
    },
    {
      title: "Avg. Score",
      value: `${avgScore.toFixed(1)}%`,
      icon: TrendingUp,
      description: "Across all tests",
      gradient: "from-violet-500 to-purple-500",
      bgGradient: "from-violet-500/10 to-purple-500/10",
      iconBg: "bg-violet-500/20",
      iconColor: "text-violet-400",
      borderColor: "hover:border-violet-500/30",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={stat.title}
          className={`group relative overflow-hidden border-border/50 ${stat.borderColor} transition-all duration-500 hover:-translate-y-1 hover:shadow-xl animate-fade-in`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

          {/* Top accent line */}
          <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

          {/* Glow effect on hover */}
          <div className={`absolute -inset-px bg-gradient-to-r ${stat.gradient} rounded-xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`} />

          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
                {stat.title}
              </p>
              <div className={`p-2.5 rounded-xl ${stat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>

            <div className="space-y-1">
              <p className={`text-4xl font-bold tracking-tight bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
