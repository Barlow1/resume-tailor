import { Link } from "@remix-run/react";

export function OutreachSection() {
  return (
    <section id="outreach" className="py-2 scroll-mt-24">
      <h2 className="text-3xl md:text-4xl font-bold">
        AI Outreach: Cold Emails & LinkedIn Messages
      </h2>
      <p className="mt-4 text-gray-600 max-w-3xl">
        Turn your tailored resume into personalized outreach. Generate recruiter emails,
        hiring-manager cold emails, and LinkedIn messages that reference the job description
        and your achievements—plus follow-up sequences that get replies.
      </p>

      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        <li>✔️ <strong>Personalized cold email generator</strong> (subject lines + body)</li>
        <li>✔️ <strong>LinkedIn outreach templates</strong> (connection, InMail, follow-ups)</li>
        <li>✔️ <strong>Follow-up timing</strong> suggestions (1–2 polite nudges)</li>
        <li>✔️ <strong>Tone controls</strong>: concise, warm, or professional</li>
        <li>✔️ <strong>Copy-and-send ready</strong> for your email or LinkedIn client</li>
      </ul>

      <div className="mt-8">
        <Link
          to="/outreach"
          className="inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
        >
          Generate Outreach Messages
        </Link>
      </div>
    </section>
  );
}
