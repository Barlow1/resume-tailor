import { json, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getAllJobs, getAllCategories, type Job } from "~/data/seo/utils.server.ts";

export async function loader() {
  const jobs = getAllJobs();
  const categories = getAllCategories();

  // Group jobs by category
  const jobsByCategory = categories.reduce<Record<string, Job[]>>(
    (acc: Record<string, Job[]>, category: string) => {
      acc[category] = jobs.filter((job: Job) => job.category === category);
      return acc;
    },
    {}
  );

  return json(
    { jobs, categories, jobsByCategory, total: jobs.length },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = "Resume Keywords by Job Title | Resume Tailor";
  const description =
    "Find the best resume keywords for your job title. ATS-optimized keywords, skills, and action verbs for 50+ job titles to help you land more interviews.";
  const url = "https://resumetailor.ai/resume-keywords";

  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
};

function KeywordsLdJson({ jobs }: { jobs: Job[] }) {
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
        name: "Resume Keywords",
        item: "https://resumetailor.ai/resume-keywords",
      },
    ],
  };

  const ldItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Resume Keywords by Job Title",
    description: "ATS-optimized resume keywords for 50+ job titles",
    numberOfItems: jobs.length,
    itemListElement: jobs.slice(0, 20).map((job, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://resumetailor.ai/resume-keywords/${job.slug}`,
      name: `${job.jobTitle} Resume Keywords`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldItemList) }}
      />
    </>
  );
}

export default function ResumeKeywordsIndex() {
  const { jobs, categories, jobsByCategory, total } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Resume Keywords by Job Title
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Find ATS-optimized keywords, skills, and action verbs for {total} job titles.
          Use these to tailor your resume and land more interviews.
        </p>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
        {categories.map((category: string) => (
          <div key={category} className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">{category}</h2>
            <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {jobsByCategory[category]?.map((job: Job) => (
                <li key={job.slug}>
                  <Link
                    to={`/resume-keywords/${job.slug}`}
                    prefetch="intent"
                    className="block p-4 rounded-lg border bg-card hover:bg-secondary/50 transition-colors"
                  >
                    <span className="font-medium">{job.jobTitle}</span>
                    <span className="block text-sm text-muted-foreground mt-1">
                      {job.technicalSkills.slice(0, 3).join(", ")}...
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <KeywordsLdJson jobs={jobs} />
    </main>
  );
}
