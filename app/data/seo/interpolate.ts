import type { Job } from "./utils.server.ts";

/**
 * Interpolates template variables in prose strings with job data.
 *
 * Supported patterns:
 * - {jobTitle} -> job.jobTitle
 * - {category} -> job.category
 * - {technicalSkills[0]} -> job.technicalSkills[0]
 * - {technicalSkills[1]} -> job.technicalSkills[1]
 * - {tools[0]} -> job.tools[0]
 * - {tools.slice(0,3).join(", ")} -> job.tools.slice(0,3).join(", ")
 * - {softSkills[0]} -> job.softSkills[0]
 * - {actionVerbs[0]} -> job.actionVerbs[0]
 * - {actionVerbs[1]} -> job.actionVerbs[1]
 */
export function interpolate(template: string, job: Job): string {
  return template
    // Handle slice().join() patterns first (most specific)
    .replace(/\{tools\.slice\((\d+),(\d+)\)\.join\("([^"]+)"\)\}/g, (_, start, end, separator) => {
      const startIdx = parseInt(start, 10);
      const endIdx = parseInt(end, 10);
      const sliced = job.tools.slice(startIdx, endIdx);
      return sliced.length > 0 ? sliced.join(separator) : job.tools[0] || "";
    })
    .replace(/\{technicalSkills\.slice\((\d+),(\d+)\)\.join\("([^"]+)"\)\}/g, (_, start, end, separator) => {
      const startIdx = parseInt(start, 10);
      const endIdx = parseInt(end, 10);
      const sliced = job.technicalSkills.slice(startIdx, endIdx);
      return sliced.length > 0 ? sliced.join(separator) : job.technicalSkills[0] || "";
    })
    // Handle array index access patterns
    .replace(/\{technicalSkills\[(\d+)\]\}/g, (_, index) => {
      const idx = parseInt(index, 10);
      return job.technicalSkills[idx] || job.technicalSkills[0] || "";
    })
    .replace(/\{tools\[(\d+)\]\}/g, (_, index) => {
      const idx = parseInt(index, 10);
      return job.tools[idx] || job.tools[0] || "";
    })
    .replace(/\{softSkills\[(\d+)\]\}/g, (_, index) => {
      const idx = parseInt(index, 10);
      return job.softSkills[idx] || job.softSkills[0] || "";
    })
    .replace(/\{actionVerbs\[(\d+)\]\}/g, (_, index) => {
      const idx = parseInt(index, 10);
      return job.actionVerbs[idx] || job.actionVerbs[0] || "";
    })
    .replace(/\{certifications\[(\d+)\]\}/g, (_, index) => {
      const idx = parseInt(index, 10);
      const cert = job.certifications[idx] || job.certifications[0];
      return cert && cert !== "N/A" ? cert : "";
    })
    .replace(/\{exampleBullets\[(\d+)\]\}/g, (_, index) => {
      const idx = parseInt(index, 10);
      return job.exampleBullets[idx] || job.exampleBullets[0] || "";
    })
    // Handle simple property access
    .replace(/\{jobTitle\}/g, job.jobTitle)
    .replace(/\{category\}/g, job.category)
    .replace(/\{slug\}/g, job.slug)
    .replace(/\{metaDescription\}/g, job.metaDescription);
}

/**
 * Converts markdown bold (**text**) to HTML <strong> tags.
 * Returns an object with __html for use with dangerouslySetInnerHTML.
 */
export function renderMarkdownBold(text: string): { __html: string } {
  const html = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return { __html: html };
}

/**
 * Combined utility: interpolate variables and render markdown.
 */
export function interpolateAndRender(template: string, job: Job): { __html: string } {
  const interpolated = interpolate(template, job);
  return renderMarkdownBold(interpolated);
}
