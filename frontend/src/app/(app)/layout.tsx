"use client";

import { AppShell } from "@/components/app-shell";
import { FullPageSpinner } from "@/components/ui";
import { AuthProvider } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider fallback={<FullPageSpinner />}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
