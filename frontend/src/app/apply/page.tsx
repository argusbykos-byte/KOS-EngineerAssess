"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { applicationsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Upload,
  FileText,
  Sparkles,
  MapPin,
  GraduationCap,
  Calendar,
  User,
  Mail,
  Phone,
  Briefcase,
  Star,
  Heart,
  Lightbulb,
} from "lucide-react";

// Self-description options
const SELF_DESCRIPTIONS = [
  "AI Researcher",
  "Machine Learning Researcher",
  "Machine Learning Engineer",
  "Software Engineer",
  "Biomedical / Biomechanical Engineer",
  "Embedded Systems Engineer",
  "Algorithm Design Engineer",
  "Mathematical Engineer",
  "Full-Stack Developer",
  "Data Scientist",
];

// Availability options
const AVAILABILITY_OPTIONS = [
  { value: "yes", label: "Yes, I am available" },
  { value: "no", label: "No, not at this time" },
  { value: "need_to_discuss", label: "Need to discuss" },
];

export default function ApplyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [preferredStartDate, setPreferredStartDate] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [motivation, setMotivation] = useState("");
  const [admiredEngineers, setAdmiredEngineers] = useState("");
  const [overallSelfRating, setOverallSelfRating] = useState(50);
  const [uniqueTrait, setUniqueTrait] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [availability, setAvailability] = useState("need_to_discuss");
  const [preferredTrialDate, setPreferredTrialDate] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a PDF or Word document");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setResumeFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("full_name", fullName);
      formData.append("email", email);
      if (phone) formData.append("phone", phone);
      if (location) formData.append("location", location);
      if (graduationDate) formData.append("graduation_date", graduationDate);
      if (preferredStartDate) formData.append("preferred_start_date", preferredStartDate);
      formData.append("availability", availability);
      if (preferredTrialDate) formData.append("preferred_trial_date", preferredTrialDate);
      if (selfDescription) formData.append("self_description", selfDescription);
      if (motivation) formData.append("motivation", motivation);
      if (admiredEngineers) formData.append("admired_engineers", admiredEngineers);
      formData.append("overall_self_rating", overallSelfRating.toString());
      if (uniqueTrait) formData.append("unique_trait", uniqueTrait);
      if (resumeFile) formData.append("resume", resumeFile);

      const response = await applicationsApi.submit(formData);
      const token = response.data.application_token;

      // Redirect to skills page
      router.push(`/apply/${token}/skills`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(
        error.response?.data?.detail ||
          "Failed to submit application. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Image
            src="/kos-quest-logo.png"
            alt="KOS Quest"
            width={48}
            height={48}
            className="rounded-lg shadow-md"
          />
          <div>
            <h1 className="text-xl font-bold">KOS Quest</h1>
            <p className="text-sm text-muted-foreground">
              Engineering Application Portal
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Join the Quest
          </div>
          <h2 className="text-3xl font-bold mb-3">
            Begin Your Engineering Journey
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Apply to join our team of innovators. Complete this form and
            showcase your skills in our comprehensive assessment.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              1
            </div>
            <span className="text-sm font-medium">Application</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className="text-sm text-muted-foreground">Skills</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm text-muted-foreground">Complete</span>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Tell us about yourself</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Current Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="location"
                      type="text"
                      placeholder="City, Country"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Education & Availability */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Education & Availability
              </CardTitle>
              <CardDescription>
                Your academic background and availability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="graduationDate">Expected Graduation Date</Label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="graduationDate"
                      type="text"
                      placeholder="e.g., May 2025 or Already graduated"
                      value={graduationDate}
                      onChange={(e) => setGraduationDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredStartDate">Preferred Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="preferredStartDate"
                      type="text"
                      placeholder="e.g., June 2025 or Immediately"
                      value={preferredStartDate}
                      onChange={(e) => setPreferredStartDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availability">Available for Trial Day?</Label>
                  <Select value={availability} onValueChange={setAvailability}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredTrialDate">Preferred Trial Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="preferredTrialDate"
                      type="text"
                      placeholder="e.g., Any weekday or specific date"
                      value={preferredTrialDate}
                      onChange={(e) => setPreferredTrialDate(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Profile */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Professional Profile
              </CardTitle>
              <CardDescription>
                Help us understand your background and aspirations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="selfDescription">
                  How would you describe yourself?
                </Label>
                <Select value={selfDescription} onValueChange={setSelfDescription}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your primary role" />
                  </SelectTrigger>
                  <SelectContent>
                    {SELF_DESCRIPTIONS.map((desc) => (
                      <SelectItem key={desc} value={desc}>
                        {desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivation">
                  Why do you want to join KOS? (One sentence)
                </Label>
                <Textarea
                  id="motivation"
                  placeholder="Share your motivation in one compelling sentence..."
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {motivation.length}/500
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admiredEngineers" className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  Engineers you admire and why
                </Label>
                <Textarea
                  id="admiredEngineers"
                  placeholder="Tell us about engineers or inventors who inspire you..."
                  value={admiredEngineers}
                  onChange={(e) => setAdmiredEngineers(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Overall Self-Rating (1-100)
                </Label>
                <div className="space-y-2">
                  <Slider
                    value={[overallSelfRating]}
                    onValueChange={(value) => setOverallSelfRating(value[0])}
                    min={1}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Beginner</span>
                    <span className="font-medium text-foreground text-lg">
                      {overallSelfRating}
                    </span>
                    <span>Expert</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  How would you rate your overall engineering capability?
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uniqueTrait" className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  What makes you unique?
                </Label>
                <Textarea
                  id="uniqueTrait"
                  placeholder="What special quality or experience sets you apart from other candidates?"
                  value={uniqueTrait}
                  onChange={(e) => setUniqueTrait(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resume Upload */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Resume
              </CardTitle>
              <CardDescription>
                Upload your resume (PDF or Word, max 10MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-primary hover:bg-muted/50 ${
                  resumeFile ? "border-green-500 bg-green-500/10" : "border-border"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {resumeFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-green-500" />
                    <p className="font-medium text-green-600">{resumeFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <p className="font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF or Word document (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !fullName || !email}
              className="min-w-[200px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Continue to Skills Assessment
                  <Sparkles className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          {/* Privacy Note */}
          <p className="text-center text-xs text-muted-foreground mt-4">
            By submitting this application, you agree to our privacy policy and
            terms of service. Your information will be kept confidential.
          </p>
        </form>
      </div>
    </div>
  );
}
