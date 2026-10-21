import { Badge, type BadgeTone } from "@/components/ui";

const PIPELINE_TONES: Record<string, BadgeTone> = {
  Applied: "slate",
  Screened: "blue",
  "Questionnaire Sent": "amber",
  "Pre-Selected (Benched)": "indigo",
  "Interview Invited": "purple",
  "Interview Scheduled": "purple",
  Interviewed: "blue",
  Selected: "green",
  "Onboarding Invited": "orange",
  "Onboarding Scheduled": "orange",
  "Assignment Interview Done": "green",
  "Trial (Manual)": "amber",
  "Contracted (Manual)": "green",
  "On Hold": "slate",
  Rejected: "red",
};

export function PipelineBadge({ status }: { status: string }) {
  return <Badge tone={PIPELINE_TONES[status] ?? "slate"}>{status || "—"}</Badge>;
}

export function VettingBadge({ status }: { status: string }) {
  if (!status) return <span className="text-xs text-slate-400">Pending</span>;
  return <Badge tone={status === "Right Fit" ? "green" : "red"}>{status}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome?: string | null }) {
  if (!outcome) return <span className="text-xs text-slate-400">—</span>;
  const tone: BadgeTone = outcome === "pass" ? "green" : outcome === "borderline" ? "amber" : "red";
  return <Badge tone={tone}>{outcome.charAt(0).toUpperCase() + outcome.slice(1)}</Badge>;
}

export function ProcessingBadge({ state }: { state: string }) {
  if (state === "done") return null;
  const tone: BadgeTone = state === "error" ? "red" : "blue";
  const label = state === "error" ? "Error" : state === "running" ? "Processing…" : "Queued";
  return <Badge tone={tone}>{label}</Badge>;
}
