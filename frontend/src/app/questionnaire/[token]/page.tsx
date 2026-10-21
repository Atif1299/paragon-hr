"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { Button, Card, ErrorNote, Field, LoadingBlock, Textarea } from "@/components/ui";
import { PublicShell } from "@/components/public-shell";

interface QuestionnairePage {
  candidate_name: string;
  job_title: string;
  status: string;
  questions: { id: string; question: string }[];
}

export default function QuestionnairePage() {
  const { token } = useParams<{ token: string }>();
  const { data, error, loading } = useApi<QuestionnairePage>(`/api/public/questionnaire/${token}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      await api(`/api/public/questionnaire/${token}`, { method: "POST", json: { answers } });
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) return <PublicShell><LoadingBlock /></PublicShell>;
  if (!data) return <PublicShell><ErrorNote message={error} /></PublicShell>;

  if (done || data.status !== "sent")
    return (
      <PublicShell>
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Thank you!</h1>
          <p className="mt-2 text-slate-600">Your answers have been received. We will be in touch about next steps.</p>
        </Card>
      </PublicShell>
    );

  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold text-slate-900">A few more questions</h1>
      <p className="mt-1 text-slate-500">
        Hi {data.candidate_name.split(" ")[0]}, thank you for applying for <b>{data.job_title}</b>. Please answer the questions below with
        specific, real examples.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <Card className="space-y-5 p-5">
          {data.questions.map((q, i) => (
            <Field key={q.id} label={`${i + 1}. ${q.question}`} required>
              <Textarea
                required
                rows={4}
                minLength={30}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            </Field>
          ))}
        </Card>
        <ErrorNote message={submitError} />
        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            Submit answers
          </Button>
        </div>
      </form>
    </PublicShell>
  );
}
