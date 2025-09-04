import * as React from 'react'
import { useLoaderData, useNavigate, Link } from '@remix-run/react'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { SubscribeModal } from '~/components/subscribe-modal.tsx'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id!
  const origin = new URL(request.url).origin
  // This route should be implemented at app/routes/resources+/analysis.$id.tsx
  const apiUrl = new URL(`/resources/analysis/${id}`, origin)
  const res = await fetch(apiUrl)
  if (!res.ok) throw new Response(`Failed to load analysis ${id}`, { status: res.status })
  const data = await res.json()
  return json(data)
}

export default function JobPage() {
  const a = useLoaderData<any>()
  const nav = useNavigate()
  const [title, setTitle] = React.useState(a.title || '')
  const [company, setCompany] = React.useState(a.company || '')
  const [jdText, setJdText] = React.useState(a.jdText || '')
  const [analyzing, setAnalyzing] = React.useState(false)
  const [showSubscribe, setShowSubscribe] = React.useState(false)

  const resumePreview =
    (typeof window !== 'undefined' && localStorage.getItem(`analysis-resume-${a.id}`)) ||
    a.resumeTxt ||
    ''

  async function analyze(e: React.FormEvent) {
    e.preventDefault()
    setAnalyzing(true)
    try {
      const res = await fetch(`/resources/update-analysis/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, company, jdText, resumeTxt: resumePreview }),
      })

      if (res.status === 401) {
        nav(`/login?redirectTo=/job/${a.id}`)
        return
      }
      if (res.status === 402) {
        setShowSubscribe(true)
        return
      }
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Analyze failed (${res.status}). ${text.slice(0, 200)}…`)
      }

      await res.json()
      nav(`../../analyze/results/${a.id}`)
    } catch (err) {
      console.error(err)
      alert('Analyze failed. Check server logs.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 grid gap-6 md:grid-cols-2">
      {/* left: form */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Add the Job You’re Targeting</h1>
        <p className="text-gray-600">
          Paste the job title, company, and description. We’ll compare it against your resume.
        </p>
        <form onSubmit={analyze} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            placeholder="Job Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Company"
            value={company}
            onChange={e => setCompany(e.target.value)}
          />
          <textarea
            className="w-full border rounded p-2"
            rows={10}
            placeholder="Paste the job description"
            value={jdText}
            onChange={e => setJdText(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <button
              className={`inline-flex items-center rounded px-4 py-2 text-white bg-indigo-600 transition ${
                analyzing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-700'
              }`}
              disabled={analyzing}
              aria-busy={analyzing}
              aria-live="polite"
              type="submit"
            >
              {analyzing && (
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path
                    d="M22 12a10 10 0 0 1-10 10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {analyzing ? 'Analyzing…' : 'Analyze'}
            </button>
            <Link to="/resume" className="text-gray-600 hover:underline">
              ← Back
            </Link>
          </div>
        </form>
      </div>

      {/* right: resume snapshot */}
      <div>
        <h2 className="font-semibold mb-2">Your Resume</h2>
        <pre className="border rounded p-3 whitespace-pre-wrap text-sm">{resumePreview}</pre>
      </div>

      {/* paywall modal */}
      <SubscribeModal
        isOpen={showSubscribe}
        onClose={() => setShowSubscribe(false)}
        successUrl={`/resume`}
        redirectTo={`/resume`}
        cancelUrl={`/resume`}
      />
    </div>
  )
}
