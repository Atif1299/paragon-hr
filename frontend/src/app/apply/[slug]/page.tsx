"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { Button, Card, CardHeader, ErrorNote, Field, Input, LoadingBlock, Select, Textarea } from "@/components/ui";
import { PublicShell } from "@/components/public-shell";

interface FormMeta {
  job: { id: number; slug: string; title: string; area: string; description: string; min_years: number };
  qca_fields: { key: string; label: string; type: "number" | "text" }[];
  trait_questions: { key: string; question: string }[];
  employment_statuses: string[];
}

const SOURCES = ["LinkedIn", "Indeed", "Upwork", "Rozee.pk", "Facebook", "Referral", "Company website", "Other"];

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, error, loading } = useApi<FormMeta>(`/api/public/jobs/${slug}`);
  const [form, setForm] = useState<Record<string, string>>({ source_platform: "LinkedIn" });
  const [qca, setQca] = useState<Record<string, string>>({});
  const [traits, setTraits] = useState<Record<string, string>>({});
  const [cv, setCv] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cv) {
      setSubmitError("Please attach your CV.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const fd = new FormData();
    fd.set("job_slug", slug);
    fd.set("payload", JSON.stringify({ ...form, qca, trait_answers: traits }));
    fd.set("cv", cv);
    try {
      const res = await api<{ reference: string }>("/api/public/apply", { method: "POST", body: fd });
      setReference(res.reference);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) return <PublicShell><LoadingBlock /></PublicShell>;
  if (!data) return <PublicShell><ErrorNote message={error || "Role not found"} /></PublicShell>;

  if (reference)
    return (
      <PublicShell>
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Application submitted</h1>
          <p className="mt-2 text-slate-600">
            Thank you for applying for <b>{data.job.title}</b>. Your reference is <b>{reference}</b>.
          </p>
          <p className="mt-1 text-sm text-slate-500">We have emailed you a confirmation and will be in touch with next steps.</p>
        </Card>
      </PublicShell>
    );

  return (
    <PublicShell>
      <p className="text-sm font-medium text-brand-600">{data.job.area}</p>
      <h1 className="mt-1 text-3xl font-semibold text-slate-900">{data.job.title}</h1>
      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Read the job description</summary>
        <p className="prose-pre mt-3 text-sm leading-relaxed text-slate-600">{data.job.description}</p>
      </details>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Card>
          <CardHeader title="Your details" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input required value={form.full_name ?? ""} onChange={set("full_name")} />
            </Field>
            <Field label="Email" required>
              <Input type="email" required value={form.email ?? ""} onChange={set("email")} />
            </Field>
            <Field label="WhatsApp number" required>
              <Input required value={form.phone ?? ""} onChange={set("phone")} placeholder="+92 3xx xxxxxxx" />
            </Field>
            <Field label="Current employment status" required>
              <Select required value={form.employment_status ?? ""} onChange={set("employment_status")}>
                <option value="">Select…</option>
                {data.employment_statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Previous employment" hint="Designation | Company" className="sm:col-span-2">
              <Input value={form.previous_employment ?? ""} onChange={set("previous_employment")} />
            </Field>
            <Field label="Total years of experience" required>
              <Input type="number" min="0" step="0.5" required value={form.experience_years ?? ""} onChange={set("experience_years")} />
            </Field>
            <Field label="Notice period / availability">
              <Input value={form.notice_period ?? ""} onChange={set("notice_period")} placeholder="e.g. Immediately, 2 weeks" />
            </Field>
            <Field label="Where did you find this role?">
              <Select value={form.source_platform} onChange={set("source_platform")}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Do you have a VPN?">
              <Select value={form.has_vpn ?? ""} onChange={set("has_vpn")}>
                <option value="">Select…</option>
                <option>Paid VPN</option>
                <option>Free VPN</option>
                <option>No</option>
              </Select>
            </Field>
            <Field label="LinkedIn profile">
              <Input type="url" value={form.linkedin_url ?? ""} onChange={set("linkedin_url")} placeholder="https://linkedin.com/in/…" />
            </Field>
            <Field label="Upwork profile">
              <Input type="url" value={form.upwork_url ?? ""} onChange={set("upwork_url")} />
            </Field>
            <Field label="CV / Resume" required hint="PDF, DOCX or TXT, max 10 MB" className="sm:col-span-2">
              <Input type="file" required accept=".pdf,.docx,.txt" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Qualification & competency (QCA)" description="Enter years of experience in each area (0 if none)" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {data.qca_fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input
                  type={f.type === "number" ? "number" : "text"}
                  min={f.type === "number" ? 0 : undefined}
                  max={f.key.endsWith("_pct") ? 100 : undefined}
                  step={f.type === "number" ? "0.5" : undefined}
                  value={qca[f.key] ?? ""}
                  onChange={(e) => setQca({ ...qca, [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="A few questions about you" description="Short, honest answers with real examples work best" />
          <div className="space-y-4 p-5">
            {data.trait_questions.map((q) => (
              <Field key={q.key} label={q.question} required>
                <Textarea
                  required
                  rows={3}
                  minLength={30}
                  value={traits[q.key] ?? ""}
                  onChange={(e) => setTraits({ ...traits, [q.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Card>

        <ErrorNote message={submitError} />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">By applying you agree that your data is stored by Paragon Global Internships for recruitment.</p>
          <Button type="submit" loading={submitting}>
            Submit application
          </Button>
        </div>
      </form>
    </PublicShell>
  );
}
