"use client";

import Link from "next/link";
import { ArrowRightLeft, CalendarDays, CheckCircle2, Filter, Gauge, Users } from "lucide-react";
import { useApi } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { Card, CardHeader, EmptyState, ErrorNote, LoadingBlock, PageHeader, StatCard } from "@/components/ui";

interface Dashboard {
  total_candidates: number;
  right_fit: number;
  not_a_fit: number;
  pre_selected_or_beyond: number;
  selected: number;
  referrals: number;
  avg_screening_score: number | null;
  funnel: { status: string; count: number }[];
  by_job: { job_id: number; title: string; count: number }[];
  upcoming_events: { id: number; title: string; starts_at: string; kind: string; seats_left: number; capacity: number }[];
  recent_activity: {
    id: number;
    candidate_id: number | null;
    candidate_name: string | null;
    actor: string;
    action: string;
    detail: string;
    created_at: string;
  }[];
}

export default function DashboardPage() {
  const { data, error, loading } = useApi<Dashboard>("/api/dashboard", { pollMs: 15000 });

  if (loading && !data) return <LoadingBlock />;
  if (!data) return <ErrorNote message={error} />;

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const maxJob = Math.max(1, ...data.by_job.map((j) => j.count));

  return (
    <>
      <PageHeader title="Dashboard" description="Live overview of the recruitment pipeline across all open roles." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Candidates" value={data.total_candidates} icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Right fit"
          value={data.right_fit}
          hint={`${data.not_a_fit} not a fit`}
          icon={<Filter className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Pre-selected+"
          value={data.pre_selected_or_beyond}
          icon={<Gauge className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          label="Selected"
          value={data.selected}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Auto-referrals"
          value={data.referrals}
          hint={data.avg_screening_score !== null ? `Avg screening ${data.avg_screening_score}%` : undefined}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          accent="bg-orange-50 text-orange-700"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Pipeline funnel" description="Candidates currently at each stage" />
          <div className="space-y-2.5 p-5">
            {data.funnel.map((f) => (
              <Link
                key={f.status}
                href={`/candidates?status=${encodeURIComponent(f.status)}`}
                className="group grid grid-cols-[200px_1fr_40px] items-center gap-3"
              >
                <span className="truncate text-sm text-slate-600 group-hover:text-brand-700">{f.status}</span>
                <div className="h-6 overflow-hidden rounded-md bg-slate-50">
                  <div
                    className="h-full rounded-md bg-gradient-to-r from-brand-600 to-indigo-400 transition-all"
                    style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                  />
                </div>
                <span className="text-right text-sm font-medium text-slate-900">{f.count}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming events"
            action={
              <Link href="/events" className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            }
          />
          {data.upcoming_events.length === 0 ? (
            <EmptyState title="No upcoming events" description="Create interview slots in Recruitment Events." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcoming_events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(e.starts_at)} · {e.capacity - e.seats_left}/{e.capacity} booked
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Candidates by role" />
          <div className="space-y-3 p-5">
            {data.by_job.map((j) => (
              <Link key={j.job_id} href={`/candidates?job_id=${j.job_id}`} className="block group">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate text-slate-600 group-hover:text-brand-700">{j.title}</span>
                  <span className="font-medium text-slate-900">{j.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${(j.count / maxJob) * 100}%` }} />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" description="Automated and manual actions across the pipeline" />
          {data.recent_activity.length === 0 ? (
            <EmptyState title="No activity yet" description="Share an application link from Open Roles to get started." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{a.action}</span>
                      {a.candidate_name && a.candidate_id && (
                        <>
                          {" · "}
                          <Link href={`/candidates/${a.candidate_id}`} className="text-brand-600 hover:underline">
                            {a.candidate_name}
                          </Link>
                        </>
                      )}
                    </p>
                    {a.detail && <p className="truncate text-xs text-slate-500">{a.detail}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                    <p className="text-xs text-slate-400">{a.actor}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
