import { KeywordCandidate } from './types.ts';

export function attachEvidence(cands: KeywordCandidate[], resumeTxt: string) {
  return cands.map(c => {
    const rx = mkSearch(c.term);
    const m = resumeTxt.match(rx);
    if (m) {
      const excerpt = snip(resumeTxt, m.index ?? 0, c.term.length);
      return { ...c, evidence: { supported: true, excerpt } };
    }
    return { ...c, evidence: { supported: false } };
  });
}
function mkSearch(term:string) {
  return new RegExp(`(.{0,60})\\b(${escape(term)})\\b(.{0,60})`, 'i');
}
function snip(text:string, start:number, len:number) {
  const s = Math.max(0, start - 60);
  const e = Math.min(text.length, start + len + 60);
  return text.slice(s, e).replace(/\s+/g, ' ').trim();
}
function escape(s:string){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
