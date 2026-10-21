"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarPlus,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  MessageSquareText,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, pct } from "@/lib/format";
import type { CandidateDetail, Meta } from "@/lib/types";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, LoadingBlock, ScoreBar, Tabs, stickyBar } from "@/components/ui";
import { OutcomeBadge, PipelineBadge, ProcessingBadge, VettingBadge } from "@/components/status";
import {
  EditCandidateModal,
  InterviewAnalysis,
  ManualScorecardModal,
  ProjectReport,
  ScorecardView,
  TranscriptUpload,
} from "@/components/candidate-panels";

type Tab = "overview" | "screening" | "scorecards" | "selection" | "onboarding" | "activity";

const QCA_LABELS: Record<string, string> = {
  total_years_experience: "Total Years of Experience",
  sales_training_years: "Sales Training Experience (Years)",
  accounts_years: "Accounts (Years)",
  digital_marketing_years: "Digital Marketing (Years)",
  ai_years: "Artificial Intelligence (AI) Years",
  recruitment_training_years: "Recruitment Training Experience (Years)",
  project_management_years: "Project Management (Years)",
  team_management_years: "Team Management Experience (Years)",
  checklists_scorecards: "Experience with Checklists & Scorecards",
  excel_reporting_pct: "Excel / Reporting Skills (%)",
  communication_presentation_pct: "Communication & Presentation Skills (%)",
};

const TRAIT_LABELS: Record<string, string> = {
  mistake: "A mistake at work and how they handled it",
  improvement: "Improving a process or result without being asked",
  adaptability: "Motivation and handling changing priorities",
  teamwork: "Helping a teammate succeed",
};

function isBusy(c: CandidateDetail) {
  return (
    c.processing_state === "queued" ||
    c.processing_state === "running" ||
    c.transcripts.some((t) => t.status === "queued" || t.status === "running") ||
    c.questionnaires.some((q) => q.status === "submitted")
  );
}

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const { canEdit, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const { data: c, error, loading, reload } = useApi<CandidateDetail>(`/api/candidates/${id}`, {
    pollMs: 3000,
    poll: isBusy,
  });
  const { data: meta } = useApi<Meta>("/api/candidates/meta");

  if (loading && !c) return <LoadingBlock />;
  if (!c) return <ErrorNote message={error} />;
  const criteria = meta?.criteria ?? {};

  async function action(key: string, path: string, body?: unknown, success?: string) {
    setBusy(key);
    setActionError("");
    setNotice("");
    try {
      const res = await api<{ link?: string; rerouted?: boolean; job_title?: string }>(path, { method: "POST", json: body ?? {} });
      if (res?.link) {
        await navigator.clipboard?.writeText(res.link).catch(() => undefined);
        setNotice(`${success ?? "Done"} – link copied to clipboard: ${res.link}`);
      } else if (res?.rerouted) {
        setNotice(`Candidate referred to ${res.job_title}. Re-screening for the new role…`);
      } else if (success) {
        setNotice(success);
      }
      await reload(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!confirm(`Delete ${c!.full_name}? This cannot be undone.`)) return;
    await api(`/api/candidates/${c!.id}`, { method: "DELETE" });
    window.location.href = "/candidates";
  }

  const interviewTranscripts = c.transcripts.filter((t) => t.kind === "interview");
  const demoTranscripts = c.transcripts.filter((t) => t.kind === "demo");
  const latestCard = c.scorecards[c.scorecards.length - 1];

  return (
    <>
      <div className={stickyBar}>
        <Link href="/candidates" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Candidates
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{c.full_name}</h1>
              <PipelineBadge status={c.pipeline_status} />
              <VettingBadge status={c.vetting_status} />
              <ProcessingBadge state={c.processing_state} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {c.job_title}
              {c.referred_from_job && (
                <span className="ml-2 inline-flex items-center gap-1 text-orange-600">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> referred from {c.referred_from_job}
                </span>
              )}
              {" · "}
              {c.email}
              {c.phone && ` · ${c.phone}`} · Applied {formatDate(c.created_at)}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Update
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={busy === "reprocess"}
                onClick={() => action("reprocess", `/api/candidates/${c.id}/reprocess`, undefined, "Re-screening started")}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-run screening
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={remove}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {(c.processing_state === "queued" || c.processing_state === "running") && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <RefreshCw className="h-4 w-4 animate-spin" /> Running screening and pre-selection with Claude…
          </div>
        )}
        {c.processing_error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {c.processing_error}
          </div>
        )}
        {c.sync_error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Google sync: {c.sync_error}
          </div>
        )}
        <ErrorNote message={actionError} />
        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span className="break-all">{notice}</span>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Screening match</p>
          <p className="mt-1 text-2xl font-semibold">{pct(c.screening_score)}</p>
          <ScoreBar value={c.screening_score} tone={c.vetting_status === "Right Fit" ? "green" : c.vetting_status ? "red" : undefined} />
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest scorecard</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {latestCard ? `${latestCard.total}/15` : "—"} <OutcomeBadge outcome={latestCard?.outcome} />
          </p>
          <ScoreBar value={latestCard?.percentage} />
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Interview</p>
          <p className="mt-1 text-sm text-slate-700">
            {c.events.find((e) => e.kind === "interview")
              ? formatDateTime(c.events.find((e) => e.kind === "interview")!.starts_at)
              : "Not scheduled"}
          </p>
          {c.interview_link && (
            <a href={c.interview_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
              Meeting link <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Candidate folder</p>
          <div className="mt-1 space-y-1 text-sm">
            {c.drive_folder_url ? (
              <a href={c.drive_folder_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                <FolderOpen className="h-4 w-4" /> Shared Drive folder
              </a>
            ) : (
              <p className="text-slate-400">Not synced to Drive</p>
            )}
            {c.has_cv_file && (
              <a href={`/api/candidates/${c.id}/cv`} className="flex items-center gap-1 text-brand-600 hover:underline">
                <Download className="h-4 w-4" /> {c.cv_filename || "Download CV"}
              </a>
            )}
          </div>
        </Card>
      </div>

      {canEdit && (
        <Card className="mb-6 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "invite-interview"}
              onClick={() => action("invite-interview", `/api/candidates/${c.id}/invite`, { kind: "interview" }, "Interview booking link sent")}
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Send interview booking link
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "questionnaire"}
              onClick={() => action("questionnaire", `/api/candidates/${c.id}/questionnaire`, undefined, "Questionnaire sent")}
            >
              <MessageSquareText className="h-3.5 w-3.5" /> Send supplementary questionnaire
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setScoring(true)}>
              <Pencil className="h-3.5 w-3.5" /> Manual scorecard
            </Button>
            <span className="mx-1 hidden w-px bg-slate-200 sm:block" />
            <Button
              size="sm"
              variant="success"
              loading={busy === "select"}
              onClick={() => action("select", `/api/candidates/${c.id}/decision`, { decision: "select" }, "Candidate selected")}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Select
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "refer"}
              onClick={() => action("refer", `/api/candidates/${c.id}/decision`, { decision: "refer" }, "No better-fitting open role found")}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Refer to another role
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={busy === "reject"}
              onClick={() => action("reject", `/api/candidates/${c.id}/decision`, { decision: "reject" }, "Candidate processed as not a fit")}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Not a fit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "invite-onboarding"}
              onClick={() =>
                action("invite-onboarding", `/api/candidates/${c.id}/invite`, { kind: "onboarding" }, "Assignment interview booking link sent")
              }
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Send assignment-interview link
            </Button>
          </div>
        </Card>
      )}

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "screening", label: "Screening" },
          { key: "scorecards", label: "Scorecards", count: c.scorecards.length },
          { key: "selection", label: "Selection", count: interviewTranscripts.length + c.events.length },
          { key: "onboarding", label: "Onboarding report", count: demoTranscripts.length },
          { key: "activity", label: "Activity" },
        ]}
      />

      <div className="mt-6 space-y-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Master Recruitment Sheet" description="Fields synced to the company Google Sheet" />
              <dl className="divide-y divide-slate-100 text-sm">
                {[
                  ["Position applied for", c.job_title],
                  ["Previous employment", c.previous_employment],
                  ["Current employment status", c.employment_status],
                  ["Experience", c.experience_years !== null ? `${c.experience_years} years` : ""],
                  ["Notice period / availability", c.notice_period],
                  ["Source platform", c.source_platform],
                  ["Profile URL", c.profile_url],
                  ["LinkedIn", c.linkedin_url],
                  ["Upwork", c.upwork_url],
                  ["VPN", c.has_vpn],
                  ["Onboarding session", c.onboarding_link],
                  ["Recruiter", c.recruiter_name],
                  ["Interviewed / selected on", formatDate(c.interviewed_on)],
                  ["Trial", c.trial_start_date ? `${formatDate(c.trial_start_date)} → ${formatDate(c.trial_end_date)}` : ""],
                  ["Contracted on", formatDate(c.contracted_on)],
                  ["Notes / HR remarks", c.notes],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[180px_1fr] gap-3 px-5 py-2.5">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="break-words text-slate-900">
                      {value && value !== "—" && String(value).startsWith("http") ? (
                        <a href={String(value)} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                          {value}
                        </a>
                      ) : (
                        value || "—"
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="QCA form" description="Qualification & competency answers" />
                {Object.keys(c.qca).length === 0 ? (
                  <EmptyState title="No QCA answers" />
                ) : (
                  <dl className="divide-y divide-slate-100 text-sm">
                    {Object.entries(c.qca).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[1fr_120px] gap-3 px-5 py-2.5">
                        <dt className="text-slate-500">{QCA_LABELS[k] ?? k}</dt>
                        <dd className="text-right font-medium text-slate-900">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
              <Card>
                <CardHeader title="Application questions" description="Used for trait-based pre-selection scoring" />
                {Object.keys(c.trait_answers).length === 0 ? (
                  <EmptyState title="No answers" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {Object.entries(c.trait_answers).map(([k, v]) => (
                      <div key={k} className="px-5 py-3">
                        <p className="text-xs font-medium text-slate-500">{TRAIT_LABELS[k] ?? k}</p>
                        <p className="mt-1 text-sm text-slate-800">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "screening" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Keyword & skill match" description={`Against the ${c.job_title} requirements`} />
              <div className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    ["Keyword match", c.keyword_score],
                    ["Claude skill match", c.ai_skill_score],
                    ["Combined score", c.screening_score],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mb-1 text-lg font-semibold text-slate-900">{pct(value as number | null)}</p>
                      <ScoreBar value={value as number | null} />
                    </div>
                  ))}
                </div>
                {c.screening_summary && <p className="text-sm text-slate-700">{c.screening_summary}</p>}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Matched keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.matched_keywords.length ? c.matched_keywords.map((k) => <Badge key={k} tone="green">{k}</Badge>) : <span className="text-sm text-slate-400">None</span>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Missing keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.missing_keywords.length ? c.missing_keywords.map((k) => <Badge key={k} tone="red">{k}</Badge>) : <span className="text-sm text-slate-400">None</span>}
                  </div>
                </div>
                {c.screening_details.matched_skills && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">Skills evidenced (Claude)</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {c.screening_details.matched_skills.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">Gaps (Claude)</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                        {c.screening_details.missing_skills?.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
                {!!c.screening_details.red_flags?.length && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Red flags</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                      {c.screening_details.red_flags.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {c.screening_details.relevant_years_experience !== undefined && (
                  <p className="text-sm text-slate-600">
                    Relevant experience: <b>{c.screening_details.relevant_years_experience} years</b> ·{" "}
                    {c.screening_details.meets_minimum_experience ? "meets" : "below"} the role minimum
                  </p>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="CV text" description={c.cv_filename || "Extracted text"} />
              <p className="prose-pre max-h-[600px] overflow-y-auto p-5 text-xs text-slate-600">{c.cv_text_preview || "No CV text."}</p>
            </Card>
          </div>
        )}

        {tab === "scorecards" && (
          <>
            {c.scorecards.length === 0 ? (
              <Card>
                <EmptyState
                  title="No scorecards yet"
                  description="Pre-selection scoring runs automatically for Right Fit candidates."
                  action={canEdit && <Button size="sm" onClick={() => setScoring(true)}>Score manually</Button>}
                />
              </Card>
            ) : (
              [...c.scorecards].reverse().map((card) => <ScorecardView key={card.id} card={card} criteria={criteria} />)
            )}
          </>
        )}

        {tab === "selection" && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Recruitment events" description="Interview and onboarding sessions" />
                {c.events.length === 0 ? (
                  <EmptyState title="Not booked on any event yet" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {c.events.map((e) => (
                      <li key={e.participant_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{e.title}</p>
                          <p className="text-xs text-slate-500">
                            {e.kind} · {formatDateTime(e.starts_at)}
                          </p>
                        </div>
                        <Badge tone={e.status === "attended" ? "green" : e.status === "no_show" ? "red" : "blue"}>{e.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <CardHeader title="Booking links" />
                {c.invites.length === 0 ? (
                  <EmptyState title="No booking links sent" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {c.invites.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div>
                          <p className="font-medium capitalize text-slate-900">{i.kind}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(i.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={i.status === "booked" ? "green" : i.status === "pending" ? "amber" : "slate"}>{i.status}</Badge>
                          <button
                            className="text-slate-400 hover:text-slate-700"
                            title="Copy link"
                            onClick={() => navigator.clipboard?.writeText(i.link)}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {c.questionnaires.map((q) => (
              <Card key={q.id}>
                <CardHeader
                  title="Supplementary questionnaire"
                  description={`Sent ${formatDateTime(q.created_at)}${q.submitted_at ? ` · submitted ${formatDateTime(q.submitted_at)}` : ""}`}
                  action={<Badge tone={q.status === "scored" ? "green" : q.status === "sent" ? "amber" : "blue"}>{q.status}</Badge>}
                />
                <div className="divide-y divide-slate-100">
                  {q.questions.map((x) => (
                    <div key={x.id} className="px-5 py-3">
                      <p className="text-xs font-medium text-slate-500">{x.criterion}</p>
                      <p className="text-sm font-medium text-slate-800">{x.question}</p>
                      <p className="mt-1 text-sm text-slate-600">{q.answers[x.id] || <span className="text-slate-400">Awaiting answer</span>}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            {c.referrals.length > 0 && (
              <Card>
                <CardHeader title="Referrals" description="Non-fit candidates matched against other open roles" />
                <ul className="divide-y divide-slate-100">
                  {c.referrals.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {r.from_job} → {r.to_job}
                        </p>
                        <p className="text-xs text-slate-500">
                          Fit {Math.round(r.fit_score)}% · {r.reason}
                        </p>
                      </div>
                      {r.status === "suggested" && canEdit ? (
                        <Button
                          size="sm"
                          loading={busy === `ref-${r.id}`}
                          onClick={() => action(`ref-${r.id}`, `/api/candidates/${c.id}/referrals/${r.id}/accept`, undefined, "Referral accepted")}
                        >
                          Route candidate
                        </Button>
                      ) : (
                        <Badge tone="orange">{r.status}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Post-interview analysis</h3>
              {canEdit && <TranscriptUpload candidateId={c.id} kind="interview" onUploaded={() => reload(true)} />}
            </div>
            {interviewTranscripts.length === 0 ? (
              <Card>
                <EmptyState title="No interview transcript yet" description="Upload the interview recording transcript for Claude to analyse." />
              </Card>
            ) : (
              [...interviewTranscripts].reverse().map((t) => (
                <InterviewAnalysis key={t.id} t={t} candidateId={c.id} onChange={() => reload(true)} />
              ))
            )}
          </>
        )}

        {tab === "onboarding" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Assignment interview (demo session): projects discussed are extracted, tagged and mapped to business & tool relevance.
              </p>
              {canEdit && <TranscriptUpload candidateId={c.id} kind="demo" onUploaded={() => reload(true)} />}
            </div>
            {demoTranscripts.length === 0 ? (
              <Card>
                <EmptyState title="No demo-session transcript yet" />
              </Card>
            ) : (
              [...demoTranscripts].reverse().map((t) => <ProjectReport key={t.id} t={t} candidateId={c.id} onChange={() => reload(true)} />)
            )}
          </>
        )}

        {tab === "activity" && (
          <Card>
            <CardHeader title="Activity timeline" />
            <ol className="relative space-y-0 p-5">
              {c.activities.map((a) => (
                <li key={a.id} className="relative border-l border-slate-200 pb-5 pl-5 last:pb-0">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
                  <p className="text-sm font-medium text-slate-900">{a.action}</p>
                  {a.detail && <p className="break-words text-sm text-slate-600">{a.detail}</p>}
                  <p className="text-xs text-slate-400">
                    {a.actor} · {formatDateTime(a.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>

      {editing && meta && (
        <EditCandidateModal
          open
          onClose={() => setEditing(false)}
          candidate={c}
          statuses={meta.pipeline_statuses}
          onSaved={() => reload(true)}
        />
      )}
      {scoring && meta && (
        <ManualScorecardModal
          open
          onClose={() => setScoring(false)}
          candidateId={c.id}
          criteria={criteria}
          initial={latestCard}
          onSaved={() => reload(true)}
        />
      )}
    </>
  );
}
