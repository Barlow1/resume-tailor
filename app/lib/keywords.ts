// app/lib/keywords.ts
const STOP = new Set([
  'and','or','the','a','an','to','of','for','with','in','on','at','by','from','as',
  'is','are','be','have','has','was','were','this','that','it','you','we','they','i'
])

function tokenize(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOP.has(t) && t.length > 2)
}

export function extractKeywords(resumeTxt: string, jdText: string) {
  const r = tokenize(resumeTxt)
  const j = tokenize(jdText)

  const freq = (arr: string[]) => {
    const m = new Map<string, number>()
    for (const w of arr) m.set(w, (m.get(w) ?? 0) + 1)
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([w])=>w)
  }

  const resume = Array.from(new Set(freq(r))).slice(0, 40)
  const jd = Array.from(new Set(freq(j))).slice(0, 40)
  const missing = jd.filter(k => !resume.includes(k)).slice(0, 25)

  return { resumeKeywords: resume, jdKeywords: jd, missingInResume: missing }
}