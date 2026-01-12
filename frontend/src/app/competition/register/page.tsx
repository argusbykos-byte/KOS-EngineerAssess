"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { competitionsApi } from "@/lib/api";
import { formatPacificDate } from "@/lib/utils";
import { Competition, RegistrationWithToken } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, ArrowLeft, Calendar, Clock, Users } from "lucide-react";

function RegisterContent() {
  const searchParams = useSearchParams();
  const competitionId = searchParams.get("id");

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<RegistrationWithToken | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const fetchCompetition = async () => {
      if (!competitionId) {
        setError("No competition selected");
        setLoading(false);
        return;
      }

      try {
        const res = await competitionsApi.get(parseInt(competitionId));
        setCompetition(res.data);
      } catch (error) {
        console.error("Error fetching competition:", error);
        setError("Competition not found");
      } finally {
        setLoading(false);
      }
    };
    fetchCompetition();
  }, [competitionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competition) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await competitionsApi.register(competition.id, { name, email });
      setRegistration(res.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDatePT = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    return formatPacificDate(dateStr, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !competition) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Link href="/competition">
              <Button variant="outline">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back to Competitions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (registration) {
    const screeningUrl = `/competition/screening/${registration.registration_token}?competition=${competition?.id}`;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Registration Successful!</CardTitle>
            <CardDescription>
              You are now registered for {registration.competition_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm">
                <strong>Name:</strong> {registration.candidate_name}
              </p>
              <p className="text-sm">
                <strong>Email:</strong> {registration.candidate_email}
              </p>
              {registration.screening_deadline && (
                <p className="text-sm">
                  <strong>Deadline:</strong> {formatDatePT(registration.screening_deadline)}
                </p>
              )}
            </div>

            <Alert>
              <AlertDescription>
                Save your screening link! You will need it to access your test.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Your Screening Link:</p>
              <code className="text-xs break-all block bg-background p-2 rounded">
                {typeof window !== "undefined" ? window.location.origin : ""}{screeningUrl}
              </code>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const fullUrl = `${window.location.origin}${screeningUrl}`;
                  navigator.clipboard.writeText(fullUrl);
                }}
              >
                Copy Link
              </Button>
              <Link href={screeningUrl} className="flex-1">
                <Button className="w-full">Start Screening Test</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center gap-3 mb-4">
            <Image
              src="/kos-quest-logo.png"
              alt="KOS Quest"
              width={60}
              height={60}
              className="rounded-xl shadow-lg"
            />
          </div>
          <CardTitle className="text-2xl">Register for Competition</CardTitle>
          <CardDescription>
            {competition?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Competition Info */}
          <div className="grid grid-cols-3 gap-4 text-sm text-center bg-muted p-4 rounded-lg">
            <div>
              <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="font-medium">{competition?.test_duration_minutes} min</p>
              <p className="text-xs text-muted-foreground">Test Duration</p>
            </div>
            <div>
              <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="font-medium">{competition?.registration_count.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
            <div>
              <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="font-medium text-xs">{formatDatePT(competition?.screening_deadline || null).split(",")[0]}</p>
              <p className="text-xs text-muted-foreground">Deadline</p>
            </div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </form>

          <div className="text-center">
            <Link href="/competition" className="text-sm text-muted-foreground hover:underline">
              <ArrowLeft className="inline w-4 h-4 mr-1" />
              Back to Competitions
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
