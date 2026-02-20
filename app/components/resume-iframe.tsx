import {
	useRef,
	useEffect,
	useMemo,
	useCallback,
	useState,
	forwardRef,
	useImperativeHandle,
} from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { generateResumeHtml } from '~/utils/generate-resume-html.ts'
import type { ResumeData } from '~/utils/builder-resume.server.ts'

export type StructuralAction =
	| { type: 'addBullet'; experienceId: string }
	| { type: 'deleteBullet'; experienceId: string; bulletIndex: number }
	| { type: 'reorderBullet'; experienceId: string; oldIndex: number; newIndex: number }
	| { type: 'addExperience' }
	| { type: 'addEducation' }
	| { type: 'addSkill' }
	| { type: 'addHobby' }
	| { type: 'deleteExperience'; experienceId: string }
	| { type: 'deleteEducation'; educationId: string }
	| { type: 'deleteSkill'; skillId: string }
	| { type: 'deleteHobby'; hobbyId: string }
	| { type: 'reorderSection'; oldIndex: number; newIndex: number }
	| { type: 'toggleSection'; sectionId: string }

export type HoveredElementInfo = {
	type: 'section' | 'experience' | 'education' | 'bullet' | 'skill' | 'hobby'
	sectionId?: string
	experienceId?: string
	educationId?: string
	bulletIndex?: number
	skillId?: string
	hobbyId?: string
	rect: {
		top: number
		left: number
		width: number
		height: number
	}
}

interface ResumeIframeProps {
	formData: ResumeData
	sectionOrder: string[]
	onFieldChange: (fieldPath: string, value: string) => void
	onStructuralAction: (action: StructuralAction) => void
	onHoverElement?: (info: HoveredElementInfo | null) => void
	className?: string
	canvasBackground?: string
}

export interface ResumeIframeHandle {
	flushPendingEdits: () => void
	forceRerender: (focusFieldAfter?: string) => void
	/** Signal that a structural change is coming so the next html update re-renders even if a field is focused */
	markStructuralUpdate: () => void
	/** Scroll the resume canvas to bring a section into view */
	scrollToSection: (sectionId: string) => void
}

const PAGE_HEIGHT = 1056
const PAGE_PADDING = 48

function calculatePageBreaks(doc: Document) {
	const resume = doc.querySelector('.resume') as HTMLElement
	if (!resume) return

	// Remove existing page gaps
	resume.querySelectorAll('.page-gap').forEach(el => el.remove())

	const CONTENT_HEIGHT = PAGE_HEIGHT - 2 * PAGE_PADDING // 960px

	let currentPageUsed = 0
	const children = Array.from(resume.children) as HTMLElement[]

	for (const child of children) {
		if (child.classList.contains('page-gap')) continue
		if (child.classList.contains('page-break-marker')) continue

		const childHeight = child.offsetHeight
		const remainingOnPage = CONTENT_HEIGHT - currentPageUsed

		if (childHeight > remainingOnPage && currentPageUsed > 0) {
			const gap = doc.createElement('div')
			gap.className = 'page-gap'
			gap.style.cssText = 'pointer-events: none;'
			gap.innerHTML = `
				<div style="height: ${remainingOnPage + PAGE_PADDING}px; background: transparent;"></div>
				<div style="height: 32px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; font-family: system-ui, sans-serif; margin: 0 -${PAGE_PADDING}px; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db;">Page break</div>
				<div style="height: ${PAGE_PADDING}px; background: transparent;"></div>
			`
			resume.insertBefore(gap, child)
			currentPageUsed = childHeight
		} else {
			currentPageUsed += childHeight
		}

		while (currentPageUsed >= CONTENT_HEIGHT) {
			currentPageUsed -= CONTENT_HEIGHT
		}
	}
}

export const ResumeIframe = forwardRef<ResumeIframeHandle, ResumeIframeProps>(
	function ResumeIframe({ formData, sectionOrder, onFieldChange, onStructuralAction, onHoverElement, className, canvasBackground }, ref) {
		const iframeRef = useRef<HTMLIFrameElement>(null)
		const editingFieldRef = useRef<string | null>(null)
		const pendingFocusRef = useRef<string | null>(null)
		const isStructuralUpdateRef = useRef(false)
		const isComposingRef = useRef(false)
		const observerRef = useRef<MutationObserver | null>(null)
		const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
		const pageBreakTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
		const [srcdoc, setSrcdoc] = useState('')

		// Stable ref for onHoverElement to avoid re-attaching listeners
		const onHoverElementRef = useRef(onHoverElement)
		onHoverElementRef.current = onHoverElement

		// Debounced field update — updates formData in parent without iframe re-render
		const debouncedFieldUpdate = useDebouncedCallback(
			(field: string, value: string) => {
				onFieldChange(field, value)
			},
			300,
		)

		const flushPendingEdits = useCallback(() => {
			debouncedFieldUpdate.flush()
		}, [debouncedFieldUpdate])

		const forceRerender = useCallback((focusFieldAfter?: string) => {
			editingFieldRef.current = null
			isStructuralUpdateRef.current = true
			pendingFocusRef.current = focusFieldAfter || null
			// Clear toolbar on structural update
			onHoverElementRef.current?.(null)
			// Trigger re-render by generating fresh HTML
			const freshHtml = generateResumeHtml(formData, sectionOrder, { editable: true })
			setSrcdoc(freshHtml)
		}, [formData, sectionOrder])

		const markStructuralUpdate = useCallback(() => {
			editingFieldRef.current = null
			isStructuralUpdateRef.current = true
		}, [])

		const scrollToSection = useCallback((sectionId: string) => {
			const doc = iframeRef.current?.contentDocument
			if (!doc) return
			const el = doc.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement
			if (!el) return
			const scrollContainer = iframeRef.current?.parentElement?.parentElement
			if (!scrollContainer) return
			// el.offsetTop is the element's distance from the top of the iframe document.
			// The scroll container has 32px padding-top, so subtract a bit for a visible gap.
			scrollContainer.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: 'smooth' })
		}, [])

		useImperativeHandle(ref, () => ({
			flushPendingEdits,
			forceRerender,
			markStructuralUpdate,
			scrollToSection,
		}), [flushPendingEdits, forceRerender, markStructuralUpdate, scrollToSection])

		// Generate HTML
		const html = useMemo(
			() => generateResumeHtml(formData, sectionOrder, { editable: true }),
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[formData, sectionOrder],
		)

		// Dual-mode update: skip re-render during text edits, always re-render for structural
		useEffect(() => {
			if (isStructuralUpdateRef.current) {
				isStructuralUpdateRef.current = false
				setSrcdoc(html)
				return
			}
			if (editingFieldRef.current) {
				return
			}
			setSrcdoc(html)
		}, [html])

		// Resize iframe to match content
		const resizeIframe = useCallback(() => {
			const doc = iframeRef.current?.contentDocument
			const body = doc?.body
			if (body && iframeRef.current) {
				const newHeight = body.scrollHeight
				iframeRef.current.style.height = newHeight + 'px'
			}
		}, [])

		// Compute rect of an element inside the iframe, translated to viewport coordinates
		const computeRect = useCallback((el: HTMLElement): HoveredElementInfo['rect'] => {
			const elRect = el.getBoundingClientRect()
			const iframeRect = iframeRef.current!.getBoundingClientRect()
			return {
				top: iframeRect.top + elRect.top,
				left: iframeRect.left + elRect.left,
				width: elRect.width,
				height: elRect.height,
			}
		}, [])

		// Resolve toolbar info from a DOM element inside the iframe
		const resolveToolbarInfo = useCallback((target: HTMLElement): HoveredElementInfo | null => {
			const bulletLi = target.closest('[data-bullet-index]') as HTMLElement
			const expEntry = target.closest('[data-experience-id]') as HTMLElement
			const eduEntry = target.closest('[data-education-id]') as HTMLElement
			const section = target.closest('[data-section-id]') as HTMLElement
			const skillItem = target.closest('[data-skill-id]') as HTMLElement
			const hobbyItem = target.closest('[data-hobby-id]') as HTMLElement

			if (bulletLi && expEntry) {
				return {
					type: 'bullet',
					experienceId: expEntry.dataset.experienceId!,
					sectionId: 'experience',
					bulletIndex: parseInt(bulletLi.dataset.bulletIndex!),
					rect: computeRect(bulletLi),
				}
			}
			if (expEntry) {
				return {
					type: 'experience',
					experienceId: expEntry.dataset.experienceId!,
					sectionId: 'experience',
					rect: computeRect(expEntry),
				}
			}
			if (eduEntry) {
				return {
					type: 'education',
					educationId: eduEntry.dataset.educationId!,
					sectionId: 'education',
					rect: computeRect(eduEntry),
				}
			}
			if (skillItem && section) {
				return {
					type: 'skill',
					skillId: skillItem.dataset.skillId!,
					sectionId: section.dataset.sectionId!,
					rect: computeRect(skillItem),
				}
			}
			if (hobbyItem && section) {
				return {
					type: 'hobby',
					hobbyId: hobbyItem.dataset.hobbyId!,
					sectionId: section.dataset.sectionId!,
					rect: computeRect(hobbyItem),
				}
			}
			if (section) {
				return {
					type: 'section',
					sectionId: section.dataset.sectionId!,
					rect: computeRect(section),
				}
			}
			return null
		}, [computeRect])

		// Event bridge — set up on each iframe load
		const handleIframeLoad = useCallback(() => {
			const iframe = iframeRef.current
			const doc = iframe?.contentDocument
			if (!doc) return

			// Disconnect previous MutationObserver
			if (observerRef.current) {
				observerRef.current.disconnect()
				observerRef.current = null
			}

			// --- TEXT EDITING EVENTS (capture phase) ---

			// Focus — show toolbar based on focused element's structural context
			doc.addEventListener('focus', (e) => {
				const el = e.target as HTMLElement
				const field = el.dataset?.field
				if (!field) return

				editingFieldRef.current = field
				clearTimeout(blurTimeoutRef.current)
				clearTimeout(pageBreakTimeoutRef.current)

				const info = resolveToolbarInfo(el)
				onHoverElementRef.current?.(info)
			}, true)

			// Input
			doc.addEventListener('input', (e) => {
				if (isComposingRef.current) return
				const el = e.target as HTMLElement
				const field = el.dataset?.field
				if (field) {
					const value = el.textContent || ''
					debouncedFieldUpdate(field, value)
				}
			}, true)

			// Blur — save text, delay toolbar hide so user can click toolbar buttons
			doc.addEventListener('blur', (e) => {
				const el = e.target as HTMLElement
				const field = el.dataset?.field
				if (field) {
					debouncedFieldUpdate.cancel()
					const value = el.textContent || ''
					onFieldChange(field, value)
					editingFieldRef.current = null
				}

				blurTimeoutRef.current = setTimeout(() => {
					if (!editingFieldRef.current) {
						onHoverElementRef.current?.(null)
					}
				}, 300)
			}, true)

			// Composition (IME) events
			doc.addEventListener('compositionstart', () => {
				isComposingRef.current = true
			}, true)

			doc.addEventListener('compositionend', (e) => {
				isComposingRef.current = false
				const el = e.target as HTMLElement
				const field = el.dataset?.field
				if (field) {
					const value = el.textContent || ''
					debouncedFieldUpdate(field, value)
				}
			}, true)

			// Paste — strip HTML, preserve undo history via execCommand
			doc.addEventListener('paste', (e) => {
				const el = e.target as HTMLElement
				if (!el.hasAttribute('contenteditable')) return
				e.preventDefault()
				const text = e.clipboardData?.getData('text/plain') || ''
				// execCommand('insertText') preserves the native undo stack,
				// unlike Range API manipulation which destroys it
				doc.execCommand('insertText', false, text)
				// Trigger input-like update
				const field = el.dataset?.field
				if (field) {
					const value = el.textContent || ''
					debouncedFieldUpdate(field, value)
				}
			}, true)

			// Keydown — block only rich text formatting; let all other shortcuts through
			doc.addEventListener('keydown', (e) => {
				const el = e.target as HTMLElement
				if (!el.hasAttribute('contenteditable')) return

				// Block ONLY bold/italic/underline formatting shortcuts
				if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
					if (['b', 'i', 'u'].includes(e.key.toLowerCase())) {
						e.preventDefault()
						return
					}
				}

				// Let ALL other Ctrl/Cmd shortcuts pass through natively:
				// Ctrl+Z (undo), Ctrl+Shift+Z/Ctrl+Y (redo),
				// Ctrl+X (cut), Ctrl+C (copy), Ctrl+V (paste), Ctrl+A (select all)
				if (e.ctrlKey || e.metaKey) {
					return
				}

				// Enter in single-line fields → move to next field
				if (e.key === 'Enter' && !el.dataset?.multiline) {
					e.preventDefault()
					const all = Array.from(doc.querySelectorAll('[contenteditable]'))
					const idx = all.indexOf(el)
					if (idx >= 0 && idx < all.length - 1) {
						(all[idx + 1] as HTMLElement).focus()
					}
					return
				}

				// Escape → blur
				if (e.key === 'Escape') {
					el.blur()
					return
				}
			}, true)

			// --- HOVER DETECTION (section headers only, for section-level toolbar) ---
			doc.addEventListener('mouseover', (e) => {
				// Only detect section header hovers — bullet/entry toolbars are focus-based
				if (editingFieldRef.current) return

				const target = e.target as HTMLElement
				const sectionHeader = target.closest('[data-field*="Header"]') as HTMLElement
				const section = target.closest('[data-section-id]') as HTMLElement

				if (sectionHeader && section) {
					onHoverElementRef.current?.({
						type: 'section',
						sectionId: section.dataset.sectionId!,
						rect: computeRect(section),
					})
				}
			}, true)

			doc.addEventListener('mouseleave', () => {
				if (!editingFieldRef.current) {
					setTimeout(() => {
						if (!editingFieldRef.current) {
							onHoverElementRef.current?.(null)
						}
					}, 150)
				}
			})

			// --- SIZING & PAGE BREAKS ---
			calculatePageBreaks(doc)
			resizeIframe()

			// Re-run after fonts load — offsetHeight is inaccurate until fonts are ready
			void doc.fonts?.ready.then(() => {
				calculatePageBreaks(doc)
				resizeIframe()
			})

			// MutationObserver for auto-resize and debounced page-break recalculation
			const observer = new MutationObserver((mutations) => {
				resizeIframe()
				// Skip if all mutations are page-gap elements we just inserted
				const isOnlyPageGapChanges = mutations.length > 0 && mutations.every(m =>
					m.type === 'childList' &&
					[...m.addedNodes, ...m.removedNodes].length > 0 &&
					[...m.addedNodes, ...m.removedNodes].every(
						n => (n as Element).classList?.contains('page-gap'),
					)
				)
				if (!isOnlyPageGapChanges) {
					clearTimeout(pageBreakTimeoutRef.current)
					pageBreakTimeoutRef.current = setTimeout(() => {
						calculatePageBreaks(doc)
						resizeIframe()
					}, 400)
				}
			})
			observer.observe(doc.body, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
			})
			observerRef.current = observer

			// --- FOCUS RESTORATION ---
			if (pendingFocusRef.current) {
				const fieldToFocus = pendingFocusRef.current
				pendingFocusRef.current = null
				requestAnimationFrame(() => {
					const target = doc.querySelector(
						`[data-field="${fieldToFocus}"]`
					) as HTMLElement
					if (target) {
						target.focus()
						// Place cursor at end
						const range = doc.createRange()
						const sel = doc.getSelection()
						if (target.childNodes.length > 0) {
							range.selectNodeContents(target)
							range.collapse(false)
							sel?.removeAllRanges()
							sel?.addRange(range)
						}
					}
				})
			}
		}, [debouncedFieldUpdate, onFieldChange, resizeIframe, resolveToolbarInfo, computeRect])

		// Update toolbar position on scroll, or hide if not editing
		useEffect(() => {
			const scrollContainer = iframeRef.current?.parentElement?.parentElement
			if (!scrollContainer) return

			const handleScroll = () => {
				if (editingFieldRef.current) {
					// Re-emit toolbar info with updated rect
					const doc = iframeRef.current?.contentDocument
					if (!doc) return
					const el = doc.querySelector(`[data-field="${editingFieldRef.current}"]`) as HTMLElement
					if (el) {
						const info = resolveToolbarInfo(el)
						onHoverElementRef.current?.(info)
					}
				} else {
					onHoverElementRef.current?.(null)
				}
			}

			scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
			return () => scrollContainer.removeEventListener('scroll', handleScroll)
		}, [srcdoc, resolveToolbarInfo]) // re-attach after iframe reloads

		// Cleanup on unmount
		useEffect(() => {
			return () => {
				if (observerRef.current) {
					observerRef.current.disconnect()
				}
				clearTimeout(blurTimeoutRef.current)
			}
		}, [])

		return (
			<div
				className={className}
				style={{
					flex: 1,
					overflow: 'auto',
					display: 'flex',
					justifyContent: 'center',
					padding: '32px 24px',
					background: canvasBackground || '#E8E8EC',
				}}
			>
				<div style={{
					width: 816,
					flexShrink: 0,
					alignSelf: 'flex-start',
					background: '#FFFFFF',
					borderRadius: 2,
					boxShadow: '0 2px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
				}}>
					<iframe
						ref={iframeRef}
						srcDoc={srcdoc}
						onLoad={handleIframeLoad}
						style={{
							width: '100%',
							height: 1056,
							border: 'none',
							display: 'block',
						}}
						title="Resume Preview"
					/>
				</div>
			</div>
		)
	}
)
