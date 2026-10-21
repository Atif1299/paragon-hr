"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Button, Card, CardHeader, ErrorNote, Field, Input, LoadingBlock, PageHeader, Textarea } from "@/components/ui";

interface SettingsValues {
  screening_threshold: number;
  keyword_weight: number;
  preselection_pass_pct: number;
  preselection_borderline_pct: number;
  core_trait_min: number;
  referral_threshold: number;
  auto_invite_on_pass: boolean;
  auto_referral: boolean;
  default_recruiter_name: string;
  business_areas: string[];
  tools: string[];
}

interface SettingsResponse {
  values: SettingsValues;
  integrations: {
    claude: { enabled: boolean; model: string };
    google: {
      enabled: boolean;
      credentials_found: boolean;
      service_account_email: string;
      spreadsheet_url: string;
      drive_folder_url: string;
      calendar_configured: boolean;
      last_sync_at: string | null;
      last_error: string;
    };
    email: { smtp_enabled: boolean; from: string };
    webhook: { enabled: boolean; path: string };
    public_app_url: string;
  };
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm ${ok ? "text-emerald-700" : "text-slate-500"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {label}
    </span>
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { data, error, loading, reload } = useApi<SettingsResponse>("/api/settings");
  const [values, setValues] = useState<SettingsValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data) setValues(data.values);
  }, [data]);

  if (loading && !data) return <LoadingBlock />;
  if (!data || !values) return <ErrorNote message={error} />;
  const g = data.integrations.google;

  const num = (k: keyof SettingsValues) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: Number(e.target.value) });

  async function save() {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await api("/api/settings", { method: "PUT", json: values });
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1600);
      reload(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    await api("/api/settings/sync", { method: "POST" });
    setTimeout(() => {
      reload(true);
      setSyncing(false);
    }, 4000);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Scoring thresholds, automation behaviour and integrations."
        action={
          isAdmin && (
            <Button onClick={save} loading={saving} variant={saved ? "success" : "primary"}>
              {saved ? "Saved" : "Save settings"}
            </Button>
          )
        }
      />
      {saveError && (
        <div className="mb-4">
          <ErrorNote message={saveError} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Screening" description="Keyword/skill-match scoring against job requirements" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Right Fit threshold (%)" hint="Combined score needed to pass screening">
              <Input type="number" min="0" max="100" disabled={!isAdmin} value={values.screening_threshold} onChange={num("screening_threshold")} />
            </Field>
            <Field label="Keyword weight (0–1)" hint="Rest of the score comes from Claude's skill match">
              <Input type="number" min="0" max="1" step="0.05" disabled={!isAdmin} value={values.keyword_weight} onChange={num("keyword_weight")} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pre-selection scorecard" description="Weighted scorecard → pass / borderline / fail (15 criteria, 0 / 0.5 / 1)" />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Pass (%)">
              <Input type="number" min="0" max="100" disabled={!isAdmin} value={values.preselection_pass_pct} onChange={num("preselection_pass_pct")} />
            </Field>
            <Field label="Borderline from (%)" hint="Below this → fail">
              <Input
                type="number"
                min="0"
                max="100"
                disabled={!isAdmin}
                value={values.preselection_borderline_pct}
                onChange={num("preselection_borderline_pct")}
              />
            </Field>
            <Field label="Core traits min (/3)" hint="Honesty + integrity + trust">
              <Input type="number" min="0" max="3" step="0.5" disabled={!isAdmin} value={values.core_trait_min} onChange={num("core_trait_min")} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Automation" />
          <div className="space-y-4 p-5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={values.auto_invite_on_pass}
                onChange={(e) => setValues({ ...values, auto_invite_on_pass: e.target.checked })}
              />
              Automatically send an interview booking link when a candidate passes pre-selection
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={values.auto_referral}
                onChange={(e) => setValues({ ...values, auto_referral: e.target.checked })}
              />
              Automatically route non-fit candidates to a better-matching open role (otherwise suggest only)
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Referral fit threshold (%)">
                <Input type="number" min="0" max="100" disabled={!isAdmin} value={values.referral_threshold} onChange={num("referral_threshold")} />
              </Field>
              <Field label="Default recruiter name">
                <Input
                  disabled={!isAdmin}
                  value={values.default_recruiter_name}
                  onChange={(e) => setValues({ ...values, default_recruiter_name: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Onboarding report mapping" description="Projects from demo sessions are mapped to these (one per line)" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Business areas">
              <Textarea
                rows={8}
                disabled={!isAdmin}
                value={values.business_areas.join("\n")}
                onChange={(e) => setValues({ ...values, business_areas: e.target.value.split("\n").filter((x) => x.trim()) })}
              />
            </Field>
            <Field label="Company tools">
              <Textarea
                rows={8}
                disabled={!isAdmin}
                value={values.tools.join("\n")}
                onChange={(e) => setValues({ ...values, tools: e.target.value.split("\n").filter((x) => x.trim()) })}
              />
            </Field>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Integrations"
            description="Configured through environment variables on the server"
            action={
              isAdmin && g.enabled && (
                <Button size="sm" variant="secondary" onClick={syncNow} loading={syncing}>
                  <RefreshCw className="h-3.5 w-3.5" /> Sync Google now
                </Button>
              )
            }
          />
          <div className="grid gap-6 p-5 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Claude</p>
              <Status ok={data.integrations.claude.enabled} label={data.integrations.claude.enabled ? "API key configured" : "No API key"} />
              <p className="text-xs text-slate-500">Model: {data.integrations.claude.model}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Google Workspace</p>
              <Status ok={g.enabled && g.credentials_found} label={g.enabled ? (g.credentials_found ? "Sync enabled" : "Credentials missing") : "Sync disabled"} />
              {g.service_account_email && <p className="break-all text-xs text-slate-500">{g.service_account_email}</p>}
              {g.spreadsheet_url && (
                <a href={g.spreadsheet_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  Master Recruitment Sheet <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {g.drive_folder_url && (
                <a href={g.drive_folder_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  Candidate folders <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <Status ok={g.calendar_configured} label={g.calendar_configured ? "Calendar connected" : "No calendar"} />
              {g.last_sync_at && <p className="text-xs text-slate-500">Last sync {formatDateTime(g.last_sync_at)}</p>}
              {g.last_error && <p className="text-xs text-rose-600">{g.last_error}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <Status ok={data.integrations.email.smtp_enabled} label={data.integrations.email.smtp_enabled ? "SMTP sending" : "Log only (outbox)"} />
              {data.integrations.email.from && <p className="text-xs text-slate-500">From {data.integrations.email.from}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Intake webhook</p>
              <Status ok={data.integrations.webhook.enabled} label={data.integrations.webhook.enabled ? "Enabled" : "Disabled"} />
              <code className="block break-all rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                POST {data.integrations.public_app_url}
                {data.integrations.webhook.path}
              </code>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
