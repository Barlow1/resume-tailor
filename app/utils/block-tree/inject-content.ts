import type {
	BlockTree,
	Block,
	InlineSegment,
} from './types'

/**
 * Given a template HTML string (with data-block-id / data-field attributes)
 * and a BlockTree, replace the text content of each marked element with
 * the current BlockTree values.
 *
 * This is a pure string operation — no DOM parser required.
 */
export function injectContent(templateHtml: string, blockTree: BlockTree): string {
	const blockMap = new Map<string, Block>()
	for (const block of blockTree.blocks) {
		blockMap.set(block.id, block)
	}

	return templateHtml.replace(
		/(<[^>]+data-block-id="([^"]+)"[^>]*data-field="([^"]+)"[^>]*>)([\s\S]*?)(<\/[a-z][a-z0-9]*>)/gi,
		(match, openTag, blockId, fieldPath, _oldContent, closeTag) => {
			const block = blockMap.get(blockId)
			if (!block) return match

			const newContent = resolveFieldPath(block, fieldPath)
			if (newContent === null) return match

			return `${openTag}${escapeHtml(newContent)}${closeTag}`
		},
	)
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function resolveFieldPath(block: Block, fieldPath: string): string | null {
	const content = block.content as Record<string, unknown>

	if (!fieldPath.includes('.')) {
		if (fieldPath === 'sectionHeader') return block.sectionHeader ?? null
		const val = content[fieldPath]
		if (typeof val === 'string') return val
		return null
	}

	const parts = fieldPath.split('.')
	let current: unknown = content

	for (const part of parts) {
		if (current == null) return null
		if (Array.isArray(current)) {
			const idx = parseInt(part, 10)
			if (isNaN(idx)) return null
			current = current[idx]
		} else if (typeof current === 'object') {
			current = (current as Record<string, unknown>)[part]
		} else {
			return null
		}
	}

	if (typeof current === 'string') return current
	if (typeof current === 'number') return String(current)

	if (Array.isArray(current)) {
		if (current.length > 0 && typeof current[0] === 'object' && 'text' in current[0]) {
			return (current as InlineSegment[]).map(s => s.text).join('')
		}
		if (current.every(item => typeof item === 'string')) {
			return current.join(', ')
		}
	}

	return null
}
