"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, CalendarDays, Clock } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Button, Card, EmptyState, ErrorNote, LoadingBlock, cn } from "@/components/ui";
import { PublicShell } from "@/components/public-shell";

interface BookingPage {
  candidate_name: string;
  job_title: string;
  kind: "interview" | "onboarding";
  status: string;
  booked_event: { title: string; starts_at: string; meeting_link: string; duration_minutes: number } | null;
  events: { id: number; title: string; starts_at: string; duration_minutes: number; seats_left: number }[];
}

export default function BookPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, loading, reload } = useApi<BookingPage>(`/api/public/booking/${token}`);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function book() {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await api(`/api/public/booking/${token}`, { method: "POST", json: { event_id: selected } });
      await reload();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Booking failed");
      reload(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) return <PublicShell><LoadingBlock /></PublicShell>;
  if (!data) return <PublicShell><ErrorNote message={error} /></PublicShell>;
  const label = data.kind === "interview" ? "interview" : "assignment interview";

  if (data.booked_event)
    return (
      <PublicShell>
        <Card className="p-10 text-center">
          <CalendarCheck className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">You&apos;re booked, {data.candidate_name.split(" ")[0]}!</h1>
          <p className="mt-2 text-slate-600">
            {data.booked_event.title} for <b>{data.job_title}</b>
          </p>
          <p className="mt-1 text-lg font-medium text-slate-900">{formatDateTime(data.booked_event.starts_at)}</p>
          <p className="text-sm text-slate-500">{data.booked_event.duration_minutes} minutes</p>
          {data.booked_event.meeting_link && (
            <a href={data.booked_event.meeting_link} target="_blank" rel="noreferrer" className="mt-4 inline-block">
              <Button>Meeting link</Button>
            </a>
          )}
          <p className="mt-4 text-sm text-slate-500">A confirmation has been sent to your email.</p>
        </Card>
      </PublicShell>
    );

  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold text-slate-900">Book your {label}</h1>
      <p className="mt-1 text-slate-500">
        Hi {data.candidate_name.split(" ")[0]}, choose a time slot for the <b>{data.job_title}</b> {label}.
      </p>
      <div className="mt-6 space-y-3">
        {data.events.length === 0 ? (
          <Card>
            <EmptyState title="No slots available right now" description="Our team will add new slots shortly – please check this link again later." />
          </Card>
        ) : (
          data.events.map((e) => (
            <button key={e.id} onClick={() => setSelected(e.id)} className="block w-full text-left">
              <Card className={cn("flex items-center justify-between gap-4 p-4 transition", selected === e.id ? "border-brand-600 ring-2 ring-brand-100" : "hover:border-slate-300")}>
                <div className="flex items-center gap-4">
                  <CalendarDays className="h-5 w-5 text-brand-600" />
                  <div>
                    <p className="font-medium text-slate-900">{formatDateTime(e.starts_at)}</p>
                    <p className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="h-3.5 w-3.5" /> {e.duration_minutes} min · {e.title}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">{e.seats_left} seat{e.seats_left === 1 ? "" : "s"} left</span>
              </Card>
            </button>
          ))
        )}
        <ErrorNote message={submitError} />
        {data.events.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={book} disabled={!selected} loading={submitting}>
              Confirm booking
            </Button>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
