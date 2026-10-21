"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { Card, EmptyState, ErrorNote, LoadingBlock } from "@/components/ui";
import { PublicShell } from "@/components/public-shell";

interface PublicJob {
  id: number;
  slug: string;
  title: string;
  area: string;
  description: string;
  min_years: number;
}

export default function CareersPage() {
  const { data, error, loading } = useApi<PublicJob[]>("/api/public/jobs");

  return (
    <PublicShell>
      <h1 className="text-3xl font-semibold text-slate-900">Open roles</h1>
      <p className="mt-2 text-slate-500">Join a consolidated organisation with over 21 years in business. Remote opportunities.</p>
      <div className="mt-8 space-y-3">
        <ErrorNote message={error} />
        {loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <Card>
            <EmptyState title="No open roles right now" description="Please check back soon." />
          </Card>
        ) : (
          data.map((job) => (
            <Link key={job.id} href={`/apply/${job.slug}`}>
              <Card className="group flex items-center justify-between gap-4 p-5 transition hover:border-brand-500 hover:shadow-md">
                <div>
                  <h2 className="font-semibold text-slate-900 group-hover:text-brand-700">{job.title}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {job.area} · Remote · {job.min_years}+ years experience
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-brand-600" />
              </Card>
            </Link>
          ))
        )}
      </div>
    </PublicShell>
  );
}
