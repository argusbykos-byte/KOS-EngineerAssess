"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cloudApplicationsApi } from "@/lib/cloudApi";
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
  CheckCircle2,
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
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<number | null>(null);

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
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setResumeFile(file);
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Convert resume to base64 if present
      let resumeData: string | undefined;
      let resumeFilename: string | undefined;
      
      if (resumeFile) {
        resumeData = await fileToBase64(resumeFile);
        resumeFilename = resumeFile.name;
      }

      // Submit to cloud API
      const response = await cloudApplicationsApi.submit({
        full_name: fullName,
        email: email,
        phone: phone || undefined,
        location: location || undefined,
        graduation_date: graduationDate || undefined,
        preferred_start_date: preferredStartDate || undefined,
        available_for_trial: availability,
        preferred_trial_date: preferredTrialDate || undefined,
        primary_role: selfDescription || undefined,
        motivation: motivation || undefined,
        engineers_admired: admiredEngineers || undefined,
        self_rating: overallSelfRating,
        unique_qualities: uniqueTrait || undefined,
        resume_filename: resumeFilename,
        resume_data: resumeData,
      });

      // Success!
      setApplicationId(response.application_id);
      setSubmitted(true);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen after submission
  if (submitted) {
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

        {/* Success Content */}
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Application Submitted!</h2>
            <p className="text-muted-foreground text-lg mb-2">
              Thank you for your interest in joining KOS, {fullName}!
            </p>
            <p className="text-muted-foreground">
              Your application #{applicationId} has been received.
            </p>
          </div>

          <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl">What happens next?</CardTitle>
            </CardHeader>
            <CardContent className="text-left space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">Application Review</p>
                  <p className="text-sm text-muted-foreground">
                    Our team will review your application within 2-3 business days.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">Technical Assessment</p>
                  <p className="text-sm text-muted-foreground">
                    If selected, you&apos;ll receive a link to complete a personalized technical assessment.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium">Interview</p>
                  <p className="text-sm text-muted-foreground">
                    Top candidates will be invited for an interview with our engineering team.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-8 text-sm text-muted-foreground">
            We&apos;ll contact you at <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
      </div>
    );
  }

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
            Apply to join our team of innovators. Complete this form and showcase your
            skills in our comprehensive assessment.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
              1
            </div>
            <span className="font-medium">Application</span>
          </div>
          <div className="w-16 h-0.5 bg-muted" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-medium">
              2
            </div>
            <span className="text-muted-foreground">Skills</span>
          </div>
          <div className="w-16 h-0.5 bg-muted" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-medium">
              3
            </div>
            <span className="text-muted-foreground">Complete</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Personal Information */}
          <Card className="mb-6 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Tell us about yourself</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
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
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="City, Country"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Education & Availability */}
          <Card className="mb-6 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Education & Availability
              </CardTitle>
              <CardDescription>
                Your academic background and availability
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="graduationDate">Expected Graduation Date</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="graduationDate"
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
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="preferredStartDate"
                    placeholder="e.g., June 2025 or Immediately"
                    value={preferredStartDate}
                    onChange={(e) => setPreferredStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Available for Trial Day?</Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredTrialDate">Preferred Trial Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="preferredTrialDate"
                    placeholder="e.g., Any weekday or specific date"
                    value={preferredTrialDate}
                    onChange={(e) => setPreferredTrialDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Profile */}
          <Card className="mb-6 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Professional Profile
              </CardTitle>
              <CardDescription>
                Help us understand your background and aspirations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>How would you describe yourself?</Label>
                <Select
                  value={selfDescription}
                  onValueChange={setSelfDescription}
                >
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
                  className="min-h-[80px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {motivation.length}/500
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admiredEngineers" className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-destructive" />
                  Engineers you admire and why
                </Label>
                <Textarea
                  id="admiredEngineers"
                  placeholder="Tell us about engineers or inventors who inspire you..."
                  value={admiredEngineers}
                  onChange={(e) => setAdmiredEngineers(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  Overall Self-Rating (1-100)
                </Label>
                <div className="px-2">
                  <Slider
                    value={[overallSelfRating]}
                    onValueChange={(value) => setOverallSelfRating(value[0])}
                    max={100}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>Beginner</span>
                    <span className="font-bold text-foreground text-lg">
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
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  What makes you unique?
                </Label>
                <Textarea
                  id="uniqueTrait"
                  placeholder="What special quality or experience sets you apart from other candidates?"
                  value={uniqueTrait}
                  onChange={(e) => setUniqueTrait(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Resume Upload */}
          <Card className="mb-6 bg-card/50 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Resume
              </CardTitle>
              <CardDescription>
                Upload your resume (PDF or Word, max 10MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  resumeFile
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                />
                {resumeFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-primary" />
                    <p className="font-medium">{resumeFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">
                      PDF or Word document (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="text-center">
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !fullName || !email}
              className="w-full md:w-auto px-12"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Submit Application
                </>
              )}
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              By submitting this application, you agree to our privacy policy and
              terms of service. Your information will be kept confidential.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
