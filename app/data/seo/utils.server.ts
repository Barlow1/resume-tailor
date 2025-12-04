import jobsData from "../seo/jobs.json";

export type Job = {
  slug: string;
  jobTitle: string;
  category: string;
  metaDescription: string;
  technicalSkills: string[];
  tools: string[];
  softSkills: string[];
  certifications: string[];
  actionVerbs: string[];
  exampleBullets: string[];
  relatedSlugs: string[];
};

const jobs: Job[] = jobsData as Job[];

/**
 * Get all jobs sorted alphabetically by job title
 */
export function getAllJobs(): Job[] {
  return [...jobs].sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
}

/**
 * Get a single job by its slug
 */
export function getJobBySlug(slug: string): Job | undefined {
  return jobs.find((job) => job.slug === slug);
}

/**
 * Get all jobs in a specific category
 */
export function getJobsByCategory(category: string): Job[] {
  return jobs
    .filter((job) => job.category.toLowerCase() === category.toLowerCase())
    .sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
}

/**
 * Get related jobs by slug array
 */
export function getRelatedJobs(relatedSlugs: string[]): Job[] {
  return relatedSlugs
    .map((slug) => getJobBySlug(slug))
    .filter((job): job is Job => job !== undefined);
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  const categories = new Set(jobs.map((job) => job.category));
  return Array.from(categories).sort();
}

/**
 * Get all job slugs (useful for sitemap generation)
 */
export function getAllJobSlugs(): string[] {
  return jobs.map((job) => job.slug);
}
