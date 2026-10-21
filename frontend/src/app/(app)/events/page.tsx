"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ExternalLink, Plus, UserPlus, Users } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { CandidateSummary, Job, RecruitmentEvent } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import { PipelineBadge } from "@/components/status";

const ATTENDANCE = ["booked", "attended", "no_show", "cancelled"];

export default function EventsPage() {
  const { canEdit } = useAuth();
  const [kind, setKind] = useState<"interview" | "onboarding">("interview");
  const { data, error, loading, reload } = useApi<RecruitmentEvent[]>(`/api/events?kind=${kind}`);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<RecruitmentEvent | null>(null);
  const [actionError, setActionError] = useState("");

  async function updateParticipant(eventId: number, pid: number, body: Record<string, string>) {
    setActionError("");
    try {
      await api(`/api/events/${eventId}/participants/${pid}`, { method: "PATCH", json: body });
      reload(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function setStatus(event: RecruitmentEvent, status: string) {
    setActionError("");
    try {
      await api(`/api/events/${event.id}`, { method: "PATCH", json: { status } });
      reload(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Recruitment events"
        description="Recruitment Event log – interview sessions (6 candidates each) and onboarding assignment interviews. Shortlisted candidates book these slots from their email link."
        action={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New session
            </Button>
          )
        }
      />
      <Tabs
        active={kind}
        onChange={setKind}
        tabs={[
          { key: "interview", label: "Interview sessions" },
          { key: "onboarding", label: "Assignment interviews" },
        ]}
      />
      <div className="mt-6 space-y-4">
        <ErrorNote message={error || actionError} />
        {loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <Card>
            <EmptyState
              title="No sessions yet"
              description="Create a session with a date, meeting link and capacity. Pre-selected candidates will see it on their booking page."
            />
          </Card>
        ) : (
          data.map((e) => (
            <Card key={e.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-brand-600" />
                    {e.title}
                    <Badge tone={e.status === "scheduled" ? "blue" : e.status === "completed" ? "green" : "slate"}>{e.status}</Badge>
                  </span>
                }
                description={`${formatDateTime(e.starts_at)} · ${e.duration_minutes} min · ${e.job_title} · created by ${e.created_by}`}
                action={
                  <div className="flex items-center gap-2">
                    <Badge tone={e.seats_left === 0 ? "green" : "amber"}>
                      <Users className="h-3 w-3" /> {e.capacity - e.seats_left}/{e.capacity}
                    </Badge>
                    {e.meeting_link && (
                      <a href={e.meeting_link} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-800">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                }
              />
              {e.participants && e.participants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Sr.</th>
                        <th className="px-4 py-2">Full name</th>
                        <th className="px-4 py-2">Area</th>
                        <th className="px-4 py-2">Email / phone</th>
                        <th className="px-4 py-2">Pipeline</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {e.participants.map((p, i) => (
                        <tr key={p.id}>
                          <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-4 py-2">
                            <Link href={`/candidates/${p.candidate_id}`} className="font-medium text-slate-900 hover:text-brand-700">
                              {p.full_name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-slate-600">{p.job_title}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {p.email}
                            <p className="text-xs text-slate-400">{p.phone}</p>
                          </td>
                          <td className="px-4 py-2">
                            <PipelineBadge status={p.pipeline_status} />
                          </td>
                          <td className="px-4 py-2">
                            <Select
                              className="w-32 py-1 text-xs"
                              disabled={!canEdit}
                              value={p.status}
                              onChange={(ev) => updateParticipant(e.id, p.id, { status: ev.target.value })}
                            >
                              {ATTENDANCE.map((s) => (
                                <option key={s} value={s}>
                                  {s.replace("_", " ")}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              className="min-w-40 py-1 text-xs"
                              disabled={!canEdit}
                              defaultValue={p.note}
                              onBlur={(ev) => ev.target.value !== p.note && updateParticipant(e.id, p.id, { note: ev.target.value })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-4 text-sm text-slate-400">No candidates booked yet.</p>
              )}
              {canEdit && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
                  <Button size="sm" variant="secondary" onClick={() => setAdding(e)} disabled={e.seats_left === 0}>
                    <UserPlus className="h-3.5 w-3.5" /> Add candidate
                  </Button>
                  {e.status === "scheduled" && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setStatus(e, "completed")}>
                        Mark completed
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(e, "cancelled")}>
                        Cancel session
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
      {creating && (
        <CreateEventModal
          kind={kind}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload(true);
          }}
        />
      )}
      {adding && (
        <AddParticipantModal
          event={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            reload(true);
          }}
        />
      )}
    </>
  );
}

function CreateEventModal({ kind, onClose, onSaved }: { kind: string; onClose: () => void; onSaved: () => void }) {
  const { data: jobs } = useApi<Job[]>("/api/jobs");
  const [form, setForm] = useState({
    title: kind === "interview" ? "Interview Session" : "Assignment Interview (Demo Session)",
    kind,
    job_id: "",
    starts_at: "",
    duration_minutes: 60,
    meeting_link: "",
    capacity: kind === "interview" ? 6 : 1,
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/events", {
        method: "POST",
        json: {
          ...form,
          job_id: form.job_id ? Number(form.job_id) : null,
          starts_at: new Date(form.starts_at).toISOString(),
          duration_minutes: Number(form.duration_minutes),
          capacity: Number(form.capacity),
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New session">
      <form onSubmit={save} className="space-y-4">
        <ErrorNote message={error} />
        <Field label="Title" required>
          <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Role" hint="Leave empty to offer this slot to candidates of every role">
          <Select value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })}>
            <option value="">All roles</option>
            {jobs?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date & time" required className="sm:col-span-3">
            <Input type="datetime-local" required value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
          </Field>
          <Field label="Duration (min)">
            <Input
              type="number"
              min="10"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Capacity">
            <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Meeting link" hint="Zoom / Google Meet link shared with booked candidates">
          <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://meet.google.com/…" />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create session
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddParticipantModal({ event, onClose, onSaved }: { event: RecruitmentEvent; onClose: () => void; onSaved: () => void }) {
  const { data: candidates } = useApi<CandidateSummary[]>(event.job_id ? `/api/candidates?job_id=${event.job_id}` : "/api/candidates");
  const [candidateId, setCandidateId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const booked = new Set(event.participants?.map((p) => p.candidate_id));

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api(`/api/events/${event.id}/participants`, { method: "POST", json: { candidate_id: Number(candidateId) } });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Add candidate to ${event.title}`}>
      <div className="space-y-4">
        <ErrorNote message={error} />
        <Field label="Candidate">
          <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
            <option value="">Select a candidate</option>
            {candidates
              ?.filter((c) => !booked.has(c.id) && c.pipeline_status !== "Rejected")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} – {c.job_title} ({c.pipeline_status})
                </option>
              ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!candidateId}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
