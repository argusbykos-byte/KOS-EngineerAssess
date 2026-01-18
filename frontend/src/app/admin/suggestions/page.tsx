"use client";

import { useEffect, useState, useCallback } from "react";
import { feedbackApi } from "@/lib/api";
import { formatPacificDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  MessageSquare,
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Eye,
  Terminal,
  Lightbulb,
  Bug,
  HelpCircle,
  Filter,
} from "lucide-react";

interface Suggestion {
  id: number;
  candidate_id: number | null;
  test_id: number | null;
  raw_feedback: string;
  kimi2_analysis: {
    is_valid: boolean;
    category: string;
    priority: string;
    can_auto_implement: boolean;
    suggested_action: string;
    extracted_content?: Record<string, unknown>;
    reasoning: string;
  } | null;
  claude_code_command: string | null;
  status: string;
  implemented_at: string | null;
  implemented_by: string | null;
  implementation_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
  total: number;
  pending_count: number;
  auto_implemented_count: number;
}

const categoryIcons: Record<string, React.ElementType> = {
  new_question: Lightbulb,
  improve_question: RefreshCw,
  new_terminology: MessageSquare,
  ui_feedback: Eye,
  technical_issue: Bug,
  other: HelpCircle,
};

const categoryLabels: Record<string, string> = {
  new_question: "New Question",
  improve_question: "Improve Question",
  new_terminology: "New Terminology",
  ui_feedback: "UI Feedback",
  technical_issue: "Technical Issue",
  other: "Other",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-500",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  auto_implemented: "bg-green-500",
  admin_reviewed: "bg-blue-500",
  ignored: "bg-slate-500",
  failed: "bg-red-500",
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, autoImplemented: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Dialog states
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showClaudeCommand, setShowClaudeCommand] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [implementationNotes, setImplementationNotes] = useState("");

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;

      const response = await feedbackApi.list(params);
      const data = response.data as SuggestionsResponse;
      setSuggestions(data.suggestions);
      setStats({
        total: data.total,
        pending: data.pending_count,
        autoImplemented: data.auto_implemented_count,
      });
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleViewDetails = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setImplementationNotes(suggestion.implementation_notes || "");
    setShowDetailDialog(true);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedSuggestion) return;
    setUpdating(true);
    try {
      await feedbackApi.update(selectedSuggestion.id, {
        status: newStatus,
        implementation_notes: implementationNotes,
      });
      await fetchSuggestions();
      setShowDetailDialog(false);
    } catch (error) {
      console.error("Error updating suggestion:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleRetryAutoImplement = async (id: number) => {
    setUpdating(true);
    try {
      const response = await feedbackApi.retryAutoImplement(id);
      if (response.data.success) {
        alert("Successfully auto-implemented!");
      } else {
        alert(`Failed: ${response.data.message}`);
      }
      await fetchSuggestions();
    } catch (error) {
      console.error("Error retrying auto-implement:", error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this suggestion?")) return;
    try {
      await feedbackApi.delete(id);
      await fetchSuggestions();
      setShowDetailDialog(false);
    } catch (error) {
      console.error("Error deleting suggestion:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return formatPacificDateTime(dateString);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8" />
            Improvement Suggestions
          </h1>
          <p className="text-muted-foreground">
            Review and manage candidate feedback for system improvements
          </p>
        </div>
        <Button onClick={fetchSuggestions} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-500" />
              Auto-Implemented
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.autoImplemented}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-40">
              <label className="text-sm text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="auto_implemented">Auto-Implemented</SelectItem>
                  <SelectItem value="admin_reviewed">Admin Reviewed</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-sm text-muted-foreground mb-1 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="new_question">New Question</SelectItem>
                  <SelectItem value="improve_question">Improve Question</SelectItem>
                  <SelectItem value="new_terminology">New Terminology</SelectItem>
                  <SelectItem value="ui_feedback">UI Feedback</SelectItem>
                  <SelectItem value="technical_issue">Technical Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-sm text-muted-foreground mb-1 block">Priority</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No suggestions found matching your filters.
            </CardContent>
          </Card>
        ) : (
          suggestions.map((suggestion) => {
            const CategoryIcon = categoryIcons[suggestion.kimi2_analysis?.category || "other"] || HelpCircle;
            const category = suggestion.kimi2_analysis?.category || "other";
            const priority = suggestion.kimi2_analysis?.priority || "medium";

            return (
              <Card key={suggestion.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="w-5 h-5 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {categoryLabels[category]}
                      </CardTitle>
                      <Badge className={priorityColors[priority]}>
                        {priority}
                      </Badge>
                      <Badge className={statusColors[suggestion.status]}>
                        {suggestion.status.replace("_", " ")}
                      </Badge>
                      {suggestion.kimi2_analysis?.can_auto_implement && suggestion.status === "pending" && (
                        <Badge variant="outline" className="border-green-500 text-green-500">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Auto-implementable
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(suggestion.created_at)}
                    </span>
                  </div>
                  <CardDescription className="mt-2">
                    {suggestion.raw_feedback.substring(0, 200)}
                    {suggestion.raw_feedback.length > 200 && "..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {suggestion.kimi2_analysis?.suggested_action}
                    </div>
                    <div className="flex gap-2">
                      {suggestion.kimi2_analysis?.can_auto_implement && suggestion.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryAutoImplement(suggestion.id)}
                          disabled={updating}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Auto-Implement
                        </Button>
                      )}
                      {suggestion.claude_code_command && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSuggestion(suggestion);
                            setShowClaudeCommand(true);
                          }}
                        >
                          <Terminal className="w-4 h-4 mr-1" />
                          View Command
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleViewDetails(suggestion)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suggestion Details</DialogTitle>
            <DialogDescription>
              Review and manage this improvement suggestion
            </DialogDescription>
          </DialogHeader>

          {selectedSuggestion && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Raw Feedback</label>
                <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                  {selectedSuggestion.raw_feedback}
                </div>
              </div>

              {selectedSuggestion.kimi2_analysis && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <div className="mt-1">
                        <Badge>{categoryLabels[selectedSuggestion.kimi2_analysis.category]}</Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <div className="mt-1">
                        <Badge className={priorityColors[selectedSuggestion.kimi2_analysis.priority]}>
                          {selectedSuggestion.kimi2_analysis.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">AI Analysis</label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                      {selectedSuggestion.kimi2_analysis.reasoning}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Suggested Action</label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                      {selectedSuggestion.kimi2_analysis.suggested_action}
                    </div>
                  </div>

                  {selectedSuggestion.kimi2_analysis.extracted_content && (
                    <div>
                      <label className="text-sm font-medium">Extracted Content</label>
                      <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(selectedSuggestion.kimi2_analysis.extracted_content, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-sm font-medium">Implementation Notes</label>
                <Textarea
                  className="mt-1"
                  value={implementationNotes}
                  onChange={(e) => setImplementationNotes(e.target.value)}
                  placeholder="Add notes about this suggestion..."
                />
              </div>

              <div className="flex items-center gap-2 pt-4 border-t">
                <label className="text-sm font-medium">Update Status:</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus("admin_reviewed")}
                  disabled={updating}
                >
                  <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                  Mark Reviewed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus("ignored")}
                  disabled={updating}
                >
                  <XCircle className="w-4 h-4 mr-1 text-slate-500" />
                  Ignore
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(selectedSuggestion.id)}
                  disabled={updating}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Claude Code Command Dialog */}
      <Dialog open={showClaudeCommand} onOpenChange={setShowClaudeCommand}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Claude Code Command
            </DialogTitle>
            <DialogDescription>
              Copy this command to implement the suggestion manually
            </DialogDescription>
          </DialogHeader>

          {selectedSuggestion?.claude_code_command && (
            <div className="space-y-4">
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                {selectedSuggestion.claude_code_command}
              </pre>
              <Button
                onClick={async () => {
                  const text = selectedSuggestion.claude_code_command || "";
                  let copied = false;
                  // Try navigator.clipboard first
                  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                    try {
                      await navigator.clipboard.writeText(text);
                      copied = true;
                    } catch (err) {
                      console.warn("navigator.clipboard.writeText failed:", err);
                    }
                  }
                  // Fallback: execCommand
                  if (!copied) {
                    try {
                      const textArea = document.createElement("textarea");
                      textArea.value = text;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-999999px";
                      document.body.appendChild(textArea);
                      textArea.select();
                      copied = document.execCommand("copy");
                      document.body.removeChild(textArea);
                    } catch (err) {
                      console.warn("execCommand copy failed:", err);
                    }
                  }
                  if (copied) {
                    alert("Copied to clipboard!");
                  } else {
                    window.prompt("Copy this command manually:", text);
                  }
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClaudeCommand(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
