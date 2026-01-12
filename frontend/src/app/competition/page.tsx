"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { competitionsApi } from "@/lib/api";
import { formatPacificDate } from "@/lib/utils";
import { Competition } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Users, Trophy, Clock, ArrowRight } from "lucide-react";

export default function CompetitionLandingPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchCompetitions();
  }, []);

  const formatDatePT = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    return formatPacificDate(dateStr);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Find active competition (registration open or screening active)
  const activeCompetition = competitions.find(
    (c) => c.status === "registration_open" || c.status === "screening_active"
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="flex justify-center mb-8">
            <Image
              src="/kos-quest-logo.png"
              alt="KOS Quest"
              width={100}
              height={100}
              className="rounded-xl shadow-lg"
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            KOS Quest Global Engineering Competition
          </h1>

          <p className="text-xl text-muted-foreground">
            Join 30,000 engineers from around the world competing for a chance to work
            with cutting-edge AI and signal processing technology.
          </p>

          {activeCompetition && (
            <div className="pt-4">
              <Link href={`/competition/register?id=${activeCompetition.id}`}>
                <Button size="lg" className="text-lg px-8">
                  Register Now <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Competition Cards */}
      <div className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold mb-6">Competitions</h2>

        {competitions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No competitions available at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {competitions.map((competition) => (
              <Card key={competition.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{competition.name}</CardTitle>
                    {getStatusBadge(competition.status)}
                  </div>
                  {competition.description && (
                    <CardDescription>{competition.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{competition.registration_count.toLocaleString()} / {competition.max_participants.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-muted-foreground" />
                      <span>Top {competition.qualified_count} qualify</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{competition.test_duration_minutes} min test</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Deadline: {formatDatePT(competition.screening_deadline)}</span>
                    </div>
                  </div>

                  {(competition.status === "registration_open" || competition.status === "screening_active") && (
                    <Link href={`/competition/register?id=${competition.id}`} className="block mt-4">
                      <Button className="w-full">
                        Register <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* How It Works Section */}
      <div className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold">Register</h3>
              <p className="text-sm text-muted-foreground">
                Sign up with your email and receive a unique screening link
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold">Take Screening Test</h3>
              <p className="text-sm text-muted-foreground">
                Complete the 1-hour screening test before the deadline
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold">Qualify for Live Competition</h3>
              <p className="text-sm text-muted-foreground">
                Top 500 engineers advance to the live competition
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
