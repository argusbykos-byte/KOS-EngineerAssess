"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { competitionsApi } from "@/lib/api";
import { Competition } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trophy,
  Users,
  Calendar,
  Eye,
  Trash2,
  Settings,
  Pencil,
} from "lucide-react";

const defaultFormData = {
  name: "",
  description: "",
  screening_start_date: "",
  screening_deadline: "",
  live_competition_date: "",
  max_participants: 30000,
  qualified_count: 500,
  test_duration_minutes: 60,
  questions_count: 20,
  status: "registration_open",
};

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState(defaultFormData);
  const [editFormData, setEditFormData] = useState(defaultFormData);

  const fetchCompetitions = async () => {
    try {
      const res = await competitionsApi.list();
      setCompetitions(res.data);
    } catch (error) {
      console.error("Error fetching competitions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await competitionsApi.create({
        ...formData,
        screening_start_date: formData.screening_start_date || undefined,
        screening_deadline: formData.screening_deadline || undefined,
        live_competition_date: formData.live_competition_date || undefined,
      });
      setDialogOpen(false);
      setFormData(defaultFormData);
      fetchCompetitions();
    } catch (error) {
      console.error("Error creating competition:", error);
    } finally {
      setCreating(false);
    }
  };

  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
  };

  const handleEditClick = (comp: Competition) => {
    setEditingCompetition(comp);
    setEditFormData({
      name: comp.name,
      description: comp.description || "",
      screening_start_date: formatDateForInput(comp.screening_start_date),
      screening_deadline: formatDateForInput(comp.screening_deadline),
      live_competition_date: formatDateForInput(comp.live_competition_date),
      max_participants: comp.max_participants,
      qualified_count: comp.qualified_count,
      test_duration_minutes: comp.test_duration_minutes,
      questions_count: comp.questions_count,
      status: comp.status,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCompetition) return;
    setSaving(true);
    try {
      await competitionsApi.update(editingCompetition.id, {
        ...editFormData,
        screening_start_date: editFormData.screening_start_date || undefined,
        screening_deadline: editFormData.screening_deadline || undefined,
        live_competition_date: editFormData.live_competition_date || undefined,
      });
      setEditDialogOpen(false);
      setEditingCompetition(null);
      fetchCompetitions();
    } catch (error) {
      console.error("Error updating competition:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this competition?")) return;
    try {
      await competitionsApi.delete(id);
      fetchCompetitions();
    } catch (error) {
      console.error("Error deleting competition:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      registration_open: { variant: "default", label: "Registration Open" },
      screening_active: { variant: "secondary", label: "Screening Active" },
      screening_closed: { variant: "outline", label: "Screening Closed" },
      live_active: { variant: "default", label: "Live Competition" },
      completed: { variant: "outline", label: "Completed" },
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Competitions</h1>
          <p className="text-muted-foreground mt-2">
            Manage engineering competitions and screenings
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Competition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Competition</DialogTitle>
              <DialogDescription>
                Set up a new engineering competition with screening test.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Competition Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="KOS Quest 2025"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Global engineering competition..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Screening Start</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={formData.screening_start_date}
                    onChange={(e) => setFormData({ ...formData, screening_start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Screening Deadline</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={formData.screening_deadline}
                    onChange={(e) => setFormData({ ...formData, screening_deadline: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="live_date">Live Competition Date</Label>
                <Input
                  id="live_date"
                  type="datetime-local"
                  value={formData.live_competition_date}
                  onChange={(e) => setFormData({ ...formData, live_competition_date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_participants">Max Participants</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualified_count">Qualified Count</Label>
                  <Input
                    id="qualified_count"
                    type="number"
                    value={formData.qualified_count}
                    onChange={(e) => setFormData({ ...formData, qualified_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Test Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.test_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, test_duration_minutes: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="questions">Questions Count</Label>
                  <Input
                    id="questions"
                    type="number"
                    value={formData.questions_count}
                    onChange={(e) => setFormData({ ...formData, questions_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !formData.name}>
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Competition"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competitions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competitions.reduce((sum, c) => sum + c.registration_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Screenings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competitions.reduce((sum, c) => sum + c.completed_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {competitions.filter((c) =>
                c.status === "registration_open" || c.status === "screening_active"
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competitions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Competitions</CardTitle>
        </CardHeader>
        <CardContent>
          {competitions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No competitions yet. Create your first competition to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registrations</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitions.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{comp.name}</p>
                        {comp.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {comp.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(comp.status)}</TableCell>
                    <TableCell>
                      {comp.registration_count.toLocaleString()} / {comp.max_participants.toLocaleString()}
                    </TableCell>
                    <TableCell>{comp.completed_count.toLocaleString()}</TableCell>
                    <TableCell>{formatDate(comp.screening_deadline)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/competitions/${comp.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(comp)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(comp.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Competition Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Competition</DialogTitle>
            <DialogDescription>
              Update competition settings and configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Competition Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="KOS Quest 2025"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Global engineering competition..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registration_open">Registration Open</SelectItem>
                  <SelectItem value="screening_active">Screening Active</SelectItem>
                  <SelectItem value="screening_closed">Screening Closed</SelectItem>
                  <SelectItem value="live_active">Live Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Screening Start</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  value={editFormData.screening_start_date}
                  onChange={(e) => setEditFormData({ ...editFormData, screening_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Screening Deadline</Label>
                <Input
                  id="edit-deadline"
                  type="datetime-local"
                  value={editFormData.screening_deadline}
                  onChange={(e) => setEditFormData({ ...editFormData, screening_deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-live_date">Live Competition Date</Label>
              <Input
                id="edit-live_date"
                type="datetime-local"
                value={editFormData.live_competition_date}
                onChange={(e) => setEditFormData({ ...editFormData, live_competition_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max_participants">Max Participants</Label>
                <Input
                  id="edit-max_participants"
                  type="number"
                  value={editFormData.max_participants}
                  onChange={(e) => setEditFormData({ ...editFormData, max_participants: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-qualified_count">Qualified Count</Label>
                <Input
                  id="edit-qualified_count"
                  type="number"
                  value={editFormData.qualified_count}
                  onChange={(e) => setEditFormData({ ...editFormData, qualified_count: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-duration">Test Duration (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={editFormData.test_duration_minutes}
                  onChange={(e) => setEditFormData({ ...editFormData, test_duration_minutes: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-questions">Questions Count</Label>
                <Input
                  id="edit-questions"
                  type="number"
                  value={editFormData.questions_count}
                  onChange={(e) => setEditFormData({ ...editFormData, questions_count: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editFormData.name}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
