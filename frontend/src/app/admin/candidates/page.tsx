"use client";

import { useEffect, useState } from "react";
import { candidatesApi } from "@/lib/api";
import { Candidate } from "@/types";
import { CandidateTable } from "@/components/admin/CandidateTable";
import { AddCandidateDialog } from "@/components/admin/AddCandidateDialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCandidates = async () => {
    try {
      const response = await candidatesApi.list();
      setCandidates(response.data);
    } catch (error) {
      console.error("Error fetching candidates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this candidate?")) return;
    try {
      await candidatesApi.delete(id);
      fetchCandidates();
    } catch (error) {
      console.error("Error deleting candidate:", error);
    }
  };

  const filteredCandidates = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold">Candidates</h1>
          <p className="text-muted-foreground">
            Manage all candidates and their assessments
          </p>
        </div>
        <AddCandidateDialog onCandidateAdded={fetchCandidates} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      <CandidateTable
        candidates={filteredCandidates}
        onDelete={handleDelete}
        onRefresh={fetchCandidates}
      />
    </div>
  );
}
