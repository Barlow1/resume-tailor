import type { KeywordCandidate, Priority, WhereToAdd } from './types.ts';

// Simple heuristic; keep it transparent & testable.
export function rankCandidates(jdTokens: string[], resumeTokens: string[], opts?: {
  jdSectionIndex?: Record<string,'requirements'|'responsibilities'|'preferred'|'other'>,
  typeClassifier?: (term:string)=>KeywordCandidate['type'],
}) {
  // map frequencies
  const jf = count(jdTokens);    // Map<string, number>
  const rf = count(resumeTokens);

  const sectionWeight = (s: KeywordCandidate['jdSection']) =>
    s === 'requirements' ? 3 : s === 'responsibilities' ? 2 : s === 'preferred' ? 1 : 0;

  const typeWeight = (t: KeywordCandidate['type']) =>
    t === 'tool' ? 2 : t === 'method' || t === 'domain' ? 1.5 : t === 'metric' ? 1 : 0.5;

  const out: KeywordCandidate[] = [];
  for (const term of new Set([...jdTokens])) {
    const jdTf = jf.get(term) ?? 0;
    const resumeFreq = rf.get(term) ?? 0;
    const jdSection = (opts?.jdSectionIndex?.[term] ?? 'other');

    const type = (opts?.typeClassifier?.(term) ?? classify(term));
    const score =
      5 * sectionWeight(jdSection) +
      3 * jdTf +
      2 * typeWeight(type) +
      2 * (resumeFreq > 0 ? 1 : 0) -   // bonus if already supported
      3 * (resumeFreq > 0 ? 0.3 : 0);  // light penalty so missing terms bubble up

    const priority: Priority =
      sectionWeight(jdSection) >= 3 ? 'critical' :
      sectionWeight(jdSection) >= 2 ? 'important' : 'nice';

    const where: WhereToAdd = decidePlacement(type);

    out.push({ term, jdTf, jdSection, type, resumePresent: !!resumeFreq, resumeFreq, score, priority, where });
  }
  return out.sort((a,b)=>b.score-a.score);
}

function count(arr: string[]) {
  const m = new Map<string, number>();
  for (const t of arr) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}
function classify(term: string): KeywordCandidate['type'] {
  if (/sql|python|hubspot|salesforce|segment|mixpanel|amplitude|figma|jira/i.test(term)) return 'tool';
  if (/a\/?b|experimentation|nurture|roadmap|research|funnels?|onboarding|retention/i.test(term)) return 'method';
  if (/real.?estate|fintech|health/i.test(term)) return 'domain';
  if (/nps|conversion|mau|arr|retention|churn/i.test(term)) return 'metric';
  return 'soft';
}
function decidePlacement(t: KeywordCandidate['type']): WhereToAdd {
  if (t === 'tool') return ['skills','bullet'];
  if (t === 'method') return ['summary','bullet'];
  if (t === 'domain') return ['summary','bullet'];
  if (t === 'metric') return ['bullet'];
  return ['bullet'];
}
