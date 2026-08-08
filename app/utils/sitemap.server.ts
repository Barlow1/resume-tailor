import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { getAllJobSlugs } from '~/data/seo/utils.server.ts'

export const SITE_URL = 'https://resumetailor.ai'

export type SitemapEntry = {
	/** Path with a leading slash, e.g. "/reverse-recruiter" */
	loc: string
	/** 0.0–1.0. Relative to other URLs on this site only. */
	priority: number
	/** ISO date. Omitted when we don't genuinely know — a fabricated
	 *  lastmod is worse than none, since Google learns to distrust it. */
	lastmod?: string
}

/**
 * Hand-maintained public pages.
 *
 * Deliberately excluded:
 *  - /login, /signup, /forgot-password — auth screens with no search intent.
 *    (They were in the old static sitemap. Dropping them doesn't deindex
 *    anything; it just stops spending crawl budget advertising them.)
 *  - /welcome, /builder/* app screens, and anything behind auth.
 */
const STATIC_PAGES: SitemapEntry[] = [
	{ loc: '/', priority: 1.0 },
	{ loc: '/reverse-recruiter', priority: 0.9 },
	{ loc: '/ai-resume-builder', priority: 0.8 },
	{ loc: '/analyze', priority: 0.8 },
	{ loc: '/builder', priority: 0.7 },
	{ loc: '/pricing', priority: 0.7 },
	{ loc: '/blog', priority: 0.7 },
	{ loc: '/resume-keywords', priority: 0.7 },
	{ loc: '/resume-skills', priority: 0.7 },
	{ loc: '/about', priority: 0.5 },
	{ loc: '/support', priority: 0.4 },
	{ loc: '/privacy', priority: 0.2 },
	{ loc: '/tos', priority: 0.2 },
]

/**
 * Blog slugs + publish dates, read from the MDX files on disk.
 *
 * NOTE: mirrors the file-discovery rules in app/routes/blog+/_index.tsx.
 * If the blog's naming convention changes, both need updating.
 */
async function getBlogEntries(): Promise<SitemapEntry[]> {
	const dir = path.join(process.cwd(), 'app', 'routes', 'blog+')
	let dirents
	try {
		dirents = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return []
	}

	const files = dirents
		.filter(
			d =>
				d.isFile() &&
				d.name.endsWith('.mdx') &&
				(d.name.startsWith('_blog.') ||
					(!d.name.startsWith('_') && !d.name.startsWith('$'))),
		)
		.map(d => d.name)

	const entries: SitemapEntry[] = []
	for (const file of files) {
		try {
			const raw = await fs.readFile(path.join(dir, file), 'utf8')
			const { data } = matter(raw) as { data: any }
			const fileSlug = file.replace(/\.mdx$/i, '').replace(/^_blog\./, '')
			const slug = String(data?.slug ?? fileSlug)
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-|-$/g, '')
			if (!slug) continue

			const parsed = data?.date ? new Date(data.date) : null
			const lastmod =
				parsed && !Number.isNaN(parsed.getTime())
					? parsed.toISOString().slice(0, 10)
					: undefined

			entries.push({ loc: `/blog/${slug}`, priority: 0.6, lastmod })
		} catch {
			continue
		}
	}
	return entries
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
	const jobSlugs = getAllJobSlugs()

	return [
		...STATIC_PAGES,
		...(await getBlogEntries()),
		// Two programmatic families, one row per job title in app/data/seo/jobs.json.
		...jobSlugs.map(slug => ({
			loc: `/resume-keywords/${slug}`,
			priority: 0.6,
		})),
		...jobSlugs.map(slug => ({
			loc: `/resume-skills/${slug}`,
			priority: 0.6,
		})),
	]
}

function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

export function renderSitemap(entries: SitemapEntry[]): string {
	const urls = entries
		.map(({ loc, priority, lastmod }) => {
			const lines = [`    <loc>${escapeXml(SITE_URL + loc)}</loc>`]
			if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`)
			lines.push(`    <priority>${priority.toFixed(2)}</priority>`)
			return `  <url>\n${lines.join('\n')}\n  </url>`
		})
		.join('\n')

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
