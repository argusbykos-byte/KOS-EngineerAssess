"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export interface SkillData {
  skill: string;
  score: number;
  fullMark?: number;
}

interface SkillRadarChartProps {
  data: SkillData[];
  title?: string;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
  showLegend?: boolean;
  candidateName?: string;
}

export function SkillRadarChart({
  data,
  title,
  height = 300,
  fillColor = "rgba(99, 102, 241, 0.3)",
  strokeColor = "#6366f1",
  showLegend = false,
  candidateName = "Candidate",
}: SkillRadarChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    fullMark: item.fullMark || 100,
  }));

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-center mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid
            stroke="#e5e7eb"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickCount={5}
          />
          <Radar
            name={candidateName}
            dataKey="score"
            stroke={strokeColor}
            fill={fillColor}
            fillOpacity={0.6}
            strokeWidth={2}
          />
          {showLegend && <Legend />}
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ComparisonRadarChartProps {
  datasets: Array<{
    name: string;
    data: SkillData[];
    fillColor: string;
    strokeColor: string;
  }>;
  height?: number;
}

export function ComparisonRadarChart({
  datasets,
  height = 350,
}: ComparisonRadarChartProps) {
  if (datasets.length === 0) return null;

  // Merge all datasets into a single array for the chart
  const skills = datasets[0].data.map((d) => d.skill);
  const chartData = skills.map((skill) => {
    const point: Record<string, number | string> = { skill };
    datasets.forEach((dataset) => {
      const skillData = dataset.data.find((d) => d.skill === skill);
      point[dataset.name] = skillData?.score || 0;
    });
    return point;
  });

  const colors = [
    { fill: "rgba(99, 102, 241, 0.3)", stroke: "#6366f1" },
    { fill: "rgba(236, 72, 153, 0.3)", stroke: "#ec4899" },
    { fill: "rgba(34, 197, 94, 0.3)", stroke: "#22c55e" },
    { fill: "rgba(249, 115, 22, 0.3)", stroke: "#f97316" },
    { fill: "rgba(139, 92, 246, 0.3)", stroke: "#8b5cf6" },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
        <PolarGrid stroke="#e5e7eb" strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="skill"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickCount={5}
        />
        {datasets.map((dataset, index) => (
          <Radar
            key={dataset.name}
            name={dataset.name}
            dataKey={dataset.name}
            stroke={dataset.strokeColor || colors[index % colors.length].stroke}
            fill={dataset.fillColor || colors[index % colors.length].fill}
            fillOpacity={0.4}
            strokeWidth={2}
          />
        ))}
        <Legend />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Helper function to generate skill data from report section scores
export function generateSkillDataFromReport(report: {
  brain_teaser_score?: number | null;
  coding_score?: number | null;
  code_review_score?: number | null;
  system_design_score?: number | null;
  signal_processing_score?: number | null;
}): SkillData[] {
  const skills: SkillData[] = [];

  if (report.brain_teaser_score != null) {
    skills.push({ skill: "Problem Solving", score: report.brain_teaser_score });
  }
  if (report.coding_score != null) {
    skills.push({ skill: "Coding", score: report.coding_score });
  }
  if (report.code_review_score != null) {
    skills.push({ skill: "Code Review", score: report.code_review_score });
  }
  if (report.system_design_score != null) {
    skills.push({ skill: "System Design", score: report.system_design_score });
  }
  if (report.signal_processing_score != null) {
    skills.push({ skill: "Signal Processing", score: report.signal_processing_score });
  }

  return skills;
}
