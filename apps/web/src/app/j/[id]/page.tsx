import type { Metadata } from "next";
import { JobView } from "./job-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Job ${id.slice(0, 10)}…`, robots: { index: false } };
}

/** S3 Job page (public) + S5 worker view, by role. */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView id={id} />;
}
