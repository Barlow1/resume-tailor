import type { JobFit } from "./ai-helpers.server.ts"; // ← Update path if needed

export type OutreachOptions = {
  recruiterName?: string; // optional; if omitted we won't personalize the greeting
  company?: string; // optional; if omitted we won't mention company in subject/intro
  candidateName?: string; // optional; not required; currently unused to avoid adding personal data unless desired
  candidateTitle?: string; // optional; e.g., "Senior Frontend Engineer"
  channel?: "email" | "linkedin"; // optional; affects tone slightly; default neutral
  maxStrong?: number; // default 4
  includePartial?: boolean; // default true (include at most one partial)
  maxMetrics?: number; // default 2
  wordLimit?: number; // optional soft cap for body; we'll trim if provided
};

export type OutreachMessage = {
  subject: string | null;
  body: string;
  selections: {
    strong: JobFit["responsibilities_alignment"];
    partial: JobFit["responsibilities_alignment"]; // 0..1
    metrics: JobFit["metrics"];
  };
};

export type Metric = JobFit["metrics"][number]

// Utility: safe substring for evidence text; trims and collapses whitespace
export function normalizeSnippet(text: string, maxLen = 160): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  return clean.length > maxLen ? clean.slice(0, maxLen - 1).trimEnd() + "…" : clean;
}

export function pickStrongMatches(jobFit: JobFit, maxStrong = 4) {
  const items = Array.isArray(jobFit.responsibilities_alignment)
    ? jobFit.responsibilities_alignment.filter((r) => r?.status === "strong_match")
    : [];
  // Keep original order; prefer those with evidence
  const withEvidence = items.filter((r) => Array.isArray(r.evidence) && r.evidence.length > 0);
  const withoutEvidence = items.filter((r) => !Array.isArray(r.evidence) || r.evidence.length === 0);
  return [...withEvidence, ...withoutEvidence].slice(0, Math.max(0, maxStrong));
}

export function pickOnePartial(jobFit: JobFit) {
  const items = Array.isArray(jobFit.responsibilities_alignment)
    ? jobFit.responsibilities_alignment.filter((r) => r?.status === "partial_match")
    : [];
  // Prefer a partial that has evidence
  const withEvidence = items.find((r) => Array.isArray(r.evidence) && r.evidence.length > 0);
  return withEvidence ?? items[0] ?? null;
}

export function pickTopMetrics(jobFit: JobFit, maxMetrics = 2) {
  const arr = Array.isArray(jobFit.metrics) ? jobFit.metrics : [];
  // Keep the first N as-is (we don't invent ranking). If you later add weights, sort here.
  return arr.slice(0, Math.max(0, maxMetrics));
}
