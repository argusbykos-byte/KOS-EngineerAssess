"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, FileText, BarChart3, MessageSquare } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Candidates", href: "/admin/candidates", icon: Users },
  { name: "Reports", href: "/admin/reports", icon: FileText },
  { name: "Suggestions", href: "/admin/suggestions", icon: MessageSquare },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/admin" className="flex items-center gap-3 mr-8">
          <Image
            src="/kos-quest-logo.png"
            alt="KOS Quest"
            width={40}
            height={40}
            className="rounded"
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight">KOS Quest</span>
            <span className="text-xs text-muted-foreground leading-tight">Admin Portal</span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Mythological Engineering Assessment
          </span>
        </div>
      </div>
    </header>
  );
}
