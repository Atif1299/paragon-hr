"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Job, Keyword } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, LoadingBlock, Modal, PageHeader, Textarea } from "@/components/ui";

export default function JobsPage() {
  const { canEdit } = useAuth();
  const { data, error, loading, reload } = useApi<Job[]>("/api/jobs");
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [copied, setCopied] = useState("");

  function copy(slug: string) {
    navigator.clipboard?.writeText(`${window.location.origin}/apply/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <>
      <PageHeader
        title="Open roles"
        description="Job requirements and screening keywords. Share each role's application link on LinkedIn and job boards."
        action={
          <>
            <a href="/careers" target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" /> Public careers page
              </Button>
            </a>
            {canEdit && (
              <Button onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> New role
              </Button>
            )}
          </>
        }
      />
      <ErrorNote message={error} />
      {loading && !data ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((job) => (
            <Card key={job.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{job.title}</h3>
                    <Badge tone={job.is_open ? "green" : "slate"}>{job.is_open ? "Open" : "Closed"}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {job.area} · min {job.min_years} yrs ·{" "}
                    <Link href={`/candidates?job_id=${job.id}`} className="text-brand-600 hover:underline">
                      {job.candidate_count} candidates
                    </Link>
                  </p>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(job)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {job.keywords.map((k) => (
                  <Badge key={k.term} tone="indigo">
                    {k.term}
                    {k.weight !== 1 && <span className="text-indigo-400">×{k.weight}</span>}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <code className="flex-1 truncate rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">/apply/{job.slug}</code>
                <Button variant="secondary" size="sm" onClick={() => copy(job.slug)} disabled={!job.is_open}>
                  <Copy className="h-3.5 w-3.5" /> {copied === job.slug ? "Copied" : "Copy link"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <JobModal
          job={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload(true);
          }}
        />
      )}
    </>
  );
}

function JobModal({ job, onClose, onSaved }: { job: Job | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: job?.title ?? "",
    area: job?.area ?? "",
    description: job?.description ?? "",
    min_years: job?.min_years ?? 0,
    is_open: job?.is_open ?? true,
  });
  const [keywords, setKeywords] = useState<Keyword[]>(job?.keywords ?? []);
  const [newTerm, setNewTerm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(job ? `/api/jobs/${job.id}` : "/api/jobs", {
        method: job ? "PUT" : "POST",
        json: { ...form, min_years: Number(form.min_years), keywords },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={job ? `Edit ${job.title}` : "New role"} wide>
      <form onSubmit={save} className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Area / department">
            <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </Field>
          <Field label="Minimum years of experience">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.min_years}
              onChange={(e) => setForm({ ...form, min_years: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_open} onChange={(e) => setForm({ ...form, is_open: e.target.checked })} />
            Open for applications (and eligible for referrals)
          </label>
        </div>
        <Field label="Job description">
          <Textarea rows={8} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Screening keywords & weights</p>
          <div className="space-y-2">
            {keywords.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={k.term}
                  onChange={(e) => setKeywords(keywords.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))}
                />
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  className="w-24"
                  value={k.weight}
                  onChange={(e) => setKeywords(keywords.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Add keyword" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (newTerm.trim()) setKeywords([...keywords, { term: newTerm.trim(), weight: 1 }]);
                  setNewTerm("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save role
          </Button>
        </div>
      </form>
    </Modal>
  );
}
