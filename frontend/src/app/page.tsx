import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brain, ArrowRight, Users, FileText, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">KOS AI</span>
          </div>
          <Link href="/admin">
            <Button>
              Admin Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container max-w-4xl text-center space-y-8 py-20">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              AI-Powered Engineering
              <br />
              <span className="text-primary">Candidate Assessment</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Evaluate engineering candidates with intelligent, personalized
              assessments powered by advanced AI. Generate custom tests based on
              resume analysis and receive comprehensive evaluation reports.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link href="/admin">
              <Button size="lg" className="gap-2">
                <Users className="w-5 h-5" />
                Get Started
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button size="lg" variant="outline" className="gap-2">
                <FileText className="w-5 h-5" />
                View Reports
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 pt-16">
            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI-Generated Tests</h3>
              <p className="text-muted-foreground text-sm">
                Automatically generate personalized assessment questions based
                on candidate resumes and skill profiles.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Comprehensive Reports</h3>
              <p className="text-muted-foreground text-sm">
                Get detailed evaluation reports with scoring, strengths,
                weaknesses, and hiring recommendations.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Analytics Dashboard</h3>
              <p className="text-muted-foreground text-sm">
                Track candidate performance with visual analytics and
                insights to improve hiring decisions.
              </p>
            </div>
          </div>

          {/* Categories */}
          <div className="pt-8">
            <p className="text-sm text-muted-foreground mb-4">
              Assessment Categories
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Backend",
                "Machine Learning",
                "Full-Stack",
                "Python",
                "React",
                "Signal Processing",
              ].map((category) => (
                <span
                  key={category}
                  className="px-3 py-1 rounded-full bg-secondary text-sm"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          KOS-EngineerAssess - AI-Powered Engineering Assessment Platform
        </div>
      </footer>
    </div>
  );
}
