/**
 * Keyword Tiering Utilities
 *
 * Parses extractedKeywords from the database into tiered (primary/secondary)
 * or flat formats. Handles both legacy (plain array) and new tiered shapes.
 *
 * Legacy format:  ["kw1", "kw2", ...]
 * Tiered format:  { "keywords": ["kw1", ...], "primary": ["kw1", "kw2"] }
 */

export interface TieredKeywords {
	all: string[]       // full flat list
	primary: string[]   // 3-5 must-haves
	secondary: string[] // the rest
}

interface TieredShape {
	keywords: unknown[]
	primary?: unknown[]
}

function isTieredShape(v: unknown): v is TieredShape {
	return v !== null && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as TieredShape).keywords)
}

/**
 * Parse extractedKeywords into tiered format.
 * - Plain array (legacy) → all secondary, no primary
 * - { keywords, primary } → tiered
 */
export function parseTieredKeywords(raw: string | null): TieredKeywords | null {
	if (!raw) return null

	try {
		const parsed: unknown = JSON.parse(raw)

		if (Array.isArray(parsed)) {
			// Legacy format: all keywords are secondary
			const all = parsed.filter((k): k is string => typeof k === 'string')
			if (all.length === 0) return null
			return { all, primary: [], secondary: all }
		}

		if (isTieredShape(parsed)) {
			const all = parsed.keywords.filter((k): k is string => typeof k === 'string')
			const primary = Array.isArray(parsed.primary)
				? parsed.primary.filter((k): k is string => typeof k === 'string' && all.includes(k))
				: []
			const primarySet = new Set(primary)
			const secondary = all.filter(k => !primarySet.has(k))
			if (all.length === 0) return null
			return { all, primary, secondary }
		}

		return null
	} catch {
		return null
	}
}

/**
 * Parse extractedKeywords into a flat array (for consumers that don't need tiers).
 * Works with both legacy and tiered formats.
 */
export function parseKeywordsFlat(raw: string | null): string[] | null {
	if (!raw) return null

	try {
		const parsed: unknown = JSON.parse(raw)

		if (Array.isArray(parsed)) {
			const keywords = parsed.filter((k): k is string => typeof k === 'string')
			return keywords.length > 0 ? keywords : null
		}

		if (isTieredShape(parsed)) {
			const keywords = parsed.keywords.filter((k): k is string => typeof k === 'string')
			return keywords.length > 0 ? keywords : null
		}

		return null
	} catch {
		return null
	}
}
