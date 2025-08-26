import * as React from 'react';
import { useLoaderData, useNavigate, Link } from '@remix-run/react';
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

export default function JobPage() {
  const a = useLoaderData<any>();
  const nav = useNavigate();

  const [title, setTitle] = React.useState(a.title || '');
  const [company, setCompany] = React.useState(a.company || '');
  const [jdText, setJdText] = React.useState(a.jdText || '');
  const [analyzing, setAnalyzing] = React.useState(false);

  const resumePreview =
    (typeof window !== 'undefined' && localStorage.getItem(`analysis-resume-${a.id}`)) ||
    a.resumeTxt ||
    '';

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setAnalyzing(true);
    try {
      const res = await fetch(`/resources/update-analysis/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, company, jdText, resumeTxt: resumePreview }),
      });
      if (!res.ok) throw new Error(await res.text());
      nav(`/results/${a.id}`);
    } catch (err) {
      console.error(err);
      alert('Analyze failed. Check the server logs.');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Page header */}
      <header className="mb-6">
        
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Add the Job You’re Targeting</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Paste the job details and we’ll compare it against your résumé to show:
        </p>
        <ul className="mt-2 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
          <li className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            How well you match the role
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Red flags that might hold you back
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            Suggestions to improve your fit
          </li>
        </ul>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: form card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <form onSubmit={analyze} className="space-y-4">
            <div>
              <label htmlFor="job-title" className="mb-1 block text-sm font-medium text-gray-800">
                Job Title
              </label>
              <input
                id="job-title"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring-4"
                placeholder="e.g., Product Manager"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="company" className="mb-1 block text-sm font-medium text-gray-800">
                Company
              </label>
              <input
                id="company"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring-4"
                placeholder="e.g., Acme Corp"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="jd" className="mb-1 block text-sm font-medium text-gray-800">
                Job Description
              </label>
              <textarea
                id="jd"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-200 transition focus:ring-4"
                rows={10}
                placeholder="Paste the full job description"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <div className="mt-1 text-xs text-gray-500">
                Tip: Include responsibilities and requirements for best results.
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={analyzing}
                aria-busy={analyzing}
                className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition
                  ${analyzing ? 'cursor-not-allowed bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {analyzing && (
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.2" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                )}
                {analyzing ? 'Analyzing…' : 'Analyze My Fit'}
              </button>

              <Link to="/resume" className="text-sm text-gray-600 underline-offset-4 hover:underline">
                ← Back
              </Link>
            </div>
          </form>
        </div>

        {/* Right: résumé preview card */}
        <aside className="md:sticky md:top-6">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="rounded-t-2xl bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-800">Your Résumé (snapshot)</h2>
            </div>
            <div className="max-h-[70vh] overflow-auto px-5 py-4 text-sm">
              <pre className="whitespace-pre-wrap leading-relaxed text-gray-800">{resumePreview}</pre>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Your text is saved locally and in your account.
          </p>
        </aside>
      </div>
    </div>
  );
}
