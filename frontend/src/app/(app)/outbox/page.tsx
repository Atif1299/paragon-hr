"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, EmptyState, ErrorNote, LoadingBlock, PageHeader } from "@/components/ui";

interface Message {
  id: number;
  candidate_id: number | null;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  error: string;
  created_at: string;
}

export default function OutboxPage() {
  const { data, error, loading } = useApi<Message[]>("/api/outbox", { pollMs: 10000 });
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <PageHeader
        title="Email outbox"
        description="Every automated candidate email. Status is 'logged' when SMTP is not configured (emails are recorded but not sent)."
      />
      <ErrorNote message={error} />
      <Card className="overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState title="No emails yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((m) => (
              <li key={m.id}>
                <button className="flex w-full items-start justify-between gap-4 px-5 py-3 text-left hover:bg-slate-50" onClick={() => setOpen(open === m.id ? null : m.id)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{m.subject}</p>
                    <p className="text-xs text-slate-500">To {m.to_email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={m.status === "sent" ? "green" : m.status === "failed" ? "red" : "slate"}>{m.status}</Badge>
                    <span className="text-xs text-slate-400">{formatDateTime(m.created_at)}</span>
                  </div>
                </button>
                {open === m.id && (
                  <div className="space-y-2 bg-slate-50 px-5 py-4">
                    {m.error && <ErrorNote message={m.error} />}
                    <p className="prose-pre text-sm text-slate-700">{m.body}</p>
                    {m.candidate_id && (
                      <Link href={`/candidates/${m.candidate_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                        Open candidate
                      </Link>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
