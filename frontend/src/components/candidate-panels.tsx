"use client";

import { useState } from "react";
import { ExternalLink, FileText, Sparkles, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { SCORECARD_SECTIONS, type CandidateDetail, type Scorecard, type Transcript } from "@/lib/types";
import { Badge, Button, Card, CardHeader, ErrorNote, Field, Input, Modal, Select, Spinner, Textarea, cn } from "@/components/ui";
import { OutcomeBadge } from "@/components/status";

const STAGE_LABEL: Record<string, string> = {
  pre_selection: "Pre-selection",
  questionnaire: "After questionnaire",
  interview: "Post-interview",
  manual: "Manual (HR)",
};

function scoreTone(v: number | undefined) {
  if (v === 1) return "bg-emerald-100 text-emerald-800";
  if (v === 0.5) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

export function ScorecardView({ card, criteria }: { card: Scorecard; criteria: Record<string, string> }) {
  const totals: Record<string, number> = {
    norms: card.norms_total,
    attitude: card.attitude_total,
    competency: card.competency_total,
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {STAGE_LABEL[card.stage] ?? card.stage} scorecard <OutcomeBadge outcome={card.outcome} />
          </span>
        }
        description={`Scored by ${card.scored_by} · ${formatDateTime(card.created_at)}`}
        action={
          <div className="text-right">
            <p className="text-xl font-semibold text-slate-900">
              {card.total}
              <span className="text-sm font-normal text-slate-400">/15</span>
            </p>
            <p className="text-xs text-slate-500">{card.percentage}%</p>
          </div>
        }
      />
      {card.summary && <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">{card.summary}</p>}
      <div className="grid gap-px bg-slate-100 md:grid-cols-3">
        {SCORECARD_SECTIONS.map((section) => (
          <div key={section.key} className="bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
              <span className="text-sm font-semibold text-slate-900">{totals[section.key]}/5</span>
            </div>
            <ul className="space-y-2.5">
              {section.criteria.map((key) => (
                <li key={key}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700">{criteria[key] ?? key}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", scoreTone(card.scores[key]))}>
                      {card.scores[key] ?? 0}
                    </span>
                  </div>
                  {card.rationale[key] && <p className="mt-0.5 text-xs text-slate-400">{card.rationale[key]}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ManualScorecardModal({
  open,
  onClose,
  candidateId,
  criteria,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  candidateId: number;
  criteria: Record<string, string>;
  initial?: Scorecard;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.keys(criteria).map((k) => [k, initial?.scores[k] ?? 0])),
  );
  const [stage, setStage] = useState("manual");
  const [summary, setSummary] = useState("");
  const [apply, setApply] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api(`/api/candidates/${candidateId}/scorecards`, {
        method: "POST",
        json: { stage, scores, summary, apply_outcome: apply },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manual scorecard (HR)" wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Score each criterion 0, 0.5 or 1 – the same Recruitment Evaluation Scorecard Claude uses. Use this to validate the
          automated scoring against your manual assessment.
        </p>
        <ErrorNote message={error} />
        <div className="grid gap-4 md:grid-cols-3">
          {SCORECARD_SECTIONS.map((section) => (
            <div key={section.key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
              <div className="space-y-2">
                {section.criteria.map((key) => (
                  <div key={key}>
                    <p className="mb-1 text-xs text-slate-700">{criteria[key]}</p>
                    <div className="flex gap-1">
                      {[0, 0.5, 1].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setScores({ ...scores, [key]: v })}
                          className={cn(
                            "flex-1 rounded-md border px-2 py-1 text-xs font-medium",
                            scores[key] === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="manual">Manual validation</option>
              <option value="pre_selection">Pre-selection</option>
              <option value="interview">Post-interview</option>
            </Select>
          </Field>
          <div className="flex items-end justify-end">
            <p className="text-lg font-semibold text-slate-900">
              Total: {total}/15 <span className="text-sm font-normal text-slate-500">({Math.round((total / 15) * 100)}%)</span>
            </p>
          </div>
        </div>
        <Field label="Comments">
          <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="rounded" />
          Apply outcome to the pipeline (pass → interview invite, borderline → questionnaire, fail → referral/reject)
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save scorecard
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TranscriptUpload({
  candidateId,
  kind,
  onUploaded,
}: {
  candidateId: number;
  kind: "interview" | "demo";
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const label = kind === "interview" ? "interview transcript" : "demo-session transcript";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("text", text);
    fd.set("recording_url", url);
    if (file) fd.set("file", file);
    try {
      await api(`/api/candidates/${candidateId}/transcripts`, { method: "POST", body: fd });
      setOpen(false);
      setText("");
      setUrl("");
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" /> Add {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Add ${label}`} wide>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">
            {kind === "interview"
              ? "Claude re-scores the full scorecard from the interview and recommends select, reject or refer."
              : "Claude extracts every project discussed, tags it, and maps it to the company's business areas and tools."}
          </p>
          <ErrorNote message={error} />
          <Field label="Recording link (optional)">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Zoom / Google Meet / Drive recording URL" />
          </Field>
          <Field label="Transcript file" hint="TXT, VTT, SRT, MD, DOCX or PDF – e.g. Zoom/Meet/Fireflies export">
            <Input type="file" accept=".txt,.vtt,.srt,.md,.docx,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          {!file && (
            <Field label="…or paste the transcript">
              <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              <Sparkles className="h-4 w-4" /> Analyse with Claude
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function TranscriptStatus({ t, candidateId, onRetry }: { t: Transcript; candidateId: number; onRetry: () => void }) {
  if (t.status === "done") return null;
  if (t.status === "error")
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <span>Analysis failed: {t.error}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await api(`/api/candidates/${candidateId}/transcripts/${t.id}/retry`, { method: "POST" });
            onRetry();
          }}
        >
          Retry
        </Button>
      </div>
    );
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <Spinner className="h-4 w-4" /> Claude is analysing the transcript…
    </div>
  );
}

const REC_TONE = { select: "green", reject: "red", refer_other_role: "orange", follow_up: "amber" } as const;

export function InterviewAnalysis({ t, candidateId, onChange }: { t: Transcript; candidateId: number; onChange: () => void }) {
  const a = t.analysis;
  return (
    <Card>
      <CardHeader
        title="Interview analysis"
        description={`Added by ${t.created_by} · ${formatDateTime(t.created_at)}`}
        action={
          t.recording_url && (
            <a href={t.recording_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Recording <ExternalLink className="h-3 w-3" />
            </a>
          )
        }
      />
      <div className="space-y-4 p-5">
        <TranscriptStatus t={t} candidateId={candidateId} onRetry={onChange} />
        {t.status === "done" && (
          <>
            {a.recommendation && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Claude recommends:</span>
                <Badge tone={REC_TONE[a.recommendation as keyof typeof REC_TONE] ?? "slate"}>
                  {a.recommendation.replaceAll("_", " ")}
                </Badge>
                <span className="text-sm text-slate-500">{a.recommendation_rationale}</span>
              </div>
            )}
            {a.summary && <p className="text-sm text-slate-700">{a.summary}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">Strengths</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {a.strengths?.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">Concerns</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {a.concerns?.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </div>
          </>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Transcript excerpt</summary>
          <p className="prose-pre mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{t.text_preview}</p>
        </details>
      </div>
    </Card>
  );
}

const RELEVANCE_TONE = { high: "green", medium: "amber", low: "slate" } as const;

export function ProjectReport({ t, candidateId, onChange }: { t: Transcript; candidateId: number; onChange: () => void }) {
  const a = t.analysis;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-600" /> Onboarding project report
          </span>
        }
        description={`Demo session · added by ${t.created_by} · ${formatDateTime(t.created_at)}`}
        action={
          <div className="flex gap-3">
            {t.report_drive_url && (
              <a href={t.report_drive_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                Google Doc <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {t.recording_url && (
              <a href={t.recording_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                Recording <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        }
      />
      <div className="space-y-5 p-5">
        <TranscriptStatus t={t} candidateId={candidateId} onRetry={onChange} />
        {t.status === "done" && (
          <>
            {a.summary && <p className="text-sm text-slate-700">{a.summary}</p>}
            <div className="space-y-3">
              {a.projects?.map((p, i) => (
                <div key={`${p.name}-${i}`} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{p.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={RELEVANCE_TONE[p.relevance] ?? "slate"}>{p.relevance} relevance</Badge>
                      <span className="text-sm font-semibold text-slate-900">{p.relevance_score}/100</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-xs font-medium text-slate-500">Candidate&apos;s role: </span>
                      {p.candidate_role || "—"}
                    </p>
                    <p>
                      <span className="text-xs font-medium text-slate-500">Outcomes: </span>
                      {p.outcomes || "—"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.business_areas.map((x) => (
                      <Badge key={`a-${x}`} tone="indigo">
                        {x}
                      </Badge>
                    ))}
                    {p.company_tools.map((x) => (
                      <Badge key={`t-${x}`} tone="blue">
                        {x}
                      </Badge>
                    ))}
                    {p.tags.map((x) => (
                      <Badge key={`g-${x}`}>#{x}</Badge>
                    ))}
                  </div>
                  {p.tools_mentioned.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500">Tools mentioned: {p.tools_mentioned.join(", ")}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">{p.relevance_rationale}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">Key strengths</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {a.key_strengths?.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">Gaps</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {a.gaps?.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export function EditCandidateModal({
  open,
  onClose,
  candidate,
  statuses,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  candidate: CandidateDetail;
  statuses: string[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    pipeline_status: candidate.pipeline_status,
    vetting_status: candidate.vetting_status,
    phone: candidate.phone,
    notice_period: candidate.notice_period,
    interview_link: candidate.interview_link,
    onboarding_link: candidate.onboarding_link,
    recruiter_name: candidate.recruiter_name,
    notes: candidate.notes,
    interviewed_on: candidate.interviewed_on ?? "",
    trial_start_date: candidate.trial_start_date ?? "",
    trial_end_date: candidate.trial_end_date ?? "",
    contracted_on: candidate.contracted_on ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, k.endsWith("_on") || k.endsWith("_date") ? v || null : v]),
    );
    try {
      await api(`/api/candidates/${candidate.id}`, { method: "PATCH", json: body });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update candidate" wide>
      <form onSubmit={save} className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pipeline status" hint="Trial and Contract stages are managed manually">
            <Select value={form.pipeline_status} onChange={set("pipeline_status")}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Vetting status">
            <Select value={form.vetting_status} onChange={set("vetting_status")}>
              <option value="">Pending</option>
              <option>Right Fit</option>
              <option>Not a Fit</option>
            </Select>
          </Field>
          <Field label="Phone / WhatsApp">
            <Input value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Notice period / availability">
            <Input value={form.notice_period} onChange={set("notice_period")} />
          </Field>
          <Field label="Interview session link">
            <Input value={form.interview_link} onChange={set("interview_link")} />
          </Field>
          <Field label="Onboarding session link">
            <Input value={form.onboarding_link} onChange={set("onboarding_link")} />
          </Field>
          <Field label="Recruiter name">
            <Input value={form.recruiter_name} onChange={set("recruiter_name")} />
          </Field>
          <Field label="Interviewed / selected on">
            <Input type="date" value={form.interviewed_on} onChange={set("interviewed_on")} />
          </Field>
          <Field label="Trial start date (office use)">
            <Input type="date" value={form.trial_start_date} onChange={set("trial_start_date")} />
          </Field>
          <Field label="Trial end date (office use)">
            <Input type="date" value={form.trial_end_date} onChange={set("trial_end_date")} />
          </Field>
          <Field label="Contracted on (office use)">
            <Input type="date" value={form.contracted_on} onChange={set("contracted_on")} />
          </Field>
        </div>
        <Field label="Notes / HR remarks">
          <Textarea rows={3} value={form.notes} onChange={set("notes")} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
