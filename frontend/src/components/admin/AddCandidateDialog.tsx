"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import { Plus, Upload, Loader2, UserPlus, X } from "lucide-react";

const CATEGORIES = [
  { id: "backend", label: "Backend" },
  { id: "ml", label: "Machine Learning" },
  { id: "fullstack", label: "Full-Stack" },
  { id: "python", label: "Python" },
  { id: "react", label: "React" },
  { id: "signal_processing", label: "Signal Processing" },
];

// Specialization tracks for dual scoring system
const SPECIALIZATION_TRACKS = [
  { id: "", label: "(None) - No specialization track" },
  { id: "ai_researcher", label: "AI Researcher" },
  { id: "ai_ml_engineer", label: "AI/ML Engineer" },
  { id: "frontend", label: "Frontend Engineer" },
  { id: "ui_ux", label: "UI/UX Designer" },
  { id: "cybersecurity", label: "Cybersecurity Engineer" },
  { id: "hardware_ee", label: "PCB/EE Engineer" },
  { id: "firmware", label: "Firmware Engineer" },
  { id: "biomedical", label: "Biomedical Engineer" },
];

// Progress messages for candidate creation with resume
const CANDIDATE_PROGRESS_MESSAGES = [
  "Creating candidate...",
  "Uploading resume...",
  "Parsing document content...",
  "Connecting to Kimi2 AI...",
  "Analyzing resume structure...",
  "Extracting technical skills...",
  "Identifying experience level...",
  "Detecting programming languages...",
  "Analyzing project experience...",
  "Categorizing skill domains...",
  "Building candidate profile...",
  "Still analyzing (this can take 2-3 minutes)...",
  "AI is working hard on skill extraction...",
  "Almost there, finalizing profile...",
];

// Simple progress messages for quick operations (no resume)
const QUICK_PROGRESS_MESSAGES = [
  "Creating candidate...",
  "Saving to database...",
];

interface AddCandidateDialogProps {
  onCandidateAdded: () => void;
}

export function AddCandidateDialog({ onCandidateAdded }: AddCandidateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState([2]);
  const [difficulty, setDifficulty] = useState("mid");
  const [track, setTrack] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [resume, setResume] = useState<File | null>(null);

  // Progress tracking state
  const [progressMessage, setProgressMessage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCloseOption, setShowCloseOption] = useState(false); // Show close button after timeout
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const operationInProgressRef = useRef(false);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  // Format elapsed time as mm:ss
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start progress animation
  const startProgressAnimation = (hasResume: boolean) => {
    const messages = hasResume ? CANDIDATE_PROGRESS_MESSAGES : QUICK_PROGRESS_MESSAGES;
    let messageIndex = 0;
    let percent = 0;
    let tickCount = 0;

    setProgressMessage(messages[0]);
    setProgressPercent(0);
    setElapsedSeconds(0);

    // Track elapsed time
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Progress animation
    progressIntervalRef.current = setInterval(() => {
      tickCount++;

      // Progress increases slowly and caps at 85%
      if (percent < 40) {
        percent += Math.random() * 3 + 1;
      } else if (percent < 60) {
        percent += Math.random() * 2 + 0.5;
      } else if (percent < 75) {
        percent += Math.random() * 1 + 0.2;
      } else if (percent < 85) {
        percent += Math.random() * 0.5 + 0.1;
      }
      percent = Math.min(percent, 85);

      // Cycle through messages
      const cycleStart = Math.max(0, messages.length - 5);
      if (messageIndex < messages.length - 1) {
        if (tickCount % 3 === 0) messageIndex++;
      } else {
        if (tickCount % 4 === 0) {
          messageIndex = cycleStart + ((messageIndex - cycleStart + 1) % (messages.length - cycleStart));
        }
      }

      setProgressPercent(percent);
      setProgressMessage(messages[messageIndex]);
    }, 800);
  };

  // Stop progress animation
  const stopProgressAnimation = (success: boolean = true) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }

    if (success) {
      setProgressPercent(100);
      setProgressMessage("Complete!");
    }
  };

  // Reset form to initial state
  const resetForm = () => {
    setName("");
    setEmail("");
    setDuration([2]);
    setDifficulty("mid");
    setTrack("");
    setCategories([]);
    setResume(null);
    setError(null);
    setProgressPercent(0);
    setProgressMessage("");
    setElapsedSeconds(0);
    setShowCloseOption(false);
    operationInProgressRef.current = false;
  };

  // Handle closing after timeout (user wants to check later)
  const handleCloseAndCheckLater = () => {
    stopProgressAnimation(false);
    setOpen(false);
    resetForm();
    setLoading(false);
    // Refresh the candidate list in case the candidate was actually created
    onCandidateAdded();
  };

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setCategories([...categories, categoryId]);
    } else {
      setCategories(categories.filter((c) => c !== categoryId));
    }
  };

  const handleCancel = () => {
    if (!loading) {
      setOpen(false);
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double-clicks
    if (operationInProgressRef.current || loading) {
      console.log("Operation already in progress, ignoring click");
      return;
    }

    operationInProgressRef.current = true;
    setLoading(true);
    setError(null);

    // Start progress animation
    startProgressAnimation(!!resume);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("test_duration_hours", duration[0].toString());
      formData.append("difficulty", difficulty);
      formData.append("categories", categories.join(","));
      if (track) {
        formData.append("track", track);
      }
      if (resume) {
        formData.append("resume", resume);
      }

      await candidatesApi.create(formData);

      // Success - show 100% briefly then close
      stopProgressAnimation(true);

      setTimeout(() => {
        setOpen(false);
        resetForm();
        setLoading(false);
        onCandidateAdded();
      }, 800);
    } catch (err: unknown) {
      console.error("Error creating candidate:", err);

      // Type the error properly
      const axiosError = err as {
        code?: string;
        response?: { status?: number; data?: { detail?: string } };
        message?: string;
      };

      // Check if this is a timeout error (backend might still be processing)
      const isTimeout = axiosError.code === "ECONNABORTED" || axiosError.message?.includes("timeout");
      const isNetworkError = axiosError.code === "ERR_NETWORK" || !axiosError.response;

      if (isTimeout || isNetworkError) {
        // Don't show error for timeout - backend may still be processing
        // Keep showing progress with a different message
        setProgressMessage("Still processing... This is taking longer than expected.");
        setShowCloseOption(true); // Show option to close and check later
        // Don't stop the animation or show error
        // The operation might still succeed on the backend
        console.log("Request timed out or network error - backend may still be processing");

        return; // Don't reset the form or show error
      }

      // For actual HTTP errors, show specific messages
      stopProgressAnimation(false);
      let message = "Failed to create candidate. Please try again.";

      if (axiosError.response?.status === 409) {
        message = "Candidate creation already in progress for this email. Please wait.";
      } else if (axiosError.response?.status === 400) {
        message = axiosError.response?.data?.detail || "Email already registered or invalid data.";
      } else if (axiosError.response?.status && axiosError.response.status >= 500) {
        message = "Server error. Please try again in a few moments.";
      } else if (axiosError.response?.data?.detail) {
        message = axiosError.response.data.detail;
      }

      setError(message);
      setLoading(false);
      operationInProgressRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
      <DialogTrigger asChild>
        <Button disabled={loading}>
          <Plus className="w-4 h-4 mr-2" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => loading && e.preventDefault()}
        onEscapeKeyDown={(e) => loading && e.preventDefault()}
      >
        {/* Show progress UI when loading */}
        {loading ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500 animate-pulse" />
                Adding Candidate
              </DialogTitle>
              <DialogDescription className="pt-2">
                {showCloseOption
                  ? "The request is taking longer than expected. The backend may still be processing."
                  : resume
                    ? "Kimi2 AI is extracting skills from the resume. This typically takes 2-3 minutes for detailed resumes."
                    : "Creating candidate profile..."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{progressMessage}</span>
                  <span className="font-medium">{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Elapsed: {formatElapsedTime(elapsedSeconds)}</span>
                </div>
                <span className="text-muted-foreground">
                  {showCloseOption
                    ? "Backend is still working..."
                    : elapsedSeconds > 120
                      ? "Taking longer than usual, please wait..."
                      : "Please wait, do not close this window"}
                </span>
              </div>

              {/* Show close option after timeout */}
              {showCloseOption && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    You can close this dialog and check the candidate list later.
                    The candidate may have already been created.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleCloseAndCheckLater}
                    className="w-full"
                  >
                    Close & Check Candidate List
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Show form when not loading */
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add New Candidate</DialogTitle>
              <DialogDescription>
                Add a candidate and configure their assessment settings.
                {resume && (
                  <span className="block mt-1 text-amber-500">
                    Note: Skill extraction from resume takes 2-3 minutes.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-start gap-2">
                <X className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={loading}
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
                  disabled={loading}
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
                    disabled={loading}
                  />
                  {resume && (
                    <span className="text-sm text-muted-foreground truncate max-w-[150px]">
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
                  disabled={loading}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 hour</span>
                  <span>8 hours</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Difficulty Level</Label>
                <Select value={difficulty} onValueChange={setDifficulty} disabled={loading}>
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
                <Label>Specialization Track</Label>
                <Select
                  value={track || "none"}
                  onValueChange={(v) => setTrack(v === "none" ? "" : v)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specialization track" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATION_TRACKS.map((t) => (
                      <SelectItem key={t.id || "none"} value={t.id || "none"}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional: Select a specialization for 5 additional expert-level questions
                </p>
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
                        disabled={loading}
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
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Upload className="w-4 h-4 mr-2" />
                Add Candidate
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
