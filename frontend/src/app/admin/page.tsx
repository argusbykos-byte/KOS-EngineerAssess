"use client";

import { useEffect, useState } from "react";
import { candidatesApi, reportsApi } from "@/lib/api";
import { Candidate, Report } from "@/types";
import { StatsCards } from "@/components/admin/StatsCards";
import { CandidateTable } from "@/components/admin/CandidateTable";
import { AddCandidateDialog } from "@/components/admin/AddCandidateDialog";
import { Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this candidate?")) return;
    try {
      await candidatesApi.delete(id);
      fetchData();
    } catch (error) {
      console.error("Error deleting candidate:", error);
    }
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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage candidates and view assessment results
          </p>
        </div>
        <AddCandidateDialog onCandidateAdded={fetchData} />
      </div>

      <StatsCards candidates={candidates} reports={reports} />

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Candidates</h2>
        <CandidateTable
          candidates={candidates.slice(0, 5)}
          onDelete={handleDelete}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
