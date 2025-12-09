"use client";

import { useEffect, useState } from "react";
import { candidatesApi, reportsApi } from "@/lib/api";
import { Candidate, Report } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDifficultyLabel } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444"];

export default function AnalyticsPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [candidatesRes, reportsRes] = await Promise.all([
          candidatesApi.list(),
          reportsApi.list(),
        ]);
        setCandidates(candidatesRes.data);
        setReports(reportsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate recommendation distribution
  const recommendationCounts = reports.reduce((acc, r) => {
    const rec = r.recommendation || "pending";
    acc[rec] = (acc[rec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recommendationData = [
    { name: "Strong Hire", value: recommendationCounts["strong_hire"] || 0 },
    { name: "Hire", value: recommendationCounts["hire"] || 0 },
    { name: "Maybe", value: recommendationCounts["maybe"] || 0 },
    { name: "No Hire", value: recommendationCounts["no_hire"] || 0 },
  ].filter((d) => d.value > 0);

  // Calculate average scores by category
  const categoryScores: Record<string, { total: number; count: number }> = {};
  reports.forEach((r) => {
    if (r.brain_teaser_score) {
      categoryScores["Brain Teasers"] = categoryScores["Brain Teasers"] || { total: 0, count: 0 };
      categoryScores["Brain Teasers"].total += r.brain_teaser_score;
      categoryScores["Brain Teasers"].count++;
    }
    if (r.coding_score) {
      categoryScores["Coding"] = categoryScores["Coding"] || { total: 0, count: 0 };
      categoryScores["Coding"].total += r.coding_score;
      categoryScores["Coding"].count++;
    }
    if (r.code_review_score) {
      categoryScores["Code Review"] = categoryScores["Code Review"] || { total: 0, count: 0 };
      categoryScores["Code Review"].total += r.code_review_score;
      categoryScores["Code Review"].count++;
    }
    if (r.system_design_score) {
      categoryScores["System Design"] = categoryScores["System Design"] || { total: 0, count: 0 };
      categoryScores["System Design"].total += r.system_design_score;
      categoryScores["System Design"].count++;
    }
    if (r.signal_processing_score) {
      categoryScores["Signal Processing"] = categoryScores["Signal Processing"] || { total: 0, count: 0 };
      categoryScores["Signal Processing"].total += r.signal_processing_score;
      categoryScores["Signal Processing"].count++;
    }
  });

  const categoryData = Object.entries(categoryScores).map(([name, data]) => ({
    name,
    average: data.total / data.count,
  }));

  // Calculate difficulty distribution
  const difficultyData = candidates.reduce((acc, c) => {
    const diff = getDifficultyLabel(c.difficulty);
    const existing = acc.find((d) => d.name === diff);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: diff, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // Score distribution
  const scoreRanges = [
    { name: "0-50%", min: 0, max: 50 },
    { name: "50-70%", min: 50, max: 70 },
    { name: "70-85%", min: 70, max: 85 },
    { name: "85-100%", min: 85, max: 100 },
  ];

  const scoreDistribution = scoreRanges.map((range) => ({
    name: range.name,
    count: reports.filter(
      (r) =>
        r.overall_score !== null &&
        r.overall_score >= range.min &&
        r.overall_score < (range.max === 100 ? 101 : range.max)
    ).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Assessment insights and performance metrics
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recommendation Distribution</CardTitle>
            <CardDescription>
              Breakdown of hiring recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {recommendationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recommendationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {recommendationData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Scores by Category</CardTitle>
            <CardDescription>
              Performance across different assessment areas
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" domain={[0, 100]} stroke="#888" />
                  <YAxis dataKey="name" type="category" width={100} stroke="#888" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #333",
                    }}
                  />
                  <Bar
                    dataKey="average"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>
              Number of candidates in each score range
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a2e",
                    border: "1px solid #333",
                  }}
                />
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Difficulty Level Distribution</CardTitle>
            <CardDescription>
              Candidates by assessment difficulty
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {difficultyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={difficultyData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {difficultyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
