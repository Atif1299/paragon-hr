"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, LayoutDashboard, LogOut, Mail, Settings, Users, UserSearch } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: UserSearch },
  { href: "/events", label: "Recruitment Events", icon: CalendarDays },
  { href: "/jobs", label: "Open Roles", icon: Briefcase },
  { href: "/outbox", label: "Email Outbox", icon: Mail, editorOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
];

const ROLE_LABEL = { admin: "Admin", hr: "HR / Recruiter", viewer: "Viewer" };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, canEdit, isAdmin, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-full w-64 shrink-0 flex-col bg-brand-900 text-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 text-sm font-bold">
            P
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Paragon Global</p>
            <p className="text-xs text-indigo-200">Recruitment Automation</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.filter((n) => (!n.adminOnly || isAdmin) && (!n.editorOnly || canEdit)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-white/10 text-white" : "text-indigo-200 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-indigo-200">
              {user && ROLE_LABEL[user.role]} · {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-200 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold text-brand-900">Paragon Recruitment</span>
          <div className="flex gap-1 overflow-x-auto">
            {NAV.filter((n) => (!n.adminOnly || isAdmin) && (!n.editorOnly || canEdit)).map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" title={item.label}>
                <item.icon className="h-4 w-4" />
              </Link>
            ))}
            <button onClick={logout} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-4 pb-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
