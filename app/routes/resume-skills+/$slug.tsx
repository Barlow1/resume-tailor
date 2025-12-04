import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getJobBySlug, getRelatedJobs, type Job } from "~/data/seo/utils.server.ts";
import { getSkillsProseForCategory, skillsGenericIntro, type SkillsFAQItem } from "~/data/seo/prose.ts";
import { interpolateAndRender } from "~/data/seo/interpolate.ts";

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not found", { status: 404 });
  }

  const job = getJobBySlug(slug);
  if (!job) {
    throw new Response("Not found", { status: 404 });
  }

  const relatedJobs = getRelatedJobs(job.relatedSlugs);
  const prose = getSkillsProseForCategory(job.category);

  return json(
    { job, relatedJobs, prose },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.job) {
    return [{ title: "Not Found | Resume Tailor" }];
  }

  const { job } = data;
  const title = `${job.jobTitle} Resume Skills Guide | Resume Tailor`;
  const description = `Learn how to develop and showcase skills for ${job.jobTitle} roles. Get tips on building technical skills, tools proficiency, and demonstrating expertise to employers.`;
  const url = `https://resumetailor.ai/resume-skills/${job.slug}`;

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "keywords", content: [...job.technicalSkills.slice(0, 5), ...job.tools.slice(0, 3), job.jobTitle, "resume skills", "skill development"].join(", ") },
  ];
};

function JobLdJson({ job }: { job: Job }) {
  const ldBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://resumetailor.ai",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resume Skills",
        item: "https://resumetailor.ai/resume-skills",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${job.jobTitle} Skills`,
        item: `https://resumetailor.ai/resume-skills/${job.slug}`,
      },
    ],
  };

  const ldArticle = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${job.jobTitle} Resume Skills Guide`,
    description: `Learn how to develop and showcase skills for ${job.jobTitle} roles.`,
    author: {
      "@type": "Organization",
      name: "Resume Tailor",
      url: "https://resumetailor.ai",
    },
    publisher: {
      "@type": "Organization",
      name: "Resume Tailor",
      url: "https://resumetailor.ai",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://resumetailor.ai/resume-skills/${job.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldArticle) }}
      />
    </>
  );
}

export default function ResumeSkillsSlug() {
  const { job, relatedJobs, prose } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen">
      {/* Breadcrumb */}
      <nav className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-6">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/resume-skills" className="hover:text-foreground">
              Resume Skills
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">{job.jobTitle}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <span className="text-sm font-medium text-muted-foreground">
          {job.category}
        </span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">
          {job.jobTitle} Resume Skills Guide
        </h1>
        <p
          className="mt-6 text-muted-foreground"
          dangerouslySetInnerHTML={interpolateAndRender(skillsGenericIntro, job)}
        />
        <p
          className="mt-4 text-muted-foreground"
          dangerouslySetInnerHTML={interpolateAndRender(prose.intro, job)}
        />
      </header>

      {/* Content */}
      <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pb-12">
        {/* Technical Skills */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Technical Skills to Develop</h2>
          <p
            className="text-muted-foreground mb-4"
            dangerouslySetInnerHTML={interpolateAndRender(prose.technicalSkillsContext, job)}
          />
          <div className="flex flex-wrap gap-2">
            {job.technicalSkills.map((item: string) => (
              <span
                key={item}
                className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Tools & Technologies */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Tools & Technologies to Learn</h2>
          <p
            className="text-muted-foreground mb-4"
            dangerouslySetInnerHTML={interpolateAndRender(prose.toolsContext, job)}
          />
          <div className="flex flex-wrap gap-2">
            {job.tools.map((item: string) => (
              <span
                key={item}
                className="bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Soft Skills */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Soft Skills to Cultivate</h2>
          <p
            className="text-muted-foreground mb-4"
            dangerouslySetInnerHTML={interpolateAndRender(prose.softSkillsContext, job)}
          />
          <div className="flex flex-wrap gap-2">
            {job.softSkills.map((item: string) => (
              <span
                key={item}
                className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1.5 rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Certifications */}
        {job.certifications.length > 0 && !(job.certifications.length === 1 && job.certifications[0] === "N/A") && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Certifications to Consider</h2>
            <p
              className="text-muted-foreground mb-4"
              dangerouslySetInnerHTML={interpolateAndRender(prose.certificationsContext, job)}
            />
            <div className="flex flex-wrap gap-2">
              {job.certifications.map((item: string) => (
                <span
                  key={item}
                  className="bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full text-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Example Resume Bullets */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">How to Demonstrate Your Skills</h2>
          <p className="text-muted-foreground mb-4">
            Strong resume bullets connect your skills to concrete outcomes. Here are examples of how to showcase your {job.jobTitle} capabilities with evidence:
          </p>
          <ul className="space-y-3">
            {job.exampleBullets.map((bullet: string, i: number) => (
              <li
                key={i}
                className="pl-4 border-l-2 border-primary/30 text-muted-foreground"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        {/* Skill Development Tips */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">How to Develop These Skills</h2>
          <div className="space-y-4">
            {prose.developmentTips.map((paragraph: string, i: number) => (
              <p
                key={i}
                className="text-muted-foreground"
                dangerouslySetInnerHTML={interpolateAndRender(paragraph, job)}
              />
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        {prose.faq && prose.faq.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {prose.faq.map((item: SkillsFAQItem, i: number) => (
                <details key={i} className="group border border-border rounded-lg">
                  <summary className="flex cursor-pointer items-center justify-between p-4 font-medium hover:bg-secondary/50 transition-colors rounded-lg">
                    <span dangerouslySetInnerHTML={interpolateAndRender(item.question, job)} />
                    <svg
                      className="h-5 w-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-4 pb-4">
                    <p
                      className="text-muted-foreground"
                      dangerouslySetInnerHTML={interpolateAndRender(item.answer, job)}
                    />
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="my-10 p-6 rounded-xl bg-secondary/50 border text-center">
          <h2 className="text-xl font-semibold mb-2">
            Ready to showcase your skills?
          </h2>
          <p className="text-muted-foreground mb-4">
            Use Resume Tailor to optimize your resume and highlight your {job.jobTitle} skills effectively.
          </p>
          <Link
            to={`/analyze?ref=skills&job=${job.slug}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Analyze My Resume
          </Link>
        </section>

        {/* Related Jobs */}
        {relatedJobs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Related Skills Guides</h2>
            <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {relatedJobs.map((related: Job) => (
                <li key={related.slug}>
                  <Link
                    to={`/resume-skills/${related.slug}`}
                    prefetch="intent"
                    className="block p-4 rounded-lg border bg-card hover:bg-secondary/50 transition-colors"
                  >
                    <span className="font-medium">{related.jobTitle}</span>
                    <span className="block text-sm text-muted-foreground mt-1">
                      {related.category}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <JobLdJson job={job} />
    </main>
  );
}
