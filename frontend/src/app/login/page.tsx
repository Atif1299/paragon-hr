"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

const STAGES = [
  "Sourcing – auto-capture into the Master Recruitment Sheet",
  "Screening – QCA form + keyword & Claude skill match",
  "Pre-selection – trait scorecard with fallback questionnaire",
  "Selection – event log, booking links, transcript analysis",
  "Onboarding – demo-session project report",
];

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 font-bold">
            P
          </div>
          <div>
            <p className="font-semibold">Paragon Global Internships</p>
            <p className="text-xs text-indigo-200">Realising Excellence</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-3xl font-semibold leading-tight">
            Recruitment Automation
            <br />
            from sourcing to onboarding.
          </h1>
          <ul className="mt-8 space-y-3">
            {STAGES.map((s) => (
              <li key={s} className="flex items-start gap-3 text-sm text-indigo-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-indigo-300">All candidate data is retained as company IP.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use your company account to access the recruitment dashboard.</p>
          </div>
          <ErrorNote message={error} />
          <Field label="Email">
            <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
          <p className="text-center text-xs text-slate-400">
            Looking for a job?{" "}
            <a href="/careers" className="font-medium text-brand-600 hover:underline">
              View open roles
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
