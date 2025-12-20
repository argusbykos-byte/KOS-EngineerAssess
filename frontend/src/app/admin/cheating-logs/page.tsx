"use client";

import { useEffect, useState, useCallback } from "react";
import { reportsApi } from "@/lib/api";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  AlertTriangle,
  Eye,
  Clipboard,
  MousePointer,
  Terminal,
  Ban,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface CheatingLog {
  test_id: number;
  candidate_name: string;
  candidate_email: string;
  test_status: string;
  tab_switch_count: number;
  paste_attempt_count: number;
  copy_attempt_count: number;
  right_click_count: number;
  dev_tools_open_count: number;
  focus_loss_count: number;
  total_violations: number;
  warning_count: number;
  is_disqualified: boolean;
  disqualification_reason: string | null;
  disqualified_at: string | null;
  violation_events: Array<{
    type: string;
    timestamp: string;
    details: string;
  }>;
  severity: "low" | "medium" | "high" | "critical";
  created_at: string;
  updated_at: string;
}

const severityColors = {
  low: "bg-blue-500/20 text-blue-500",
  medium: "bg-yellow-500/20 text-yellow-500",
  high: "bg-orange-500/20 text-orange-500",
  critical: "bg-red-500/20 text-red-500",
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  tab_switch: <Eye className="w-3 h-3" />,
  paste_attempt: <Clipboard className="w-3 h-3" />,
  copy_attempt: <Clipboard className="w-3 h-3" />,
  right_click: <MousePointer className="w-3 h-3" />,
  dev_tools_open: <Terminal className="w-3 h-3" />,
  focus_loss: <Eye className="w-3 h-3" />,
};

export default function CheatingLogsPage() {
  const [logs, setLogs] = useState<CheatingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = severityFilter !== "all" ? { severity: severityFilter } : {};
      const response = await reportsApi.getCheatingLogs(params);
      setLogs(response.data.logs);
    } catch (error) {
      console.error("Error fetching cheating logs:", error);
    } finally {
      setLoading(false);
    }
  }, [severityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const stats = {
    total: logs.length,
    critical: logs.filter((l) => l.severity === "critical").length,
    high: logs.filter((l) => l.severity === "high").length,
    disqualified: logs.filter((l) => l.is_disqualified).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrity Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor and review candidate integrity violations
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Flagged</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <Ban className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Disqualified</CardTitle>
            <Ban className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disqualified}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Violation Logs</CardTitle>
              <CardDescription>
                All recorded integrity violations across assessments
              </CardDescription>
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No integrity violations found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Tab</TableHead>
                  <TableHead className="text-center">Copy</TableHead>
                  <TableHead className="text-center">Paste</TableHead>
                  <TableHead className="text-center">DevTools</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.test_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.candidate_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.candidate_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.is_disqualified ? "destructive" : "secondary"}
                      >
                        {log.is_disqualified ? "Disqualified" : log.test_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{log.tab_switch_count}</TableCell>
                    <TableCell className="text-center">{log.copy_attempt_count}</TableCell>
                    <TableCell className="text-center">{log.paste_attempt_count}</TableCell>
                    <TableCell className="text-center">{log.dev_tools_open_count}</TableCell>
                    <TableCell className="text-center font-medium">
                      {log.total_violations}
                    </TableCell>
                    <TableCell>
                      <Badge className={severityColors[log.severity]}>
                        {log.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-yellow-500" />
                              Violation Details - {log.candidate_name}
                            </DialogTitle>
                            <DialogDescription>
                              Test ID: {log.test_id} | Updated:{" "}
                              {new Date(log.updated_at).toLocaleString()}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-6">
                            {log.is_disqualified && (
                              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                                <p className="text-sm font-medium text-red-500 flex items-center gap-2">
                                  <Ban className="w-4 h-4" />
                                  Disqualified
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {log.disqualification_reason}
                                </p>
                                {log.disqualified_at && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    At: {new Date(log.disqualified_at).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{log.tab_switch_count}</p>
                                <p className="text-xs text-muted-foreground">Tab Switches</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{log.copy_attempt_count}</p>
                                <p className="text-xs text-muted-foreground">Copy Attempts</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{log.paste_attempt_count}</p>
                                <p className="text-xs text-muted-foreground">Paste Attempts</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{log.right_click_count}</p>
                                <p className="text-xs text-muted-foreground">Right Clicks</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{log.dev_tools_open_count}</p>
                                <p className="text-xs text-muted-foreground">DevTools</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50 text-center">
                                <p className="text-2xl font-bold">{log.warning_count}</p>
                                <p className="text-xs text-muted-foreground">Warnings Issued</p>
                              </div>
                            </div>

                            {log.violation_events.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-3">Event Timeline</h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                  {log.violation_events.map((event, i) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 text-sm"
                                    >
                                      <div className="p-1 rounded bg-muted">
                                        {eventTypeIcons[event.type] || (
                                          <AlertTriangle className="w-3 h-3" />
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium">
                                            {event.type.replace(/_/g, " ").toUpperCase()}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(event.timestamp).toLocaleTimeString()}
                                          </span>
                                        </div>
                                        {event.details && (
                                          <p className="text-muted-foreground mt-1">
                                            {event.details}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Link href={`/admin/reports/${log.test_id}`}>
                                <Button variant="outline">View Full Report</Button>
                              </Link>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
