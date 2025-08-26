// app/routes/analyze.results.$id.tsx
import * as React from 'react';
import { useLoaderData, Link } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ params }: LoaderFunctionArgs) {
  const res = await fetch(`${process.env.BASE_URL ?? ''}/resources/analysis.${params.id}`);
  return res;
}

export default function AnalyzeResultsPage() {
  const a = useLoaderData<any>();
  const [resumeTxt, setResumeTxt] = React.useState(a.resumeTxt);
  const [newFit, setNewFit] = React.useState<number | null>(null);

  async function reanalyze() {
    const res = await fetch(`/resources/analysis.update.${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeTxt }),
    });
    const data = await res.json();
    setNewFit(data.feedback.fitPct);
  }

  const applyBullet = (b: any) =>
    setResumeTxt((t) => t.replace(b.original, b.updated));

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Step 3: Results & Edit</h1>

      <div className="bg-white rounded-2xl shadow p-6">
        <p className="text-lg mb-3">
          <strong>Fit:</strong> {a.fitPct ?? '—'}%
          {newFit != null && <> → <strong>{newFit}%</strong></>}
        </p>

        <label className="block font-medium mb-1">Edit Résumé</label>
        <textarea
          className="w-full border rounded p-2"
          rows={10}
          value={resumeTxt}
          onChange={(e) => setResumeTxt(e.target.value)}
        />
        <button
          onClick={reanalyze}
          className="mt-3 bg-indigo-600 text-white rounded px-4 py-2"
        >
          Re-analyze
        </button>
      </div>

      {a.feedback?.redFlags?.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-2">Red Flags</h2>
          <ul className="list-disc ml-6">
            {a.feedback.redFlags.map((f: string, i: number) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {a.feedback?.tailoredBullets?.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-2">Tailored Updates</h2>
          <ul className="space-y-2">
            {a.feedback.tailoredBullets.map((b: any, i: number) => (
              <li key={i} className="border-l-4 border-emerald-500 pl-3">
                <p className="text-sm italic">← {b.original}</p>
                <p className="text-sm">→ {b.updated}</p>
                <button
                  onClick={() => applyBullet(b)}
                  className="text-xs bg-emerald-600 text-white px-2 py-1 rounded mt-1"
                >
                  Apply to Résumé
                </button>
                <p className="text-xs text-gray-500 mt-1">Why: {b.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.feedback?.newBullets?.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-2">New Suggestions</h2>
          <ul className="list-disc ml-6">
            {a.feedback.newBullets.map((b: any, i: number) => (
              <li key={i}>{b.text} <span className="text-xs text-gray-500">({b.why})</span></li>
            ))}
          </ul>
        </div>
      )}

      {a.people?.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-2">People to Contact</h2>
          <ul className="list-disc ml-6">
            {a.people.map((p: any, i: number) => (
              <li key={i}>
                <a className="text-indigo-600 hover:underline" href={p.linkedin} target="_blank" rel="noreferrer">
                  {p.name} — {p.role}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-4">
        <Link to={`/analyze/job/${a.id}`} className="text-gray-600 hover:underline">
          ← Back to Job
        </Link>
        <Link to={`/analyze/resume`} className="text-gray-600 hover:underline">
          Start Over
        </Link>
      </div>
    </div>
  );
}
