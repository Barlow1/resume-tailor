// app/routes/analyze.job.$id.tsx
import * as React from 'react';
import { useLoaderData, useNavigate, Link } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ params }: LoaderFunctionArgs) {
  const res = await fetch(`${process.env.BASE_URL ?? ''}/resources/analysis.${params.id}`);
  return res;
}

export default function AnalyzeJobPage() {
  const a = useLoaderData<any>();
  const nav = useNavigate();
  const [title, setTitle] = React.useState(a.title || '');
  const [company, setCompany] = React.useState(a.company || '');
  const [jdText, setJdText] = React.useState(a.jdText || '');

  const resumePreview =
    (typeof window !== 'undefined' && localStorage.getItem(`analysis-resume-${a.id}`)) || a.resumeTxt;

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/resources/analysis.update.${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, company, jdText, resumeTxt: resumePreview }),
    });
    nav(`/analyze/results/${a.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-3xl font-bold mb-2">Step 2: Job Details</h1>
        <form onSubmit={analyze} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            placeholder="Job Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <textarea
            className="w-full border rounded p-2"
            rows={8}
            placeholder="Paste the job description"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
          <button className="bg-indigo-600 text-white rounded px-4 py-2">
            Analyze
          </button>
        </form>
        <Link to="/analyze/resume" className="text-sm text-gray-500 hover:underline mt-3 inline-block">
          ← Back
        </Link>
      </div>
      <div>
        <h2 className="font-semibold mb-2">Your Résumé</h2>
        <pre className="border rounded p-2 whitespace-pre-wrap text-sm">
          {resumePreview}
        </pre>
      </div>
    </div>
  );
}
