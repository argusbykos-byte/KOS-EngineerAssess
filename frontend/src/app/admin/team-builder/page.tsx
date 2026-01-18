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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Loader2,
  RefreshCw,
  Users,
  Target,
  ArrowLeft,
  ChevronRight,
  Lightbulb,
  Star,
} from "lucide-react";

interface SpecializationCandidate {
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
}

interface CompositionSuggestion {
  candidate_id: number;
  candidate_name: string;
  primary_specialty: string;
  recommended_role: string;
  team_fit_notes: string;
  synergy_with: string[];
}

interface FocusArea {
  id: string;
  name: string;
  description: string;
  sub_specialties: string[];
}

// Focus area color configuration
const FOCUS_AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ml: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/30" },
  embedded: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  biomedical: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/30" },
  signal_processing: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/30" },
  frontend: { bg: "bg-pink-500/10", text: "text-pink-500", border: "border-pink-500/30" },
  backend: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/30" },
  cybersecurity: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
};

export default function TeamBuilderPage() {
  const router = useRouter();

  // State
  const [candidates, setCandidates] = useState<SpecializationCandidate[]>([]);
  const [suggestions, setSuggestions] = useState<CompositionSuggestion[]>([]);
  const [focusAreaGroups, setFocusAreaGroups] = useState<Record<string, number[]>>({});
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusAreaFilter, setFocusAreaFilter] = useState<string>("all");

  // Selected team
  const [selectedTeam, setSelectedTeam] = useState<number[]>([]);

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

  // Fetch team builder data
  const fetchData = async () => {
    setLoading(true);
    try {
      const focusArea = focusAreaFilter !== "all" ? focusAreaFilter : undefined;
      const response = await specializationApi.getTeamBuilder(focusArea);
      setCandidates(response.data.candidates);
      setSuggestions(response.data.composition_suggestions);
      setFocusAreaGroups(response.data.focus_area_groups);
    } catch (error) {
      console.error("Error fetching team builder data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAreaFilter]);

  // Toggle candidate selection
  const toggleCandidate = (candidateId: number) => {
    setSelectedTeam((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  // Get focus area badge
  const getFocusAreaBadge = (focusArea: string) => {
    const colors = FOCUS_AREA_COLORS[focusArea] || { bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/30" };
    const area = focusAreas.find((a) => a.id === focusArea);
    return (
      <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border}`}>
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

  // Group candidates by focus area
  const candidatesByFocusArea: Record<string, SpecializationCandidate[]> = {};
  candidates.forEach((c) => {
    if (!candidatesByFocusArea[c.focus_area]) {
      candidatesByFocusArea[c.focus_area] = [];
    }
    candidatesByFocusArea[c.focus_area].push(c);
  });

  // Get selected candidates
  const selectedCandidates = candidates.filter((c) =>
    selectedTeam.includes(c.candidate_id)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/specialization-results")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Team Builder
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              Build optimal teams based on candidate specializations
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
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
        {selectedTeam.length > 0 && (
          <Button variant="outline" onClick={() => setSelectedTeam([])}>
            Clear Selection ({selectedTeam.length})
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidates Column */}
          <div className="lg:col-span-2 space-y-6">
            {Object.entries(candidatesByFocusArea).map(([focusArea, areaCandidates]) => (
              <Card key={focusArea}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getFocusAreaBadge(focusArea)}
                    <span>Specialists ({areaCandidates.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {areaCandidates.map((candidate) => {
                      const isSelected = selectedTeam.includes(candidate.candidate_id);
                      const colors = FOCUS_AREA_COLORS[focusArea] || { bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/30" };

                      return (
                        <Card
                          key={candidate.id}
                          className={`cursor-pointer transition-all ${
                            isSelected
                              ? `ring-2 ring-primary ${colors.bg}`
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleCandidate(candidate.candidate_id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{candidate.candidate_name}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {candidate.primary_specialty || "Pending"}
                                </p>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`font-bold ${getScoreColor(candidate.specialty_score)}`}>
                                  {candidate.specialty_score !== null
                                    ? `${candidate.specialty_score.toFixed(0)}%`
                                    : "-"}
                                </span>
                                {isSelected && (
                                  <Star className="w-4 h-4 text-primary mt-1" />
                                )}
                              </div>
                            </div>
                            {candidate.sub_specialties.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {candidate.sub_specialties.slice(0, 2).map((ss, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {ss.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {Object.keys(candidatesByFocusArea).length === 0 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No candidates with specialization results</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Team & Suggestions Column */}
          <div className="space-y-6">
            {/* Selected Team */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Selected Team ({selectedCandidates.length})
                </CardTitle>
                <CardDescription>
                  Click candidates to add/remove from team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No candidates selected
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCandidates.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="text-sm font-medium">{c.candidate_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.primary_specialty}
                          </p>
                        </div>
                        {getFocusAreaBadge(c.focus_area)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    AI Suggestions
                  </CardTitle>
                  <CardDescription>
                    Team composition recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {suggestions.slice(0, 5).map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {suggestion.candidate_name}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {suggestion.recommended_role}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {suggestion.primary_specialty}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {suggestion.team_fit_notes}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            if (!selectedTeam.includes(suggestion.candidate_id)) {
                              toggleCandidate(suggestion.candidate_id);
                            }
                          }}
                          disabled={selectedTeam.includes(suggestion.candidate_id)}
                        >
                          {selectedTeam.includes(suggestion.candidate_id) ? (
                            "Already in team"
                          ) : (
                            <>
                              Add to team
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Focus Area Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Coverage Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(focusAreaGroups).map(([area, candidateIds]) => {
                    const selectedCount = candidateIds.filter((id) =>
                      selectedTeam.includes(id)
                    ).length;
                    const areaInfo = focusAreas.find((a) => a.id === area);

                    return (
                      <div
                        key={area}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{areaInfo?.name || area}</span>
                        <span className="text-muted-foreground">
                          {selectedCount} / {candidateIds.length} selected
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
