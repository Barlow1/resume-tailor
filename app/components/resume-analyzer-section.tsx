import { Link } from "@remix-run/react";

export function ResumeAnalyzerSection() {
  return (
    <section id="resume-analyzer" className="py-2 scroll-mt-24">
      <h2 className="text-3xl md:text-4xl font-bold">
        AI Resume Analyzer (ATS-Friendly)
      </h2>
      <p className="mt-4 text-gray-600 max-w-3xl">
        Run your resume through our AI resume analyzer for an ATS readiness check,
        keyword match against the job description, and a clear 0–100 match score.
        Instantly see matched vs. missing skills, responsibility alignment, and
        where to add metrics—so you can apply with confidence.
      </p>

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        <li>✔️ <strong>ATS resume scanner</strong> flags formatting issues & missing keywords</li>
        <li>✔️ <strong>Keyword & skills map</strong> shows matched vs. missing hard/soft skills</li>
        <li>✔️ <strong>Responsibilities alignment</strong> (strong / partial / gap) with evidence</li>
        <li>✔️ <strong>Metrics extraction</strong> surfaces quantifiable results to add (e.g., “↑ conversions 28%”)</li>
        <li>✔️ <strong>Objective match score</strong> (0–100) to know when you’re ready to submit</li>
      </ul>

      <div className="mt-8">
        <Link
          to="/analyze"
          className="inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
        >
          Analyze My Resume
        </Link>
      </div>
    </section>
  );
}
