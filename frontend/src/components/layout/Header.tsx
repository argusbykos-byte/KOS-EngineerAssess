"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, FileText, BarChart3, MessageSquare, ShieldAlert, GitCompare, Trophy, ClipboardList, Target } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Competitions", href: "/admin/competitions", icon: Trophy },
  { name: "Applications", href: "/admin/applications", icon: ClipboardList },
  { name: "Candidates", href: "/admin/candidates", icon: Users },
  { name: "Reports", href: "/admin/reports", icon: FileText },
  { name: "Specialization", href: "/admin/specialization-results", icon: Target },
  { name: "Compare", href: "/admin/compare", icon: GitCompare },
  { name: "Integrity", href: "/admin/cheating-logs", icon: ShieldAlert },
  { name: "Suggestions", href: "/admin/suggestions", icon: MessageSquare },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      {/* Gradient border at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative w-full flex h-16 items-center">
        {/* Logo Section - Flush left with minimal padding */}
        <Link href="/admin" className="flex items-center gap-3 pl-4 pr-6">
          <Image
            src="/kos-quest-logo.png"
            alt="Quest"
            width={56}
            height={56}
            className="rounded-xl shadow-lg"
            style={{ width: 56, height: 56, objectFit: 'contain' }}
          />
          <Image
            src="/kos-logo.png"
            alt="KOS"
            width={90}
            height={36}
            style={{ width: 'auto', height: 36, objectFit: 'contain' }}
          />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                  isActive
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Active background with glow */}
                {isActive && (
                  <>
                    <span className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600 rounded-xl" />
                    <span className="absolute inset-0 bg-gradient-to-r from-primary to-blue-600 rounded-xl blur-md opacity-50" />
                  </>
                )}
                {/* Hover background */}
                {!isActive && (
                  <span className="absolute inset-0 bg-accent/0 hover:bg-accent/80 rounded-xl transition-colors duration-300" />
                )}
                <item.icon className={cn("relative w-4 h-4", isActive && "text-white")} />
                <span className="relative">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-4 pr-4">
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/5 to-cyan-500/5 border border-primary/10">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">
              Mythological Engineering Assessment
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
