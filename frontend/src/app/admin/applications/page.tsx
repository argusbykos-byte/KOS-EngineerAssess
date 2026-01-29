"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applicationsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  Clock,
  User,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

// Status badge configuration
const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  },
  reviewing: {
    label: "Reviewing",
    className: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  },
  skills_assessment: {
    label: "Skills Done",
    className: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  },
  analyzed: {
    label: "Analyzed",
    className: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  },
  test_generated: {
    label: "Test Sent",
    className: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30",
  },
  test_in_progress: {
    label: "Testing",
    className: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  },
  hired: {
    label: "Hired",
    className: "bg-green-600/20 text-green-500 border-green-500/30",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/20 text-red-500 border-red-500/30",
  },
};

interface ApplicationListItem {
  id: number;
  full_name: string;
  email: string;
  self_description: string | null;
  status: string;
  suggested_position: string | null;
  position_fit_score: number | null;
  created_at: string;
  updated_at: string;
  has_resume: boolean;
  skills_completed: boolean;
}

export default function ApplicationsPage() {
  const router = useRouter();

  // State
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    stats: {
      new_candidates: number;
      updated_candidates: number;
      resumes_matched: number;
      resumes_missing: number;
      skills_imported: number;
      errors: number;
    };
  } | null>(null);

  // Sync cloud applications to local database
  const syncCloudApplications = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/sync/cloud-applications", {
        method: "POST",
      });
      const result = await response.json();
      if (result.synced > 0) {
        console.log(`Synced ${result.synced} new applications from cloud`);
      }
    } catch (error) {
      console.error("Error syncing cloud applications:", error);
    }
  };

  // Fetch applications
  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Sync cloud applications first
      await syncCloudApplications();

      const params: { status?: string; search?: string; page: number; page_size: number } = {
        page,
        page_size: pageSize,
      };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await applicationsApi.list(params);
      setApplications(response.data.items);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle import from Excel
  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const response = await applicationsApi.importFromExcel();
      setImportResult(response.data);
      if (response.data.success) {
        fetchApplications();
      }
    } catch (error) {
      console.error("Error importing candidates:", error);
      setImportResult({
        success: false,
        message: "Failed to import candidates. Check server logs.",
        stats: {
          new_candidates: 0,
          updated_candidates: 0,
          resumes_matched: 0,
          resumes_missing: 0,
          skills_imported: 0,
          errors: 1,
        },
      });
    } finally {
      setImporting(false);
    }
  };

  // Handle delete with confirmation - deletes from both local and cloud
  const handleDelete = async (app: ApplicationListItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the application for ${app.full_name} (${app.email})?\n\nThis will delete from both local and cloud databases. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(app.id);
    try {
      // Delete from both local SQLite and Neon cloud_applications
      await fetch(`http://localhost:8000/api/sync/cloud-application/${encodeURIComponent(app.email)}`, {
        method: "DELETE",
      });
      fetchApplications();
    } catch (error) {
      console.error("Error deleting application:", error);
      alert("Failed to delete application. It may have been converted to a candidate.");
    } finally {
      setDeletingId(null);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchApplications();
      } else {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Format date helper - converts UTC to Pacific Time
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Count by status
  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Applications
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Review and manage incoming job applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => setImportDialogOpen(true)}
            disabled={importing}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Candidates
          </Button>
          <Button variant="outline" onClick={fetchApplications} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Candidates from Excel</DialogTitle>
            <DialogDescription>
              Import candidates from the KOS Engineering Trial Day Application Form Excel file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will import candidates from:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>~/Downloads/Kos Engineering Trial Day Application Form (Responses).xlsx</li>
              <li>Resumes from ~/Downloads/Resume Trail Stanfor Engineers/</li>
            </ul>

            {importResult && (
              <div className={`p-4 rounded-lg ${importResult.success ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                <p className={`font-medium ${importResult.success ? "text-green-500" : "text-red-500"}`}>
                  {importResult.message}
                </p>
                <div className="mt-2 text-sm space-y-1">
                  <p>New candidates: {importResult.stats.new_candidates}</p>
                  <p>Updated candidates: {importResult.stats.updated_candidates}</p>
                  <p>Resumes matched: {importResult.stats.resumes_matched}</p>
                  <p>Resumes missing: {importResult.stats.resumes_missing}</p>
                  <p>Skills imported: {importResult.stats.skills_imported}</p>
                  {importResult.stats.errors > 0 && (
                    <p className="text-red-500">Errors: {importResult.stats.errors}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportResult(null);
                }}
              >
                {importResult ? "Close" : "Cancel"}
              </Button>
              {!importResult && (
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Start Import"
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">
              {statusCounts.pending || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Skills Done
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-500">
              {statusCounts.skills_assessment || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Test Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-500">
              {statusCounts.test_generated || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">
              {statusCounts.completed || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-600/10 to-green-600/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              {statusCounts.hired || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-11">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="skills_assessment">Skills Done</SelectItem>
            <SelectItem value="analyzed">Analyzed</SelectItem>
            <SelectItem value="test_generated">Test Sent</SelectItem>
            <SelectItem value="test_in_progress">Testing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="hired">Hired</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No applications found</p>
            {(search || statusFilter !== "all") && (
              <Button
                variant="link"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Fit Score</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/applications/${app.id}`)}
                >
                  <TableCell className="font-medium">{app.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {app.email}
                  </TableCell>
                  <TableCell>
                    {app.self_description ? (
                      <span className="text-sm">{app.self_description}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(app.status)}</TableCell>
                  <TableCell>
                    {app.has_resume ? (
                      <FileText className="w-4 h-4 text-green-500" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {app.skills_completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    {app.position_fit_score !== null ? (
                      <span
                        className={`font-medium ${
                          app.position_fit_score >= 70
                            ? "text-green-500"
                            : app.position_fit_score >= 50
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {app.position_fit_score.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(app.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === app.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(app);
                      }}
                    >
                      {deletingId === app.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, total)} of {total} applications
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
