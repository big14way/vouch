/** Mirrors `Vault.Status`. */
export const Status = {
  None: 0, Open: 1, Funded: 2, Submitted: 3, Attested: 4, Settled: 5, Disputed: 6, Resolved: 7, Refunded: 8, Expired: 9,
} as const;
export type StatusCode = (typeof Status)[keyof typeof Status];
export type StatusName = keyof typeof Status;

/** Mirrors `Vault.Verdict`. */
export const Verdict = { None: 0, Pass: 1, NeedsReview: 2, Fail: 3 } as const;
export type VerdictCode = (typeof Verdict)[keyof typeof Verdict];
export type VerdictName = "PASS" | "NEEDS_REVIEW" | "FAIL";

export const verdictToName: Record<VerdictCode, VerdictName | null> = { 0: null, 1: "PASS", 2: "NEEDS_REVIEW", 3: "FAIL" };
export const verdictFromName: Record<VerdictName, VerdictCode> = { PASS: 1, NEEDS_REVIEW: 2, FAIL: 3 };

export function statusName(code: number): StatusName {
  const entry = (Object.entries(Status) as [StatusName, number][]).find(([, v]) => v === code);
  if (!entry) throw new Error(`unknown status ${code}`);
  return entry[0];
}

/** Human status pills (spec §8.4). No crypto vocabulary. */
export type Pill =
  | "Awaiting payment" | "Locked" | "Delivered" | "Verified" | "Needs review" | "Paid" | "Disputed" | "Refunded" | "Expired";

export function pillFor(status: StatusName, verdict: VerdictCode | null, deadlinePassed = false): Pill {
  switch (status) {
    case "None":
    case "Open":
      return "Awaiting payment";
    case "Funded":
      return deadlinePassed ? "Expired" : "Locked";
    case "Submitted":
      return "Delivered";
    case "Attested":
      return verdict === Verdict.Pass ? "Verified" : "Needs review";
    case "Settled":
    case "Resolved":
      return "Paid";
    case "Disputed":
      return "Disputed";
    case "Refunded":
      return "Refunded";
    case "Expired":
      return "Expired";
  }
}

export const TERMINAL_STATUSES: readonly StatusName[] = ["Settled", "Resolved", "Refunded", "Expired"];
export const LIVE_STATUSES: readonly StatusName[] = ["Funded", "Submitted", "Attested", "Disputed"];
