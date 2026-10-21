"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRightLeft, Plus, Search } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, pct } from "@/lib/format";
import type { CandidateSummary, Job, Meta } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { OutcomeBadge, PipelineBadge, ProcessingBadge, VettingBadge } from "@/components/status";

export default function CandidatesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { canEdit } = useAuth();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [adding, setAdding] = useState(false);

  const query = new URLSearchParams();
  for (const key of ["q", "job_id", "status", "vetting"]) {
    const v = params.get(key);
    if (v) query.set(key, v);
  }
  const { data, error, loading, reload } = useApi<CandidateSummary[]>(`/api/candidates?${query}`, {
    pollMs: 4000,
    poll: (rows) => rows.some((r) => r.processing_state === "queued" || r.processing_state === "running"),
  });
  const { data: jobs } = useApi<Job[]>("/api/jobs");
  const { data: meta } = useApi<Meta>("/api/candidates/meta");

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/candidates?${next}`);
  }

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Master Recruitment Sheet – every applicant, their screening and their pipeline status."
        action={
          canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add candidate
            </Button>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <form
            className="relative md:col-span-1"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter("q", q);
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <Select value={params.get("job_id") ?? ""} onChange={(e) => setFilter("job_id", e.target.value)}>
            <option value="">All roles</option>
            {jobs?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
          <Select value={params.get("status") ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All pipeline stages</option>
            {meta?.pipeline_statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={params.get("vetting") ?? ""} onChange={(e) => setFilter("vetting", e.target.value)}>
            <option value="">All vetting statuses</option>
            {meta?.vetting_statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <ErrorNote message={error} />

      <Card className="overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState
            title="No candidates found"
            description="Applications submitted through the public application form appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Screening</th>
                  <th className="px-4 py-3">Vetting</th>
                  <th className="px-4 py-3">Scorecard</th>
                  <th className="px-4 py-3">Pipeline</th>
                  <th className="px-4 py-3">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/candidates/${c.id}`)}>
                    <td className="px-4 py-3">
                      <Link href={`/candidates/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.full_name}
                      </Link>
                      <p className="text-xs text-slate-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {c.referred && <ArrowRightLeft className="h-3.5 w-3.5 text-orange-500" aria-label="Referred" />}
                        {c.job_title}
                      </div>
                      <p className="text-xs text-slate-400">{c.source_platform || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{pct(c.screening_score)}</td>
                    <td className="px-4 py-3">
                      <VettingBadge status={c.vetting_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">{pct(c.latest_score_pct)}</span>
                        <OutcomeBadge outcome={c.latest_outcome} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PipelineBadge status={c.pipeline_status} />
                        <ProcessingBadge state={c.processing_state} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddCandidateModal
        open={adding}
        jobs={jobs ?? []}
        onClose={() => setAdding(false)}
        onCreated={(id) => {
          setAdding(false);
          reload();
          router.push(`/candidates/${id}`);
        }}
      />
    </>
  );
}

function AddCandidateModal({
  open,
  jobs,
  onClose,
  onCreated,
}: {
  open: boolean;
  jobs: Job[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState({
    job_id: "",
    full_name: "",
    email: "",
    phone: "",
    source_platform: "LinkedIn",
    profile_url: "",
    experience_years: "",
    previous_employment: "",
    cv_text: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.set("job_id", form.job_id);
    const { job_id: _job, ...payload } = form;
    void _job;
    fd.set("payload", JSON.stringify(payload));
    if (file) fd.set("cv", file);
    try {
      const res = await api<{ id: number }>("/api/candidates", { method: "POST", body: fd });
      onCreated(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add candidate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add candidate manually" wide>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">
          For candidates sourced directly (LinkedIn, referrals). Screening and pre-selection run automatically after saving.
        </p>
        <ErrorNote message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Position" required>
            <Select required value={form.job_id} onChange={set("job_id")}>
              <option value="">Select a role</option>
              {jobs.filter((j) => j.is_open).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source platform">
            <Select value={form.source_platform} onChange={set("source_platform")}>
              {["LinkedIn", "Indeed", "Upwork", "Rozee.pk", "Referral", "Facebook", "Website", "Other"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Full name" required>
            <Input required value={form.full_name} onChange={set("full_name")} />
          </Field>
          <Field label="Email" required>
            <Input type="email" required value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Phone / WhatsApp">
            <Input value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Total experience (years)">
            <Input type="number" step="0.5" min="0" value={form.experience_years} onChange={set("experience_years")} />
          </Field>
          <Field label="Profile URL" className="sm:col-span-2">
            <Input value={form.profile_url} onChange={set("profile_url")} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="Previous employment [Designation | Company]" className="sm:col-span-2">
            <Input value={form.previous_employment} onChange={set("previous_employment")} />
          </Field>
          <Field label="CV file (PDF, DOCX, TXT)" className="sm:col-span-2">
            <Input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          {!file && (
            <Field label="…or paste CV / profile text" className="sm:col-span-2">
              <Textarea rows={5} value={form.cv_text} onChange={set("cv_text")} />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save & screen
          </Button>
        </div>
      </form>
    </Modal>
  );
}
