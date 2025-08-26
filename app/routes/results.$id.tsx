import * as React from 'react';
import { useLoaderData, Link } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id!;
  const origin = new URL(request.url).origin;
  const apiUrl = new URL(`/resources/analysis/${id}`, origin);
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Response(`Failed to load analysis ${id}`, { status: res.status });
  const data = await res.json();
  return json(data);
}

export default function ResultsPage() {
  const a = useLoaderData<any>();
  const [resumeTxt, setResumeTxt] = React.useState(a.resumeTxt || '');
  const [newFit, setNewFit] = React.useState<number | null>(null);
  const [reanalyzing, setReanalyzing] = React.useState(false);

  async function reanalyze() {
    setReanalyzing(true);
    try {
      const res = await fetch(`/resources/update-analysis/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeTxt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNewFit(data.fitPct ?? data.feedback?.fitPct ?? null);
    } catch (err) {
      console.error(err);
      alert('Re-analyze failed.');
    } finally {
      setReanalyzing(false);
    }
  }

  const improvements = a.feedback?.improveBullets ?? [];
  const fit = typeof a.fitPct === 'number' ? a.fitPct : null;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Page header */}
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
          Resume Analyzer
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Results &amp; Edits</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Review your fit, scan red flags, and apply targeted edits below. Re-analyze anytime to see
          how your changes improve the score.
        </p>
      </header>

      {/* Results card */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="rounded-t-2xl bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Analysis Summary</h2>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Fit block */}
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-base font-semibold text-gray-900">Fit</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                {fit != null ? `${fit}%` : '—'}
              </span>
              {newFit != null && (
                <span className="text-xs font-medium text-green-700">
                  → {newFit}%
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, newFit ?? fit ?? 0))}%` }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Summary text */}
          {a.feedback?.summary && (
            <p className="text-sm leading-relaxed text-gray-800">{a.feedback.summary}</p>
          )}

          {/* Red flags */}
          {a.feedback?.redFlags?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Red Flags</h3>
              <ul className="space-y-1.5 text-sm text-gray-800">
                {a.feedback.redFlags.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements table */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Improvements</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-gray-700">
                    <th className="px-3 py-2 font-semibold">Current</th>
                    <th className="px-3 py-2 font-semibold">Suggestion</th>
                    <th className="px-3 py-2 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {improvements.length ? (
                    improvements.map((b: any, i: number) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-3 text-gray-800">{b.current}</td>
                        <td className="px-3 py-3 text-gray-800">{b.suggest}</td>
                        <td className="px-3 py-3 text-gray-800">{b.why}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-3 italic text-gray-500" colSpan={3}>
                        No suggestions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit + Reanalyze */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Edit Résumé</h3>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-indigo-200 transition focus:ring-4"
              rows={10}
              value={resumeTxt}
              onChange={(e) => setResumeTxt(e.target.value)}
              placeholder="Edit your résumé text here…"
            />

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                onClick={reanalyze}
                disabled={reanalyzing}
                aria-busy={reanalyzing}
                aria-live="polite"
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition
                  ${reanalyzing ? 'cursor-not-allowed bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {reanalyzing && (
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                )}
                {reanalyzing ? 'Reanalyzing…' : 'Re-analyze'}
              </button>

              {newFit != null && (
                <span className="text-xs text-gray-600">
                  Updated fit after re-analysis: <span className="font-semibold text-gray-800">{newFit}%</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* People card */}
      {a.people?.length > 0 && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="rounded-t-2xl bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Relevant People</h2>
          </div>
          <ul className="px-5 py-4 space-y-2 text-sm">
            {a.people.map((p: any, i: number) => (
              <li key={i}>
                <a
                  className="text-indigo-700 underline-offset-4 hover:underline"
                  href={p.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.name} — {p.role}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer nav */}
      <div className="mt-6 flex flex-wrap gap-4">
        <Link to={`/job/${a.id}`} className="text-sm text-gray-600 underline-offset-4 hover:underline">
          ← Back to Job
        </Link>
        <Link to="/resume" className="text-sm text-gray-600 underline-offset-4 hover:underline">
          Start Over
        </Link>
      </div>
    </div>
  );
}
