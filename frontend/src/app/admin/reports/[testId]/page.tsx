"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { reportsApi, questionsApi, testsApi, specializationApi, applicationsApi } from "@/lib/api";
import { Report, Question, Test } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCategoryLabel,
  getDifficultyLabel,
  getScoreColor,
  getRecommendationBadge,
  getQuestDeity,
  getQuestDifficultyLabel,
  formatPacificDateTime,
} from "@/lib/utils";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Eye,
  Clipboard,
  Clock,
  AlertTriangle,
  Download,
  Coffee,
  Award,
  Briefcase,
  Target,
  FileText,
  Sparkles,
  Zap,
  ExternalLink,
} from "lucide-react";
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
import {
  SkillRadarChart,
  generateSkillDataFromReport,
} from "@/components/charts/SkillRadarChart";
import { certificatesApi } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RoleFit {
  role_id: string;
  role_title: string;
  fit_score: number;
  explanation: string;
  skill_dimensions?: string[];
  is_current_role?: boolean;
}

interface RoleFitData {
  role_fits: RoleFit[];
  top_recommendation: {
    role_id: string;
    role_title: string;
    fit_score: number;
    explanation: string;
  } | null;
  ai_recommendation: {
    primary_recommendation: string;
    recommendation_summary: string;
    development_areas: string[];
    career_path_suggestions: string[];
  } | null;
}

export default function ReportDetailPage() {
  const params = useParams();
  const testId = Number(params.testId);
  const [report, setReport] = useState<Report | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [roleFitData, setRoleFitData] = useState<RoleFitData | null>(null);
  const [roleFitLoading, setRoleFitLoading] = useState(false);
  const [hasNdaSigned, setHasNdaSigned] = useState(false);
  const [ndaDownloading, setNdaDownloading] = useState(false);
  const [testData, setTestData] = useState<Test | null>(null);

  // Specialization test state
  const [showSpecializationDialog, setShowSpecializationDialog] = useState(false);
  const [focusAreas, setFocusAreas] = useState<Array<{id: string; name: string; description: string; sub_specialties: string[]}>>([]);
  const [selectedFocusArea, setSelectedFocusArea] = useState<string>("");
  const [generatingSpecTest, setGeneratingSpecTest] = useState(false);
  const [specTestResult, setSpecTestResult] = useState<{testId: number; accessToken: string} | null>(null);

  // Application data for Kimi2 analysis check
  const [hasKimiAnalysis, setHasKimiAnalysis] = useState<boolean | null>(null);
  const [applicationFitScore, setApplicationFitScore] = useState<number | null>(null);

  // Specialization test results (1-hour deep dive) for 2000-point system
  const [specTestResults, setSpecTestResults] = useState<{
    specialty_score: number | null;
    primary_specialty: string | null;
    confidence: number | null;
    focus_area: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, questionsRes] = await Promise.all([
          reportsApi.getByTest(testId),
          questionsApi.getByTest(testId),
        ]);
        setReport(reportRes.data);
        setQuestions(questionsRes.data);

        // Check if certificate exists
        try {
          const certRes = await certificatesApi.getByReport(reportRes.data.id);
          setHasCertificate(certRes.data.has_pdf);
        } catch {
          setHasCertificate(false);
        }

        let candidateId: number | null = null;
        // Fetch test data for NDA check and start/end times
        try {
          const testRes = await testsApi.get(testId);
          setTestData(testRes.data);
          candidateId = testRes.data.candidate_id;
          setHasNdaSigned(!!testRes.data.nda_signature);
        } catch {
          setHasNdaSigned(false);
        }

        // Fetch role fit recommendations
        setRoleFitLoading(true);
        try {
          const roleFitRes = await reportsApi.getRoleFit(reportRes.data.id);
          setRoleFitData(roleFitRes.data);
        } catch {
          console.log("Role fit recommendations not available");
        } finally {
          setRoleFitLoading(false);
        }

        // Fetch application data to check for Kimi2 analysis
        if (reportRes.data.candidate_email) {
          try {
            const appRes = await applicationsApi.getByEmail(reportRes.data.candidate_email);
            setHasKimiAnalysis(appRes.data.has_kimi_analysis);
            setApplicationFitScore(appRes.data.fit_score);
          } catch {
            // No application found for this candidate - that's OK, button will still work
            setHasKimiAnalysis(null);
          }
        }

        // Fetch specialization test results (1-hour deep dive) by candidate_id
        if (candidateId) {
          try {
            const specRes = await specializationApi.getCandidateSpecializations(candidateId);
            if (specRes.data && specRes.data.length > 0) {
              // Get the most recent specialization result
              const latestSpec = specRes.data[0];
              if (latestSpec.specialty_score !== null) {
                setSpecTestResults({
                  specialty_score: latestSpec.specialty_score,
                  primary_specialty: latestSpec.primary_specialty,
                  confidence: latestSpec.confidence,
                  focus_area: latestSpec.focus_area,
                });
              }
            }
          } catch {
            // No specialization test results - that's OK
            console.log("No specialization test results available");
          }
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };

    if (testId) {
      fetchData();
    }
  }, [testId]);

  const handleGenerateCertificate = async () => {
    if (!report) return;
    setCertificateLoading(true);
    try {
      await certificatesApi.generate(report.id);
      setHasCertificate(true);
    } catch (error) {
      console.error("Error generating certificate:", error);
      alert("Failed to generate certificate");
    } finally {
      setCertificateLoading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!report) return;
    setCertificateLoading(true);
    try {
      const response = await certificatesApi.download(report.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `KOS_Certificate_${report.candidate_name?.replace(/\s+/g, "_")}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading certificate:", error);
      alert("Failed to download certificate");
    } finally {
      setCertificateLoading(false);
    }
  };

  const handleDownloadNda = async () => {
    if (!report) return;
    setNdaDownloading(true);
    try {
      const response = await testsApi.downloadNdaPdf(testId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
      link.setAttribute("download", `KOS_NDA_${report.candidate_name?.replace(/\s+/g, "_")}_${date}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading NDA:", error);
      alert("Failed to download signed NDA");
    } finally {
      setNdaDownloading(false);
    }
  };

  // Fetch focus areas when dialog opens
  const handleOpenSpecializationDialog = async () => {
    setShowSpecializationDialog(true);
    setSpecTestResult(null);
    setSelectedFocusArea("");
    try {
      const res = await specializationApi.getFocusAreas();
      setFocusAreas(res.data);
    } catch (error) {
      console.error("Error fetching focus areas:", error);
    }
  };

  // Generate specialization test
  const handleGenerateSpecializationTest = async () => {
    if (!report || !testData || !selectedFocusArea) return;
    setGeneratingSpecTest(true);
    try {
      const res = await specializationApi.generate({
        candidate_id: testData.candidate_id,
        focus_area: selectedFocusArea,
        duration_minutes: 60,
        parent_test_id: testId,  // Pass the test ID to fetch comprehensive context
      });
      if (res.data.success && res.data.test_id && res.data.access_token) {
        setSpecTestResult({
          testId: res.data.test_id,
          accessToken: res.data.access_token,
        });
      } else {
        alert(res.data.message || "Failed to generate specialization test");
      }
    } catch (error) {
      console.error("Error generating specialization test:", error);
      alert("Failed to generate specialization test");
    } finally {
      setGeneratingSpecTest(false);
    }
  };

  // Get the full specialization test link - always use port 3000 for Next.js app
  const getSpecTestLink = () => {
    if (!specTestResult) return '';
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Always use port 3000 since that's where Next.js dev server runs
    return `${protocol}//${hostname}:3000/specialization/${specTestResult.accessToken}`;
  };

  // Copy specialization test link with robust fallbacks
  const copySpecTestLink = async () => {
    const link = getSpecTestLink();
    if (!link) return;

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(link);
        alert("Link copied to clipboard!");
        return;
      }
    } catch (err) {
      console.warn("Clipboard API failed:", err);
    }

    // Fallback: Create temporary input element
    try {
      const input = document.createElement("input");
      input.value = link;
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.left = "0";
      input.style.top = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      input.setSelectionRange(0, 99999);
      const success = document.execCommand("copy");
      document.body.removeChild(input);
      if (success) {
        alert("Link copied to clipboard!");
        return;
      }
    } catch (err) {
      console.warn("execCommand copy failed:", err);
    }

    // Ultimate fallback: Show prompt
    window.prompt("Copy this link manually:", link);
  };

  const formatBreakTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Specialization track names
  const TRACK_NAMES: Record<string, string> = {
    ai_researcher: "AI Researcher",
    ai_ml_engineer: "AI/ML Engineer",
    frontend: "Frontend Engineer",
    ui_ux: "UI/UX Designer",
    cybersecurity: "Cybersecurity Engineer",
    hardware_ee: "PCB/EE Engineer",
    firmware: "Firmware Engineer",
    biomedical: "Biomedical Engineer",
  };

  const getTrackName = (trackId: string | null | undefined) => {
    if (!trackId) return "";
    return TRACK_NAMES[trackId] || trackId;
  };

  const getStarRating = (percentage: number) => {
    if (percentage >= 90) return { stars: 5, label: "Exceptional" };
    if (percentage >= 70) return { stars: 4, label: "Strong" };
    if (percentage >= 50) return { stars: 3, label: "Proficient" };
    if (percentage >= 30) return { stars: 2, label: "Developing" };
    return { stars: 1, label: "Needs Growth" };
  };

  const renderStars = (count: number) => {
    return "".padStart(count, "\u2B50");
  };

  const getSpecialistRecommendationBadge = (rec: string | null | undefined) => {
    switch (rec) {
      case "strong_hire":
        return { label: "STRONG HIRE", className: "bg-green-500/20 text-green-500 border-green-500/30" };
      case "hire":
        return { label: "HIRE", className: "bg-blue-500/20 text-blue-500 border-blue-500/30" };
      case "specialist_hire":
        return { label: "SPECIALIST HIRE", className: "bg-purple-500/20 text-purple-500 border-purple-500/30" };
      case "consider":
        return { label: "CONSIDER", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" };
      case "no_hire":
        return { label: "NO HIRE", className: "bg-red-500/20 text-red-500 border-red-500/30" };
      default:
        return { label: "N/A", className: "bg-gray-500/20 text-gray-500 border-gray-500/30" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Report not found</p>
        <Link href="/admin/reports">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
        </Link>
      </div>
    );
  }

  const badge = getRecommendationBadge(report.recommendation);

  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // Helper to add new page if needed
    const checkPageBreak = (height: number) => {
      if (yPosition + height > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
    };

    // Load logo image
    let logoLoaded = false;
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => {
          logoLoaded = true;
          resolve();
        };
        logoImg.onerror = () => reject(new Error("Failed to load logo"));
        logoImg.src = "/kos-quest-logo.png";
      });

      // Add logo to PDF header if loaded
      if (logoLoaded) {
        // Header with KOS Quest branding - taller to accommodate logo
        doc.setFillColor(30, 27, 75);
        doc.rect(0, 0, pageWidth, 55, "F");

        // Gold accent line
        doc.setFillColor(201, 162, 39);
        doc.rect(0, 53, pageWidth, 2, "F");

        // Add logo image (scaled down)
        doc.addImage(logoImg, "PNG", pageWidth - margin - 50, 5, 45, 30);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text("KOS Quest", margin, 25);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(201, 162, 39);
        doc.text("Forge Your Legend", margin, 35);

        doc.setFontSize(11);
        doc.setTextColor(200, 200, 200);
        doc.text("A Mythological Engineering Assessment", margin, 45);

        yPosition = 70;
      }
    } catch {
      // Fallback to text-only header if logo fails to load
      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, pageWidth, 50, "F");

      doc.setFillColor(201, 162, 39);
      doc.rect(0, 48, pageWidth, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("KOS Quest", margin, 25);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(201, 162, 39);
      doc.text("Forge Your Legend", margin, 33);

      doc.setFontSize(11);
      doc.setTextColor(200, 200, 200);
      doc.text("A Mythological Engineering Assessment", margin, 42);

      yPosition = 65;
    }

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Candidate Information - "Challenger Profile"
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 27, 75);
    doc.text("Challenger Profile", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${report.candidate_name}`, margin, yPosition);
    yPosition += 7;
    doc.text(`Email: ${report.candidate_email}`, margin, yPosition);
    yPosition += 7;

    // Helper to parse database UTC timestamps correctly
    // Database stores UTC times without timezone indicator (e.g., "2026-01-13 18:19:34")
    // We must convert to ISO format with Z suffix for proper UTC parsing
    const parseAsUTC = (dateStr: string | null | undefined): Date | null => {
      if (!dateStr) return null;
      const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      return new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z');
    };

    // Quest Date with Palo Alto timezone - use TEST start time, not report generation time
    const testStartDateStr = testData?.start_time || report.generated_at;
    const testStartDateParsed = parseAsUTC(testStartDateStr) || new Date();
    const questDate = testStartDateParsed.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Quest Date: ${questDate} | Palo Alto, CA`, margin, yPosition);
    yPosition += 7;

    // Start and end times in Pacific timezone
    const startDate = parseAsUTC(testData?.start_time);
    const endDate = parseAsUTC(testData?.end_time);

    const startTime = startDate ? startDate.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'N/A';
    const endTime = endDate ? endDate.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : 'N/A';

    // Determine timezone abbreviation (PST or PDT based on date)
    const tzAbbr = testStartDateParsed.toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short'
    }).split(' ').pop() || 'PT';

    doc.text(`Started: ${startTime} ${tzAbbr} | Completed: ${endTime} ${tzAbbr}`, margin, yPosition);
    yPosition += 7;

    const questDifficulty = getQuestDifficultyLabel(report.difficulty || "");
    doc.text(`Challenge Level: ${questDifficulty} (${getDifficultyLabel(report.difficulty || "")})`, margin, yPosition);
    yPosition += 15;

    // Overall Score and Recommendation
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 35, "F");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Overall Assessment", margin + 5, yPosition + 5);

    doc.setFontSize(28);
    const score = report.overall_score ?? 0;
    const scoreColor = score >= 70 ? [34, 197, 94] : score >= 50 ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${report.overall_score?.toFixed(1)}%`, margin + 5, yPosition + 22);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    const recLabel = badge.label.toUpperCase();
    const recColor = report.recommendation === "strong_hire" ? [34, 197, 94] :
                     report.recommendation === "hire" ? [59, 130, 246] :
                     report.recommendation === "maybe" ? [234, 179, 8] : [239, 68, 68];
    doc.setTextColor(recColor[0], recColor[1], recColor[2]);
    doc.text(recLabel, pageWidth - margin - 60, yPosition + 15);

    doc.setTextColor(0, 0, 0);
    yPosition += 45;

    // Section Scores - "Trial Results"
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 27, 75);
    doc.text("Trial Results", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    const sectionData = [
      { name: "Sibyl's Riddles", category: "brain_teaser", score: report.brain_teaser_score },
      { name: "Hephaestus' Forge", category: "coding", score: report.coding_score },
      { name: "Prometheus' Gift", category: "code_review", score: report.code_review_score },
      { name: "Athena's Architecture", category: "system_design", score: report.system_design_score },
      { name: "Asclepius' Arts", category: "signal_processing", score: report.signal_processing_score },
    ].filter(s => s.score !== null && s.score !== undefined);

    sectionData.forEach((section) => {
      const barWidth = pageWidth - 2 * margin - 100;
      const scorePercent = (section.score || 0) / 100;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(section.name, margin, yPosition);
      doc.text(`${section.score?.toFixed(1)}%`, pageWidth - margin - 30, yPosition);

      // Background bar
      doc.setFillColor(229, 231, 235);
      doc.rect(margin + 70, yPosition - 4, barWidth - 40, 6, "F");

      // Score bar
      const barColor = (section.score || 0) >= 70 ? [34, 197, 94] : (section.score || 0) >= 50 ? [234, 179, 8] : [239, 68, 68];
      doc.setFillColor(barColor[0], barColor[1], barColor[2]);
      doc.rect(margin + 70, yPosition - 4, (barWidth - 40) * scorePercent, 6, "F");

      yPosition += 12;
    });

    yPosition += 10;

    // Dual Scoring Section - Always show
    {
      checkPageBreak(70);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 27, 75);
      doc.text("Dual Scoring Assessment", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 12;

      // General Assessment Box
      doc.setFillColor(240, 245, 255);
      doc.rect(margin, yPosition - 5, (pageWidth - 2 * margin) / 2 - 5, 50, "F");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 130, 246);
      doc.text("General Assessment", margin + 5, yPosition + 5);

      doc.setFontSize(20);
      doc.text(`${(report.general_score ?? 0).toFixed(0)} / 500`, margin + 5, yPosition + 22);

      const generalPct = ((report.general_score || 0) / 500) * 100;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`(${generalPct.toFixed(0)}%)`, margin + 65, yPosition + 22);

      // Specialization Assessment Box (if applicable)
      if (report.specialization_track) {
        const specBoxX = margin + (pageWidth - 2 * margin) / 2 + 5;
        doc.setFillColor(250, 245, 255);
        doc.rect(specBoxX, yPosition - 5, (pageWidth - 2 * margin) / 2 - 5, 50, "F");

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(147, 51, 234);
        doc.text(`Concentration: ${TRACK_NAMES[report.specialization_track] || report.specialization_track}`, specBoxX + 5, yPosition + 5);

        doc.setFontSize(20);
        doc.text(`${report.specialization_score?.toFixed(0) || 0} / 500`, specBoxX + 5, yPosition + 22);

        const specPct = ((report.specialization_score || 0) / 500) * 100;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`(${specPct.toFixed(0)}%)`, specBoxX + 65, yPosition + 22);

        // Star rating
        const starRating = getStarRating(specPct);
        doc.text(`${"★".repeat(starRating.stars)}${"☆".repeat(5 - starRating.stars)} ${starRating.label}`, specBoxX + 5, yPosition + 35);

        // Specialist recommendation
        if (report.specialist_recommendation) {
          const specRecBadge = getSpecialistRecommendationBadge(report.specialist_recommendation);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(147, 51, 234);
          doc.text(`Recommendation: ${specRecBadge.label}`, specBoxX + 5, yPosition + 45);
        }
      }

      doc.setTextColor(0, 0, 0);
      yPosition += 60;
    }

    // AI Summary
    if (report.ai_summary) {
      checkPageBreak(40);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("AI Summary", margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const summaryLines = doc.splitTextToSize(report.ai_summary, pageWidth - 2 * margin);
      doc.text(summaryLines, margin, yPosition);
      yPosition += summaryLines.length * 5 + 10;
    }

    // Strengths
    if (report.strengths && report.strengths.length > 0) {
      checkPageBreak(30 + report.strengths.length * 8);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text("Strengths", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      report.strengths.forEach((strength) => {
        const lines = doc.splitTextToSize(`• ${strength}`, pageWidth - 2 * margin - 10);
        checkPageBreak(lines.length * 5 + 5);
        doc.text(lines, margin + 5, yPosition);
        yPosition += lines.length * 5 + 3;
      });
      yPosition += 7;
    }

    // Weaknesses
    if (report.weaknesses && report.weaknesses.length > 0) {
      checkPageBreak(30 + report.weaknesses.length * 8);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(234, 179, 8);
      doc.text("Areas for Improvement", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      report.weaknesses.forEach((weakness) => {
        const lines = doc.splitTextToSize(`• ${weakness}`, pageWidth - 2 * margin - 10);
        checkPageBreak(lines.length * 5 + 5);
        doc.text(lines, margin + 5, yPosition);
        yPosition += lines.length * 5 + 3;
      });
      yPosition += 7;
    }

    // Integrity Metrics
    checkPageBreak(50);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Integrity Metrics", margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const tabSwitches = report.tab_switch_count || 0;
    const pasteAttempts = report.paste_attempt_count || 0;

    if (tabSwitches > 0 || pasteAttempts > 0) {
      doc.setTextColor(239, 68, 68);
    } else {
      doc.setTextColor(34, 197, 94);
    }
    doc.text(`Tab Switches: ${tabSwitches}`, margin, yPosition);
    yPosition += 6;
    doc.text(`Paste Attempts: ${pasteAttempts}`, margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 15;

    // Detailed Feedback
    if (report.detailed_feedback) {
      checkPageBreak(40);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Feedback", margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const feedbackLines = doc.splitTextToSize(report.detailed_feedback, pageWidth - 2 * margin);
      feedbackLines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, margin, yPosition);
        yPosition += 5;
      });
      yPosition += 10;
    }

    // Question Details Table - "Trial Chronicle"
    if (questions.length > 0) {
      doc.addPage();
      yPosition = 20;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 27, 75);
      doc.text("Trial Chronicle", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      const tableData = questions.map((q, i) => [
        (i + 1).toString(),
        getQuestDeity(q.category),
        q.question_text.substring(0, 60) + (q.question_text.length > 60 ? "..." : ""),
        q.answer?.score !== null && q.answer?.score !== undefined ? `${q.answer.score.toFixed(0)}%` : "N/A",
        q.answer?.time_spent_seconds ? `${Math.floor(q.answer.time_spent_seconds / 60)}m ${q.answer.time_spent_seconds % 60}s` : "N/A",
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [["#", "Trial", "Challenge", "Score", "Time"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [30, 27, 75] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 90 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
        },
        styles: { fontSize: 8 },
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `KOS Quest - Forge Your Legend | Page ${i} of ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Save the PDF
    const candidateName = report.candidate_name ?? "Candidate";
    const fileName = `${candidateName.replace(/\s+/g, "_")}_KOS_Quest_Report.pdf`;
    doc.save(fileName);
  };

  const sectionScores = [
    { name: "Sibyl's Riddles", deity: "Sibyl", score: report.brain_teaser_score, key: "brain_teaser" },
    { name: "Hephaestus' Forge", deity: "Hephaestus", score: report.coding_score, key: "coding" },
    { name: "Prometheus' Gift", deity: "Prometheus", score: report.code_review_score, key: "code_review" },
    { name: "Athena's Architecture", deity: "Athena", score: report.system_design_score, key: "system_design" },
    { name: "Asclepius' Arts", deity: "Asclepius", score: report.signal_processing_score, key: "signal_processing" },
  ].filter((s) => s.score !== null);

  // Define preferred category order for consistent display
  const CATEGORY_ORDER = [
    "general_engineering",
    "brain_teaser",
    "coding",
    "code_review",
    "system_design",
    "signal_processing",
    // Specialization tracks
    "ai_researcher",
    "ai_ml_engineer",
    "frontend",
    "ui_ux",
    "cybersecurity",
    "hardware_ee",
    "firmware",
    "biomedical",
  ];

  const questionsByCategory = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  // Get sorted category keys based on preferred order
  const sortedCategories = Object.keys(questionsByCategory).sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a);
    const indexB = CATEGORY_ORDER.indexOf(b);
    // If category not in order list, put it at the end
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Default to first category or empty string if no questions
  const defaultCategory = sortedCategories[0] || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{report.candidate_name}</h1>
            <p className="text-muted-foreground">{report.candidate_email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasCertificate ? (
            <Button
              variant="outline"
              onClick={handleDownloadCertificate}
              disabled={certificateLoading}
              className="gap-2"
            >
              {certificateLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Award className="w-4 h-4" />
              )}
              Download Certificate
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleGenerateCertificate}
              disabled={certificateLoading}
              className="gap-2"
            >
              {certificateLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Award className="w-4 h-4" />
              )}
              Generate Certificate
            </Button>
          )}
          {/* Specialization Test Button - conditionally rendered based on Kimi2 analysis */}
          {hasKimiAnalysis === true ? (
            <Button
              variant="outline"
              onClick={handleOpenSpecializationDialog}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              Specialization Test
              {applicationFitScore && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {applicationFitScore}% fit
                </Badge>
              )}
            </Button>
          ) : hasKimiAnalysis === false ? (
            <Button
              variant="outline"
              className="gap-2"
              disabled
              title="Run Kimi2 Analysis on the Application first to enable specialization test generation"
            >
              <Zap className="w-4 h-4" />
              Specialization Test
              <Badge variant="outline" className="ml-1 text-xs text-amber-500 border-amber-500/50">
                Requires Analysis
              </Badge>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleOpenSpecializationDialog}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              Specialization Test
            </Button>
          )}
          {hasNdaSigned && (
            <Button
              variant="outline"
              onClick={handleDownloadNda}
              disabled={ndaDownloading}
              className="gap-2"
            >
              {ndaDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Download Signed NDA
            </Button>
          )}
          <Button onClick={generatePDF} className="gap-2">
            <Download className="w-4 h-4" />
            Download Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Assessment Summary</CardTitle>
                <CardDescription>
                  {getDifficultyLabel(report.difficulty || "")} level assessment
                </CardDescription>
              </div>
              <Badge className={badge.className}>{badge.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-5xl font-bold">
                  <span className={getScoreColor(report.overall_score)}>
                    {report.overall_score?.toFixed(1)}%
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">Overall Score</p>
              </div>

              <div className="flex-1 space-y-3">
                {sectionScores.map((section) => (
                  <div key={section.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{section.name}</span>
                      <span className={getScoreColor(section.score)}>
                        {section.score?.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={section.score || 0} />
                  </div>
                ))}
              </div>
            </div>

            {report.ai_summary && (
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">AI Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  {report.ai_summary}
                </p>
              </div>
            )}

            {report.detailed_feedback && (
              <div>
                <h3 className="font-medium mb-2">Detailed Feedback</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {report.detailed_feedback}
                </p>
              </div>
            )}

            {/* Dual Scoring Section - Always visible */}
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                {/* General Assessment */}
                <div className="p-4 rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-500" />
                    General Assessment
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-blue-600">
                        {(report.general_score ?? 0).toFixed(0)}
                      </span>
                      <span className="text-lg text-muted-foreground">/ 500</span>
                      <span className={`text-sm font-medium ml-2 ${getScoreColor(((report.general_score ?? 0) / 500) * 100)}`}>
                        ({(((report.general_score ?? 0) / 500) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Brain Teaser</span>
                        <span>{report.brain_teaser_score?.toFixed(0) || 0}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coding</span>
                        <span>{report.coding_score?.toFixed(0) || 0}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Code Review</span>
                        <span>{report.code_review_score?.toFixed(0) || 0}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">System Design</span>
                        <span>{report.system_design_score?.toFixed(0) || 0}/100</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specialization Assessment */}
                {report.specialization_track && (
                  <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      Concentration: {getTrackName(report.specialization_track)}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-purple-600">
                          {report.specialization_score?.toFixed(0) || 0}
                        </span>
                        <span className="text-lg text-muted-foreground">/ 500</span>
                        <span className={`text-sm font-medium ml-2 ${getScoreColor(((report.specialization_score || 0) / 500) * 100)}`}>
                          ({(((report.specialization_score || 0) / 500) * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {renderStars(getStarRating(((report.specialization_score || 0) / 500) * 100).stars)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {getStarRating(((report.specialization_score || 0) / 500) * 100).label}
                        </span>
                      </div>
                      {report.specialist_recommendation && (
                        <div className="pt-2">
                          <Badge className={`${getSpecialistRecommendationBadge(report.specialist_recommendation).className} border`}>
                            {getSpecialistRecommendationBadge(report.specialist_recommendation).label}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Specialization Test (1-hour) - 1000 points */}
              {specTestResults && specTestResults.specialty_score !== null && (
                <div className="p-4 rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Specialization Test: {specTestResults.primary_specialty || specTestResults.focus_area}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-amber-600">
                        {((specTestResults.specialty_score || 0) * 10).toFixed(0)}
                      </span>
                      <span className="text-lg text-muted-foreground">/ 1000</span>
                      <span className={`text-sm font-medium ml-2 ${getScoreColor(specTestResults.specialty_score || 0)}`}>
                        ({(specTestResults.specialty_score || 0).toFixed(0)}%)
                      </span>
                    </div>
                    {specTestResults.confidence && (
                      <div className="text-sm text-muted-foreground">
                        Confidence: {specTestResults.confidence.toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Total Score - 2000 points */}
              <div className="col-span-full p-4 rounded-lg border-2 border-primary bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Total Score
                </h3>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-primary">
                    {((report.general_score || 0) + (report.specialization_score || 0) + ((specTestResults?.specialty_score || 0) * 10)).toFixed(0)}
                  </span>
                  <span className="text-xl text-muted-foreground">/ 2000</span>
                  <span className={`text-lg font-medium ml-2 ${getScoreColor(((report.general_score || 0) + (report.specialization_score || 0) + ((specTestResults?.specialty_score || 0) * 10)) / 20)}`}>
                    ({(((report.general_score || 0) + (report.specialization_score || 0) + ((specTestResults?.specialty_score || 0) * 10)) / 20).toFixed(0)}%)
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <div className="font-medium">General</div>
                    <div>{(report.general_score || 0).toFixed(0)} / 500</div>
                  </div>
                  <div className="text-center p-2 bg-purple-100 dark:bg-purple-900/30 rounded">
                    <div className="font-medium">Concentration</div>
                    <div>{(report.specialization_score || 0).toFixed(0)} / 500</div>
                  </div>
                  <div className="text-center p-2 bg-amber-100 dark:bg-amber-900/30 rounded">
                    <div className="font-medium">Specialization</div>
                    <div>{((specTestResults?.specialty_score || 0) * 10).toFixed(0)} / 1000</div>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {report.strengths && report.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.strengths.map((strength, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {report.weaknesses && report.weaknesses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Anti-Cheat Monitoring Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                Integrity Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Tab Switches</span>
                </div>
                <Badge
                  variant={report.tab_switch_count && report.tab_switch_count > 0 ? "destructive" : "secondary"}
                >
                  {report.tab_switch_count || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Paste Attempts</span>
                </div>
                <Badge
                  variant={report.paste_attempt_count && report.paste_attempt_count > 0 ? "destructive" : "secondary"}
                >
                  {report.paste_attempt_count || 0}
                </Badge>
              </div>

              {report.tab_switch_timestamps && report.tab_switch_timestamps.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Tab Switch Timeline:</p>
                  <div className="space-y-1">
                    {report.tab_switch_timestamps.slice(0, 5).map((timestamp, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {formatPacificDateTime(timestamp)}
                      </p>
                    ))}
                    {report.tab_switch_timestamps.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{report.tab_switch_timestamps.length - 5} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Break Usage Card */}
          {(report.total_break_time_seconds != null && report.total_break_time_seconds > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-amber-500" />
                  Break Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Breaks Taken</span>
                  </div>
                  <Badge variant="secondary">
                    {report.break_count || 0}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Time Used</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatBreakTime(report.used_break_time_seconds || 0)} / {formatBreakTime(report.total_break_time_seconds || 0)}
                  </span>
                </div>

                {report.break_history && report.break_history.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Break History:</p>
                    <div className="space-y-2">
                      {report.break_history.map((entry, i) => (
                        <div key={i} className="text-xs text-muted-foreground p-2 rounded bg-muted/30">
                          <div className="flex justify-between">
                            <span>Break {i + 1}</span>
                            <span className="font-medium">{formatBreakTime(entry.duration_seconds)}</span>
                          </div>
                          <div className="text-[10px] mt-1">
                            {formatPacificDateTime(entry.start)}
                            {entry.end && ` - ${formatPacificDateTime(entry.end).split(" at ")[1]}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Skill Radar Chart and Role Fit Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Skill Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Skills Profile
            </CardTitle>
            <CardDescription>
              Visual representation of skill levels across categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SkillRadarChart
              data={generateSkillDataFromReport(report)}
              candidateName={report.candidate_name || "Candidate"}
              height={350}
            />
          </CardContent>
        </Card>

        {/* Role Fit Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Role Fit Analysis
            </CardTitle>
            <CardDescription>
              AI-powered role recommendations based on assessment results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roleFitLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : roleFitData ? (
              <div className="space-y-4">
                {roleFitData.top_recommendation && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Top Recommendation</p>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{roleFitData.top_recommendation.role_title}</p>
                      <Badge className="bg-primary/20 text-primary">
                        {roleFitData.top_recommendation.fit_score.toFixed(0)}% Fit
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {roleFitData.top_recommendation.explanation}
                    </p>
                  </div>
                )}

                {roleFitData.ai_recommendation?.recommendation_summary && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm">{roleFitData.ai_recommendation.recommendation_summary}</p>
                  </div>
                )}

                {roleFitData.role_fits.slice(1, 4).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Other Role Matches</p>
                    <div className="space-y-2">
                      {roleFitData.role_fits.slice(1, 4).map((role) => (
                        <div
                          key={role.role_id}
                          className="flex items-center justify-between p-2 rounded bg-muted/30"
                        >
                          <span className="text-sm">{role.role_title}</span>
                          <span className="text-sm font-medium">{role.fit_score.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {roleFitData.ai_recommendation?.development_areas && roleFitData.ai_recommendation.development_areas.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Development Areas</p>
                    <ul className="space-y-1">
                      {roleFitData.ai_recommendation.development_areas.map((area, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Role fit analysis not available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
          <CardDescription>
            Individual question responses and scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No questions found for this assessment.
            </p>
          ) : (
          <Tabs defaultValue={defaultCategory} key={defaultCategory}>
            <TabsList className="mb-4 flex-wrap">
              {sortedCategories.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {getCategoryLabel(category)}
                </TabsTrigger>
              ))}
            </TabsList>

            {sortedCategories.map((category) => {
              const qs = questionsByCategory[category] || [];
              return (
              <TabsContent key={category} value={category} className="space-y-4">
                {qs.map((question, i) => (
                  <div
                    key={question.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Question {i + 1}</h4>
                        {question.answer?.time_spent_seconds !== null && question.answer?.time_spent_seconds !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {Math.floor(question.answer.time_spent_seconds / 60)}m {question.answer.time_spent_seconds % 60}s
                          </Badge>
                        )}
                        {question.answer?.is_suspiciously_fast && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Quick Answer
                          </Badge>
                        )}
                      </div>
                      {question.answer?.score !== null && question.answer?.score !== undefined && (
                        <Badge
                          className={
                            question.answer.score >= 70
                              ? "bg-green-500/20 text-green-500"
                              : question.answer.score >= 50
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-red-500/20 text-red-500"
                          }
                        >
                          {question.answer.score.toFixed(0)}%
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm mb-3">{question.question_text}</p>

                    {question.question_code && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Given Code:
                        </p>
                        <pre className="p-3 rounded bg-muted text-xs overflow-x-auto">
                          {question.question_code}
                        </pre>
                      </div>
                    )}

                    {question.answer && (
                      <div className="space-y-3 mt-4 pt-4 border-t">
                        {question.answer.candidate_answer && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Candidate Answer:
                            </p>
                            <p className="text-sm p-3 rounded bg-muted/50">
                              {question.answer.candidate_answer}
                            </p>
                          </div>
                        )}

                        {question.answer.candidate_code && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Candidate Code:
                            </p>
                            <pre className="p-3 rounded bg-muted/50 text-xs overflow-x-auto">
                              {question.answer.candidate_code}
                            </pre>
                          </div>
                        )}

                        {question.answer.feedback && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              AI Feedback:
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {question.answer.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>
              );
            })}
          </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Specialization Test Dialog */}
      <Dialog open={showSpecializationDialog} onOpenChange={setShowSpecializationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              Generate Specialization Test
            </DialogTitle>
            <DialogDescription>
              Create a 1-hour deep-dive assessment to identify {report?.candidate_name}&apos;s exact sub-specialty.
              {hasKimiAnalysis && (
                <span className="block mt-1 text-xs text-green-600">
                  Questions will be personalized using test scores, application data, and AI analysis.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {specTestResult ? (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-300">Test Created Successfully!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  The specialization test has been generated with{" "}
                  {focusAreas.find(a => a.id === selectedFocusArea)?.name || selectedFocusArea} focus.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Test Link (click to select):</label>
                <input
                  type="text"
                  readOnly
                  value={getSpecTestLink()}
                  className="w-full px-3 py-2 text-xs border rounded bg-muted font-mono cursor-text"
                  onClick={(e) => {
                    e.currentTarget.select();
                    e.currentTarget.setSelectionRange(0, 99999);
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copySpecTestLink} className="flex-1">
                    <Clipboard className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(getSpecTestLink(), '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Test
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Focus Area</label>
                <Select value={selectedFocusArea} onValueChange={setSelectedFocusArea}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a focus area..." />
                  </SelectTrigger>
                  <SelectContent>
                    {focusAreas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        <div>
                          <span>{area.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({area.sub_specialties?.length || 0} sub-specialties)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFocusArea && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Sub-specialties to assess:</p>
                  <div className="flex flex-wrap gap-1">
                    {focusAreas
                      .find((a) => a.id === selectedFocusArea)
                      ?.sub_specialties?.slice(0, 6)
                      .map((sub) => (
                        <span
                          key={sub}
                          className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full"
                        >
                          {sub}
                        </span>
                      ))}
                    {(focusAreas.find((a) => a.id === selectedFocusArea)?.sub_specialties?.length || 0) > 6 && (
                      <span className="text-xs px-2 py-1 text-muted-foreground">
                        +{(focusAreas.find((a) => a.id === selectedFocusArea)?.sub_specialties?.length || 0) - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="text-sm text-muted-foreground p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span>This will generate a 60-minute focused assessment</span>
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSpecializationDialog(false)}>
              {specTestResult ? "Close" : "Cancel"}
            </Button>
            {!specTestResult && (
              <Button
                onClick={handleGenerateSpecializationTest}
                disabled={!selectedFocusArea || generatingSpecTest}
              >
                {generatingSpecTest ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Test
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
