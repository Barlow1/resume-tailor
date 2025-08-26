// app/routes/analyze.resume.tsx
import * as React from 'react';
import { useNavigate } from '@remix-run/react';

export default function AnalyzeResumePage() {
  const [resumeTxt, setResumeTxt] = React.useState(
    (typeof window !== 'undefined' && localStorage.getItem('resume-draft')) || ''
  );
  const [saving, setSaving] = React.useState(false);
  const nav = useNavigate();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/resources/analysis.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeTxt }),
    });
    const data = await res.json();
    localStorage.setItem(`analysis-resume-${data.id}`, resumeTxt);
    localStorage.setItem('resume-draft', resumeTxt);
    nav(`/analyze/job/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-3xl font-bold">Step 1: Paste Your Résumé</h1>
      <form onSubmit={handleSave} className="space-y-3">
        <textarea
          className="w-full border rounded p-3"
          rows={12}
          value={resumeTxt}
          onChange={(e) => setResumeTxt(e.target.value)}
          placeholder="Paste your résumé..."
        />
        <button
          className="bg-indigo-600 text-white rounded px-4 py-2"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}
