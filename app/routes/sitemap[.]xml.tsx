import { getSitemapEntries, renderSitemap } from '~/utils/sitemap.server.ts'

/**
 * Generated sitemap, replacing the hand-written public/sitemap.xml that
 * listed 5 URLs and hadn't been touched since March 2024 — it was missing
 * the entire blog and both programmatic families (~100 pages).
 */
export async function loader() {
	const xml = renderSitemap(await getSitemapEntries())

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400',
			'Content-Length': String(Buffer.byteLength(xml)),
		},
	})
}
