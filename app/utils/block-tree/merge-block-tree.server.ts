/**
 * Merges an AI-generated BlockTree with XML-derived data.
 *
 * Precedence rules (documented contract):
 *
 * | Field                          | Source           | Why                                           |
 * |--------------------------------|------------------|-----------------------------------------------|
 * | pageSettings                   | XML parser       | Exact math from w:sectPr                      |
 * | fonts[] (FontMapping + URLs)   | matchFont()      | Maps AI's font names to Google Fonts URLs     |
 * | globalTokens.fontFamily        | AI               | AI reads XML, picks up font intent            |
 * | globalTokens.* (other)         | AI               | Colors, sizes, spacing from XML context       |
 * | blocks[].tokens.*              | AI               | Per-block styling from XML context            |
 * | blocks[].content               | AI               | Structured content extraction                 |
 * | layout, layoutConfig           | AI               | Layout detection from spatial analysis        |
 * | regionStyles                   | AI               | Region-level styling                          |
 * | decorations                    | AI               | Border/accent detection from XML              |
 */

import type { BlockTree, FontMapping } from './types'
import { matchFont } from './font-matching'

export interface DocxDerivedData {
	pageSettings: BlockTree['pageSettings']
}

/**
 * Collect all unique font family names from the AI's BlockTree.
 * Looks in globalTokens, all block-level tokens, and header element tokens.
 */
function collectAIFontFamilies(aiBlockTree: BlockTree): Set<string> {
	const fonts = new Set<string>()

	if (aiBlockTree.globalTokens.fontFamily) {
		fonts.add(aiBlockTree.globalTokens.fontFamily)
	}

	for (const block of aiBlockTree.blocks) {
		if (block.tokens.fontFamily) {
			fonts.add(block.tokens.fontFamily)
		}

		// Check header element tokens
		if (block.type === 'header') {
			const content = block.content as {
				headerTokens?: {
					name?: { fontFamily?: string }
					role?: { fontFamily?: string }
					contact?: { fontFamily?: string }
				}
			}
			if (content.headerTokens?.name?.fontFamily) {
				fonts.add(content.headerTokens.name.fontFamily)
			}
			if (content.headerTokens?.role?.fontFamily) {
				fonts.add(content.headerTokens.role.fontFamily)
			}
			if (content.headerTokens?.contact?.fontFamily) {
				fonts.add(content.headerTokens.contact.fontFamily)
			}
		}
	}

	return fonts
}

/**
 * Build FontMapping[] from AI's font names via matchFont().
 * Each unique font the AI mentioned gets resolved to a Google Fonts URL.
 */
function buildFontMappings(fontFamilies: Set<string>): FontMapping[] {
	return Array.from(fontFamilies).map(fontName => matchFont(fontName))
}

/**
 * Merge AI's BlockTree with XML-derived pageSettings and font URL resolution.
 *
 * Takes AI's BlockTree as the base, overwrites pageSettings from XML parser,
 * and builds the fonts[] array by running matchFont() on every font the AI mentioned.
 */
export function mergeBlockTree(
	aiBlockTree: BlockTree,
	docxData: DocxDerivedData,
): BlockTree {
	const fontFamilies = collectAIFontFamilies(aiBlockTree)
	const fonts = buildFontMappings(fontFamilies)

	return {
		// From AI
		layout: aiBlockTree.layout,
		layoutConfig: aiBlockTree.layoutConfig,
		regionStyles: aiBlockTree.regionStyles,
		globalTokens: aiBlockTree.globalTokens,
		blocks: aiBlockTree.blocks,

		// From matchFont() keyed off AI's font names
		fonts,

		// From XML parser (exact math)
		pageSettings: docxData.pageSettings,
	}
}
