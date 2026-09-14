"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobDto, VerdictDto } from "@vouch/shared";
import { jobs, me as meApi, type JobResponse } from "./api";

export function useJob(id: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["job", id], queryFn: () => jobs.get(id), refetchInterval: 15_000 });
  const v = useQuery({ queryKey: ["verdict", id], queryFn: () => jobs.verdict(id), refetchInterval: 15_000 });
  const t = useQuery({ queryKey: ["timeline", id], queryFn: () => jobs.timeline(id), refetchInterval: 20_000 });
  const es = useRef<EventSource | null>(null);
  useEffect(() => {
    // Live updates: SSE snapshots overwrite the cached queries; reconnects after the server closes (~55 s).
    let stop = false;
    const connect = () => {
      if (stop) return;
      const src = new EventSource(`/api/v1/jobs/${id}/events`);
      es.current = src;
      src.addEventListener("job", (e) => qc.setQueryData<JobResponse>(["job", id], { job: JSON.parse((e as MessageEvent).data) as JobDto }));
      src.addEventListener("verdict", (e) => qc.setQueryData<VerdictDto>(["verdict", id], JSON.parse((e as MessageEvent).data) as VerdictDto));
      src.onerror = () => {
        src.close();
        setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      stop = true;
      es.current?.close();
    };
  }, [id, qc]);
  return { job: q.data?.job ?? null, verdict: v.data ?? null, timeline: t.data?.events ?? [], loading: q.isLoading, error: q.error, refetch: () => Promise.all([q.refetch(), v.refetch(), t.refetch()]) };
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: ["me"], queryFn: meApi.get, enabled, retry: false });
}

/** Ticks once a second; used by the countdown ring. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
