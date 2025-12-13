"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { certificatesApi } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Award,
  Calendar,
  User,
  Building2,
} from "lucide-react";
import Image from "next/image";

interface VerificationResult {
  valid: boolean;
  certificate_id: string;
  candidate_name: string | null;
  test_date: string | null;
  track: string | null;
  score_tier: string | null;
  overall_score: number | null;
  issued_by: string;
  message: string | null;
}

const tierColors: Record<string, string> = {
  Distinguished: "bg-amber-500/20 text-amber-500 border-amber-500/50",
  Proficient: "bg-slate-400/20 text-slate-300 border-slate-400/50",
  Passed: "bg-orange-700/20 text-orange-400 border-orange-500/50",
  "Did Not Pass": "bg-slate-600/20 text-slate-400 border-slate-600/50",
};

const getTrackTitle = (track: string | null): string => {
  if (!track) return "Engineering Assessment";
  const trackMap: Record<string, string> = {
    signal_processing: "Biomedical Signal Processing Engineer",
    llm: "ML/AI Engineer",
  };
  return trackMap[track] || "Engineering Assessment";
};

export default function CertificateVerifyPage() {
  const params = useParams();
  const certificateId = params.certificateId as string;
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await certificatesApi.verify(certificateId);
        setResult(response.data);
      } catch (error) {
        console.error("Error verifying certificate:", error);
        setResult({
          valid: false,
          certificate_id: certificateId,
          candidate_name: null,
          test_date: null,
          track: null,
          score_tier: null,
          overall_score: null,
          issued_by: "KOS (Kernel of Science)",
          message: "Unable to verify certificate. Please try again later.",
        });
      } finally {
        setLoading(false);
      }
    };

    if (certificateId) {
      verify();
    }
  }, [certificateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-slate-900/80 border-slate-700 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <Image
              src="/kos-quest-logo.png"
              alt="KOS Quest"
              width={120}
              height={80}
              className="object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Certificate Verification</CardTitle>
          <CardDescription>
            KOS (Kernel of Science) - Stanford Research Park
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Verification Status */}
          <div
            className={`p-6 rounded-xl text-center ${
              result?.valid
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            {result?.valid ? (
              <>
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-green-400 mb-1">
                  Valid Certificate
                </h2>
                <p className="text-sm text-green-300/80">
                  This certificate is authentic and was issued by KOS
                </p>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-red-400 mb-1">
                  Invalid Certificate
                </h2>
                <p className="text-sm text-red-300/80">
                  {result?.message || "This certificate could not be verified"}
                </p>
              </>
            )}
          </div>

          {/* Certificate Details */}
          {result?.valid && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Candidate Name</p>
                    <p className="font-semibold">{result.candidate_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Award className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assessment</p>
                    <p className="font-semibold">{getTrackTitle(result.track)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date Issued</p>
                    <p className="font-semibold">
                      {result.test_date
                        ? new Date(result.test_date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Issued By</p>
                    <p className="font-semibold">{result.issued_by}</p>
                  </div>
                </div>
              </div>

              {/* Score Tier */}
              {result.score_tier && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Achievement Level
                    </p>
                    <Badge
                      className={tierColors[result.score_tier] || "bg-slate-500/20"}
                    >
                      {result.score_tier}
                    </Badge>
                  </div>
                  {result.overall_score !== null && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Score</p>
                      <p className="text-2xl font-bold">{result.overall_score}%</p>
                    </div>
                  )}
                </div>
              )}

              {/* Certificate ID */}
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">Certificate ID</p>
                <p className="font-mono text-sm text-slate-400">
                  {result.certificate_id}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-4 border-t border-slate-700">
            <p className="text-xs text-muted-foreground">
              KOS Stanford Research Park, Palo Alto, CA 94304
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
