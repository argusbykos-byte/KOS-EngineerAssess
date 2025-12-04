"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { candidatesApi } from "@/lib/api";
import { Plus, Upload, Loader2 } from "lucide-react";

const CATEGORIES = [
  { id: "backend", label: "Backend" },
  { id: "ml", label: "Machine Learning" },
  { id: "fullstack", label: "Full-Stack" },
  { id: "python", label: "Python" },
  { id: "react", label: "React" },
  { id: "signal_processing", label: "Signal Processing" },
];

interface AddCandidateDialogProps {
  onCandidateAdded: () => void;
}

export function AddCandidateDialog({ onCandidateAdded }: AddCandidateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState([2]);
  const [difficulty, setDifficulty] = useState("mid");
  const [categories, setCategories] = useState<string[]>([]);
  const [resume, setResume] = useState<File | null>(null);

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setCategories([...categories, categoryId]);
    } else {
      setCategories(categories.filter((c) => c !== categoryId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("test_duration_hours", duration[0].toString());
      formData.append("difficulty", difficulty);
      formData.append("categories", categories.join(","));
      if (resume) {
        formData.append("resume", resume);
      }

      await candidatesApi.create(formData);

      // Reset form
      setName("");
      setEmail("");
      setDuration([2]);
      setDifficulty("mid");
      setCategories([]);
      setResume(null);
      setOpen(false);
      onCandidateAdded();
    } catch (error) {
      console.error("Error creating candidate:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
            <DialogDescription>
              Add a candidate and configure their assessment settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resume">Resume (PDF/DOCX)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => setResume(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                {resume && (
                  <span className="text-sm text-muted-foreground">
                    {resume.name}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Test Duration: {duration[0]} hour(s)</Label>
              <Slider
                value={duration}
                onValueChange={setDuration}
                min={1}
                max={8}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 hour</span>
                <span>8 hours</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Difficulty Level</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                  <SelectItem value="mid">Mid-Level (2-5 years)</SelectItem>
                  <SelectItem value="senior">Senior (5+ years)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Test Categories</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={category.id}
                      checked={categories.includes(category.id)}
                      onCheckedChange={(checked) =>
                        handleCategoryChange(category.id, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={category.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {category.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Add Candidate
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
