"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, FileText, Loader2 } from "lucide-react";
import { testsApi } from "@/lib/api";
import { formatPacificDate } from "@/lib/utils";

interface AgreementScreenProps {
  candidateName: string;
  testToken: string;
  onComplete: () => void;
}

// Testing Integrity Agreement text
const INTEGRITY_BULLETS = [
  "I will NOT use search engines (Google, Bing, etc.)",
  "I will NOT use AI assistants (ChatGPT, Claude, Copilot, Gemini, or any similar tools)",
  "I will NOT reference external code, documentation, or resources",
  "I will NOT communicate with others during the assessment",
  "All answers submitted are entirely my own work",
];

// Mutual Arbitration Agreement text
const ARBITRATION_TEXT = `KOS INC.
MUTUAL ARBITRATION AGREEMENT FOR EMPLOYMENT RELATED CLAIMS & DISPUTES

Although KOS Inc. ("KOS") hopes that employment disputes with its employees will not occur, KOS believes that when such disputes do arise, it is in the mutual interest of all concerned to handle them promptly and with a minimum disturbance to the operations of KOS's businesses and the lives of its employees. Accordingly, to provide for a more expeditious resolution of employment-related claims and disputes that may arise between KOS and the undersigned ("Candidate"), both KOS and Candidate (collectively the "Parties") hereby agree to mandatory arbitration for any and all claims and disputes that arise or may arise from Candidate's potential employment with KOS, except as provided for herein.

MUTUAL ARBITRATION AGREEMENT. The Parties mutually agree that any and all controversies, claims, or disputes arising out of, relating to, or resulting from Candidate's potential employment with KOS or any employment-related matters shall be subject to binding arbitration under the Federal Arbitration Act and administered by Judicial Arbitration & Mediation Services ("JAMS") in accordance with its Employment Arbitration Rules and Procedures then in effect.

PROCEDURE. Both parties mutually agree that any arbitration under this Mutual Arbitration Agreement will be (a) brought forth in San Jose, California; and (b) administered by the rules set forth by JAMS Employment Arbitration Rules and Procedures.

CALIFORNIA LAW APPLIES. Candidate and KOS agree that this Agreement will be interpreted in accordance with and governed for all purposes by the laws of the State of California.

VOLUNTARY NATURE OF AGREEMENT. Candidate acknowledges and agrees that they are executing this Agreement voluntarily and without any duress or undue influence.

BOTH PARTIES UNDERSTAND THAT BY AGREEING TO THE TERMS OF THIS MUTUAL ARBITRATION AGREEMENT, BOTH ARE WAIVING THEIR RIGHTS TO HAVE ANY COVERED CLAIM(S) DECIDED IN A COURT OF LAW BEFORE A JUDGE OR A JURY.`;

export function AgreementScreen({
  candidateName,
  testToken,
  onComplete,
}: AgreementScreenProps) {
  const [signature, setSignature] = useState("");
  const [integrityAgreed, setIntegrityAgreed] = useState(false);
  const [ndaAgreed, setNdaAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track scroll position to enable NDA checkbox
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      // Consider "scrolled to bottom" when within 20px of bottom
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        setHasScrolledToBottom(true);
      }
    }
  };

  // Check on mount if content is short enough to not need scrolling
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollHeight <= clientHeight) {
        setHasScrolledToBottom(true);
      }
    }
  }, []);

  const canSubmit =
    signature.trim().length > 0 &&
    integrityAgreed &&
    ndaAgreed &&
    hasScrolledToBottom;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      await testsApi.signAgreement(testToken, {
        signature: signature.trim(),
        integrity_agreed: integrityAgreed,
        nda_agreed: ndaAgreed,
      });
      onComplete();
    } catch (err) {
      console.error("Error signing agreement:", err);
      setError("Failed to sign agreement. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentDate = formatPacificDate(new Date());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">KOS Inc.</h1>
              <p className="text-sm text-slate-400">Technical Assessment Agreement</p>
            </div>
          </div>
          <p className="text-slate-300">
            Welcome, <span className="font-semibold text-white">{candidateName}</span>
          </p>
        </div>

        {/* Section 1: Testing Integrity Agreement */}
        <Card className="mb-6 border-amber-500/30 bg-slate-800/50 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Shield className="w-5 h-5" />
              Section 1: Testing Integrity Certification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-300 font-medium">
              This assessment is designed to evaluate YOUR individual technical knowledge and skills.
            </p>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <p className="text-slate-200 font-semibold mb-3">
                By proceeding, I certify that:
              </p>
              <ul className="space-y-2">
                {INTEGRITY_BULLETS.map((bullet, index) => (
                  <li key={index} className="flex items-start gap-2 text-slate-300">
                    <span className="text-amber-400 mt-1">-</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">
                <strong>Warning:</strong> Violations may result in immediate disqualification and withdrawal of candidacy.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Mutual Arbitration Agreement */}
        <Card className="mb-6 border-slate-600 bg-slate-800/50 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-200">
              <FileText className="w-5 h-5" />
              Section 2: Mutual Arbitration Agreement
            </CardTitle>
            {!hasScrolledToBottom && (
              <p className="text-sm text-amber-400 mt-2">
                Please scroll to the bottom to enable the checkbox
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="max-h-[400px] overflow-y-auto bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600"
              style={{ scrollbarWidth: "thin" }}
            >
              {ARBITRATION_TEXT}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Digital Signature */}
        <Card className="border-primary/30 bg-slate-800/50 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-200">Section 3: Digital Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Signature Input */}
            <div className="space-y-2">
              <Label htmlFor="signature" className="text-slate-200">
                Full Legal Name
              </Label>
              <Input
                id="signature"
                type="text"
                placeholder="Type your full legal name"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
              />
            </div>

            {/* Date Display */}
            <div className="text-slate-400 text-sm">
              Date: <span className="text-white">{currentDate}</span>
            </div>

            {/* Checkboxes */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="integrity-agree"
                  checked={integrityAgreed}
                  onCheckedChange={(checked) => setIntegrityAgreed(checked as boolean)}
                  className="mt-1 border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor="integrity-agree"
                  className="text-slate-300 cursor-pointer leading-relaxed"
                >
                  I agree to the Testing Integrity Agreement
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="nda-agree"
                  checked={ndaAgreed}
                  onCheckedChange={(checked) => setNdaAgreed(checked as boolean)}
                  disabled={!hasScrolledToBottom}
                  className="mt-1 border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="nda-agree"
                  className={`cursor-pointer leading-relaxed ${
                    hasScrolledToBottom ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  I have read and agree to the Mutual Arbitration Agreement
                  {!hasScrolledToBottom && (
                    <span className="block text-xs text-amber-400 mt-1">
                      (Scroll to bottom of arbitration agreement to enable)
                    </span>
                  )}
                </Label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing Agreement...
                </>
              ) : (
                "Proceed to Assessment"
              )}
            </Button>

            {!canSubmit && !submitting && (
              <p className="text-center text-slate-500 text-sm">
                {!signature.trim()
                  ? "Please enter your full legal name"
                  : !hasScrolledToBottom
                  ? "Please scroll to the bottom of the arbitration agreement"
                  : !integrityAgreed
                  ? "Please agree to the Testing Integrity Agreement"
                  : !ndaAgreed
                  ? "Please agree to the Mutual Arbitration Agreement"
                  : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          This document will be electronically signed and is legally binding.
        </p>
      </div>
    </div>
  );
}
