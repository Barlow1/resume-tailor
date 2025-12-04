import type { LoaderFunctionArgs } from "@remix-run/node";
import { getAllJobSlugs } from "~/data/seo/utils.server.ts";

const BASE_URL = "https://resumetailor.ai";

export async function loader({ request }: LoaderFunctionArgs) {
  const jobSlugs = getAllJobSlugs();

  // Static pages
  const staticPages = [
    { loc: "/", priority: "1.00", changefreq: "weekly" },
    { loc: "/login", priority: "0.80", changefreq: "monthly" },
    { loc: "/signup", priority: "0.80", changefreq: "monthly" },
    { loc: "/forgot-password", priority: "0.60", changefreq: "monthly" },
    { loc: "/ai-resume-builder", priority: "0.90", changefreq: "weekly" },
    { loc: "/blog", priority: "0.90", changefreq: "daily" },
    { loc: "/resume-keywords", priority: "0.90", changefreq: "weekly" },
    { loc: "/resume-skills", priority: "0.90", changefreq: "weekly" },
    { loc: "/resume-summary", priority: "0.90", changefreq: "weekly" },
  ];

  // Generate URLs for all 3 programmatic SEO patterns
  // resume-keywords (active)
  const keywordPages = jobSlugs.map((slug: string) => ({
    loc: `/resume-keywords/${slug}`,
    priority: "0.80",
    changefreq: "monthly",
  }));

  // resume-skills (placeholder for future)
  const skillPages = jobSlugs.map((slug: string) => ({
    loc: `/resume-skills/${slug}`,
    priority: "0.80",
    changefreq: "monthly",
  }));

  // resume-summary (placeholder for future)
  const summaryPages = jobSlugs.map((slug: string) => ({
    loc: `/resume-summary/${slug}`,
    priority: "0.80",
    changefreq: "monthly",
  }));

  const allPages = [...staticPages, ...keywordPages, ...skillPages, ...summaryPages];

  const today = new Date().toISOString().split("T")[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
