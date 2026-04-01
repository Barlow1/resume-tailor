/**
 * Preprocesses OOXML to reduce token count before sending to AI.
 *
 * Strips tracking attributes, proofing elements, latent styles, and other
 * noise while preserving every design-relevant attribute (fonts, sizes,
 * colors, spacing, borders, numbering, alignment, text transforms).
 *
 * Target: 60-70% token reduction.
 */

export interface RawDocxXml {
	documentXml: string
	stylesXml: string
	numberingXml: string
	fontTableXml: string
	themeXml: string
	relsXml: string // word/_rels/document.xml.rels — hyperlink targets
}

export interface CleanedDocxXml {
	cleanedDocumentXml: string
	cleanedStylesXml: string
	numberingXml: string // pass through, already compact
	fontTableXml: string // pass through, needed for validation
	themeXml: string // pass through
	relsXml: string // pass through, needed for hyperlink URLs
}

/** Attributes that are purely revision-tracking noise. */
const NOISE_ATTRS = [
	'w:rsidR',
	'w:rsidRDefault',
	'w:rsidRPr',
	'w:rsidP',
	'w:rsidSect',
	'w:rsidDel',
	'w:rsidTr',
	'w14:paraId',
	'w14:textId',
	'mc:Ignorable',
]

/** Elements that carry no design information. */
const NOISE_ELEMENTS = [
	'w:proofErr',
	'w:bookmarkStart',
	'w:bookmarkEnd',
	'w:lastRenderedPageBreak',
]

/**
 * Remove noisy attributes from XML string.
 * Handles both `attr="value"` patterns.
 */
function stripNoiseAttributes(xml: string): string {
	let result = xml
	for (const attr of NOISE_ATTRS) {
		// Match attr="value" with optional preceding space
		const regex = new RegExp(`\\s+${attr.replace(':', ':')}="[^"]*"`, 'g')
		result = result.replace(regex, '')
	}
	return result
}

/**
 * Remove noisy elements (self-closing and open/close pairs).
 */
function stripNoiseElements(xml: string): string {
	let result = xml
	for (const el of NOISE_ELEMENTS) {
		// Self-closing: <w:proofErr ... />
		const selfClosing = new RegExp(`<${el}[^>]*/\\s*>`, 'g')
		result = result.replace(selfClosing, '')

		// Open+close pair: <w:bookmarkStart ...>...</w:bookmarkStart>
		const openClose = new RegExp(`<${el}[^>]*>[\\s\\S]*?</${el}>`, 'g')
		result = result.replace(openClose, '')
	}
	return result
}

/**
 * Remove empty w:rPr elements (no children = no formatting).
 */
function stripEmptyRPr(xml: string): string {
	return xml.replace(/<w:rPr\s*\/>/g, '').replace(/<w:rPr>\s*<\/w:rPr>/g, '')
}

/**
 * Shorten massive namespace declarations to compact aliases.
 * The first <w:document ...> or <w:styles ...> tag can contain 500+ chars
 * of namespace URIs that the AI doesn't need.
 */
function compactNamespaces(xml: string): string {
	// Replace the opening tag's long namespace list with a short version
	return xml.replace(
		/<(w:(?:document|styles|numbering|fonts))\s+[^>]*xmlns[^>]*>/,
		(match, tag) => `<${tag}>`,
	)
}

/**
 * Extract the list of style IDs actually referenced in document.xml.
 */
function extractReferencedStyleIds(documentXml: string): Set<string> {
	const ids = new Set<string>()
	const pStyleRegex = /w:pStyle\s+w:val="([^"]*)"/g
	const rStyleRegex = /w:rStyle\s+w:val="([^"]*)"/g

	let match
	while ((match = pStyleRegex.exec(documentXml)) !== null) {
		ids.add(match[1])
	}
	while ((match = rStyleRegex.exec(documentXml)) !== null) {
		ids.add(match[1])
	}

	// Always keep these built-in styles if they exist
	ids.add('Normal')
	ids.add('DefaultParagraphFont')
	ids.add('Hyperlink')

	return ids
}

/**
 * Strip latentStyles and unreferenced style definitions from styles.xml.
 */
function cleanStylesXml(
	stylesXml: string,
	referencedIds: Set<string>,
): string {
	let result = stylesXml

	// Remove the entire w:latentStyles block (huge, irrelevant)
	result = result.replace(/<w:latentStyles[\s\S]*?<\/w:latentStyles>/g, '')

	// Remove style definitions not referenced in document.xml.
	// Match each <w:style ...>...</w:style> block and check its w:styleId.
	result = result.replace(
		/<w:style\s[^>]*>[\s\S]*?<\/w:style>/g,
		(styleBlock) => {
			const idMatch = styleBlock.match(/w:styleId="([^"]*)"/)
			if (!idMatch) return styleBlock // keep if no ID (shouldn't happen)

			const styleId = idMatch[1]
			// Keep docDefaults-related styles (they have type="paragraph" or type="character" with default)
			const isDefault = styleBlock.includes('w:default="1"')
			if (isDefault || referencedIds.has(styleId)) {
				return styleBlock
			}
			return '' // remove unreferenced style
		},
	)

	return result
}

/**
 * Clean document.xml: strip noise, compact namespaces, remove empty formatting.
 */
function cleanDocumentXml(documentXml: string): string {
	let result = documentXml
	result = stripNoiseAttributes(result)
	result = stripNoiseElements(result)
	result = stripEmptyRPr(result)
	result = compactNamespaces(result)
	// Collapse excessive whitespace (multiple newlines/spaces between tags)
	result = result.replace(/>\s{2,}</g, '>\n<')
	return result
}

export function preprocessXml(rawXml: RawDocxXml): CleanedDocxXml {
	const referencedStyleIds = extractReferencedStyleIds(rawXml.documentXml)

	const cleanedDocumentXml = cleanDocumentXml(rawXml.documentXml)
	let cleanedStylesXml = cleanStylesXml(
		rawXml.stylesXml,
		referencedStyleIds,
	)
	cleanedStylesXml = stripNoiseAttributes(cleanedStylesXml)
	cleanedStylesXml = compactNamespaces(cleanedStylesXml)
	cleanedStylesXml = cleanedStylesXml.replace(/>\s{2,}</g, '>\n<')

	return {
		cleanedDocumentXml,
		cleanedStylesXml,
		numberingXml: rawXml.numberingXml,
		fontTableXml: rawXml.fontTableXml,
		themeXml: rawXml.themeXml,
		relsXml: rawXml.relsXml,
	}
}
