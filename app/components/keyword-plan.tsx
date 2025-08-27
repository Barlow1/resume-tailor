// app/components/keyword-plan.tsx
import * as React from 'react'
import CopyButton from './copy-button.tsx'

// Off-screen but selectable textarea (must NOT be display:none)
function VisuallyHiddenTextarea({ id, value }: { id: string; value: string }) {
  return (
    <textarea
      id={id}
      value={value ?? ''}
      readOnly
      aria-hidden="true"
      className="absolute -left-[10000px] top-auto h-px w-px opacity-0 pointer-events-none"
      tabIndex={-1}
    />
  )
}

// Make a CSS selector–safe id: letters/digits/_/-
function makeSafeId(prefix: string, term: string, index: number) {
  const safeTerm = (term || 'kw').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40)
  return `${prefix}-${index}-${safeTerm}`
}

export function KeywordPlan({ plan }: { plan: { top10: any[] } | undefined }) {
  if (!plan?.top10?.length) return null

  return (
    <section className="mt-6 rounded-xl border bg-white shadow-sm">
      <div className="rounded-t-xl bg-gray-50 px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Top 10 keywords to add for this job</h2>
      </div>

      <div className="divide-y">
        {plan.top10.map((k, i) => {
          const baseId = makeSafeId('kw', String(k.term ?? ''), i)
          const skillsId = `${baseId}-skills`
          const summaryId = `${baseId}-summary`
          const bulletId = `${baseId}-bullet`

          return (
            <div key={`${baseId}`} className="px-5 py-4 grid gap-3 md:grid-cols-5">
              <div className="md:col-span-1">
                <div className="text-sm font-medium">{k.term}</div>
                <div className="text-xs text-gray-500">{k.priority}</div>
              </div>

              <div className="md:col-span-2 text-sm">
                {k.supported ? (
                  <div className="text-emerald-700 text-xs">✅ Supported: {k.proof}</div>
                ) : (
                  <div className="text-amber-700 text-xs">⚠️ Needs proof: {k.proofSuggestion}</div>
                )}
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-3">
                {k?.snippets?.skills && (
                  <div className="rounded border px-2 py-1 text-xs">
                    <VisuallyHiddenTextarea id={skillsId} value={k.snippets.skills} />
                    Skills: <span className="font-mono">{k.snippets.skills}</span>
                    <CopyButton inputId={skillsId} />
                  </div>
                )}

                {k?.snippets?.summary && (
                  <div className="rounded border px-2 py-1 text-xs">
                    <VisuallyHiddenTextarea id={summaryId} value={k.snippets.summary} />
                    Summary: <span className="font-mono">{k.snippets.summary}</span>
                    <CopyButton inputId={summaryId} />
                  </div>
                )}

                {k?.snippets?.bullet && (
                  <div className="rounded border px-2 py-1 text-xs">
                    <VisuallyHiddenTextarea id={bulletId} value={k.snippets.bullet} />
                    Bullet: <span className="font-mono">{k.snippets.bullet}</span>
                    <CopyButton inputId={bulletId} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
