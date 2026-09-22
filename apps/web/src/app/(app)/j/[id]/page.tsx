import { cache } from "react";
import type { Metadata } from "next";
import type { JobDto, TimelineEvent, VerdictDto } from "@vouch/shared";
import { db } from "@/lib/db";
import { toDto, verdictDto } from "@/lib/jobs/dto";
import { getJobOrThrow, timeline } from "@/lib/jobs/service";
import { JobView, type JobInitial } from "./job-view";

/**
 * The public view of the job, loaded on the server so the first paint carries the real content
 * (title, amount if public, timeline, verdict). The client refetches with the viewer's identity for role-scoped fields.
 */
const load = cache(async (id: string): Promise<JobInitial | null> => {
  try {
    const job = await getJobOrThrow(id);
    const anonymous = { kind: "anonymous", isArbiter: false } as const;
    const [dto, v, d, events] = await Promise.all([
      toDto(job, anonymous),
      db.verdict.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
      db.delivery.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } }),
      timeline(job),
    ]);
    const verdict: VerdictDto = await verdictDto(job, v, d);
    if (!job.amountPublic) verdict.reportUrl = null;
    return { job: dto as JobDto, verdict, timeline: events as TimelineEvent[] };
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const initial = await load(id);
  return { title: initial?.job.title ?? `Job ${id.slice(0, 10)}…`, robots: { index: false } };
}

/** S3 Job page (public) + S5 worker view, by role. */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView id={id} initial={await load(id)} />;
}
