"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Check, MapPin, Cpu, FlaskConical, DollarSign } from "lucide-react";

export default function QuestPage() {
  // Typing animation state
  const roles = ["early death", "heart disease", "diabetes", "1.2 billion lives"];
  const [currentRole, setCurrentRole] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const targetText = roles[currentRole];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < targetText.length) {
          setDisplayText(targetText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCurrentRole((prev) => (prev + 1) % roles.length);
        }
      }
    }, isDeleting ? 50 : 100);
    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentRole, roles]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24 py-20">
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
            You Found Us.
          </h1>

          <p className="text-xl md:text-2xl text-white/60 mb-12 leading-relaxed max-w-2xl">
            If you&apos;re reading this, you&apos;ve taken the first step toward something meaningful.
            <br />
            Something bigger than you or me.
          </p>

          <div className="text-2xl md:text-3xl leading-relaxed">
            <p className="mb-4">
              We&apos;re assembling the <span className="text-orange-500 font-mono font-bold number-glow">50</span> best engineers in the world to solve
            </p>
            <p className="text-teal-400 font-mono text-3xl md:text-4xl">
              <span className="typing-cursor">{displayText}</span>
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* The Opportunity Section */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-t border-white/10">
        <div className="max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-12 tracking-tight">
            The <span className="text-teal-400">KOS</span> Quest
          </h2>

          <p className="text-xl text-white/70 mb-12 leading-relaxed">
            We&apos;re not looking for people with the most skills.
            <br />
            We&apos;re looking for people who are <span className="text-white font-semibold">the best at what they do</span>&mdash;even if it&apos;s just one thing.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <Check className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
              <span className="text-lg">Work alongside <span className="text-orange-500 font-mono font-bold">49</span> of the world&apos;s best</span>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <Cpu className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
              <span className="text-lg">NVIDIA <span className="text-teal-400">Blackwell</span> GPU clusters</span>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <FlaskConical className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
              <span className="text-lg">State-of-the-art biomedical lab</span>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <MapPin className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
              <span className="text-lg"><span className="text-teal-400">Stanford</span> Research Park, Palo Alto</span>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10 md:col-span-2">
              <DollarSign className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
              <span className="text-lg"><span className="text-green-500 font-mono font-bold money-glow">$200K - $500K</span> total package</span>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-r from-orange-500/10 to-green-500/10 border border-orange-500/20">
            <p className="text-xl text-center">
              The one who cracks all <span className="text-orange-500 font-mono font-bold number-glow">2000</span> points receives a{" "}
              <span className="text-green-500 font-mono font-bold money-glow">$100,000</span> check immediately.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-t border-white/10">
        <div className="max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-16 tracking-tight">
            How It Works
          </h2>

          {/* Step 1 */}
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-orange-500 font-mono text-sm font-bold">STEP 01</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Skills Assessment</h3>
            <p className="text-lg text-white/70 leading-relaxed">
              List your skills. Our AI&mdash;<span className="text-teal-400 font-semibold">Blue Eye</span>&mdash;analyzes your fit.
            </p>
          </div>

          {/* Step 2 */}
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-orange-500 font-mono text-sm font-bold">STEP 02</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Paid Trial Day</h3>
            <p className="text-lg text-white/70 leading-relaxed mb-4">
              8 hours at our lab. <span className="text-green-500 font-mono font-bold money-glow">$500</span> paid regardless of outcome.
            </p>
            <p className="text-lg text-white/70 leading-relaxed mb-4">
              <span className="text-orange-500 font-mono font-bold number-glow">1000</span> points: 500 general + 500 concentration.
            </p>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 mt-6">
              <p className="text-white/60">
                <span className="text-teal-400 font-semibold">Non-US:</span> Remote assessment first (unpaid). Pass &rarr; we fly you in.
                <br />
                Flights, hotel, visa covered.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-orange-500 font-mono text-sm font-bold">STEP 03</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Specialization Test</h3>
            <p className="text-lg text-white/70 leading-relaxed mb-4">
              Top <span className="text-orange-500 font-mono font-bold number-glow">1%</span>? Final 1-hour test. <span className="text-green-500 font-mono font-bold money-glow">$100</span> paid. <span className="text-orange-500 font-mono font-bold number-glow">1000</span> points.
            </p>
            <p className="text-lg text-white/70 leading-relaxed">
              Job offer within <span className="text-orange-500 font-mono font-bold number-glow">2 hours</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Who We Are Section */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-t border-white/10">
        <div className="max-w-4xl">
          <h2 className="text-6xl md:text-8xl font-bold mb-8 tracking-tight text-teal-400">
            KOS
          </h2>
          <p className="text-xl md:text-2xl text-white/70 leading-relaxed">
            Elite engineers. Biomedical scientists. Physicians. Industry leaders. Academics.
            <br />
            Working hand in hand on one mission: <span className="text-white font-semibold">prevent early death</span>.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 md:px-12 lg:px-24 py-32 border-t border-white/10">
        <div className="max-w-4xl text-center mx-auto">
          <Link
            href="/apply"
            className="inline-flex items-center gap-3 px-12 py-6 bg-teal-500 hover:bg-teal-400 text-black font-bold text-xl rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-teal-500/25"
          >
            Begin Application
            <ArrowRight className="w-6 h-6" />
          </Link>

          <p className="mt-8 text-white/40 text-sm font-mono">
            {/* code-style comment display */}
            {"// Your journey starts here"}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-24 py-8 border-t border-white/10">
        <div className="max-w-4xl flex items-center justify-between text-white/40 text-sm">
          <span>&copy; {new Date().getFullYear()} KOS Inc.</span>
          <span className="font-mono">Stanford Research Park, Palo Alto</span>
        </div>
      </footer>
    </div>
  );
}
