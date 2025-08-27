import * as React from 'react'
import { useNavigate, Link } from '@remix-run/react'

export default function ResumePage() {
  const [resumeTxt, setResumeTxt] = React.useState(
    (typeof window !== 'undefined' && localStorage.getItem('resume-draft')) || ''
  )
  const [saving, setSaving] = React.useState(false)
  const nav = useNavigate()

  // Persist as they type so they never lose work
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('resume-draft', resumeTxt)
    }
  }, [resumeTxt])

  const words = React.useMemo(
    () => resumeTxt.trim().split(/\s+/).filter(Boolean).length,
    [resumeTxt]
  )
  const chars = resumeTxt.length

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/resources/create-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeTxt }),
      })

      // ✅ force login if not authenticated
      if (res.status === 401) {
        // bounce back to this page after login
        nav(`/login?redirectTo=/resume`)
        return
      }

      // You may keep a free/paid gate ONLY for "analyze", not "save".
      // If your server accidentally returns 402 here, surface it:
      if (res.status === 402) {
        const text = await res.text()
        throw new Error(text || 'Upgrade required')
      }

      if (!res.ok) {
        // If the server sent an HTML error page, avoid .json() exploding
        const text = await res.text()
        throw new Error(`Save failed (${res.status}). ${text.slice(0, 200)}…`)
      }

      const data: { id: string } = await res.json()
      localStorage.setItem(`analysis-resume-${data.id}`, resumeTxt)
      localStorage.setItem('resume-draft', resumeTxt)
      nav(`/job/${data.id}`)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Failed to save résumé. Check server logs.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Analyze Your Résumé for Job Fit
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Paste your résumé to see how well it matches a target job, uncover red flags,
          and get actionable improvements so your résumé stands out.
        </p>
      </header>

      {/* Card */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="rounded-t-2xl bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Paste Your Résumé</h2>
        </div>

        <form onSubmit={handleSave} className="px-5 pb-5 pt-4">
          <label htmlFor="resume" className="sr-only">
            Résumé text
          </label>
          <textarea
            id="resume"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-indigo-200 transition focus:ring-4"
            rows={14}
            value={resumeTxt}
            onChange={(e) => setResumeTxt(e.target.value)}
            placeholder="Paste your résumé text here…"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
            <span>{words} words • {chars} chars</span>
            <span>Tip: Plain text works best. Remove images/columns before pasting.</span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button
              className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition
                ${saving || !resumeTxt.trim()
                  ? 'cursor-not-allowed bg-indigo-400'
                  : 'bg-indigo-600 hover:bg-indigo-700'}`}
              disabled={saving || !resumeTxt.trim()}
              aria-busy={saving}
              type="submit"
            >
              {saving && (
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
              {saving ? 'Saving…' : 'Save & Continue'}
            </button>

            <Link to="/" className="text-sm text-gray-600 underline-offset-4 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Benefits row */}
      <ul className="mt-6 grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
        <li className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          Get a clear fit score
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Spot red flags instantly
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          Receive targeted improvements
        </li>
      </ul>
    </div>
  )
}
