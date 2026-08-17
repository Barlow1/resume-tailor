import puppeteer, { type Browser } from 'puppeteer'

const LAUNCH_OPTIONS: Parameters<typeof puppeteer.launch>[0] = {
	headless: true,
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
	args: [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-dev-shm-usage',
		'--disable-gpu',
		'--font-render-hinting=none'
	]
}

// Renders are serialized: each Chromium tree costs ~150MB+ and the Fly VM
// runs with a 512MB swapfile — N concurrent downloads used to mean N
// browsers, which is exactly what starved the machine into
// "Failed to launch the browser process".
let pdfQueue: Promise<unknown> = Promise.resolve()
let pdfQueueDepth = 0

// A serialized queue must never head-of-line block: a wedged render or a
// hung browser.close() would stall every user's download behind it. Each
// render gets a hard deadline (Fly's proxy gives up around 60s anyway) and
// the queue rejects new work instead of growing unboundedly.
const RENDER_TIMEOUT_MS = 60_000
const CLOSE_TIMEOUT_MS = 5_000
const MAX_QUEUE_DEPTH = 10

export function getPdfFromHtml(html: string): Promise<Uint8Array> {
	if (pdfQueueDepth >= MAX_QUEUE_DEPTH) {
		return Promise.reject(
			new Error('Too many PDF downloads in flight — try again in a moment'),
		)
	}
	pdfQueueDepth++
	const run = pdfQueue.then(
		() => renderWithBrowser(html),
		() => renderWithBrowser(html)
	)
	pdfQueue = run.catch(() => {})
	return run.finally(() => {
		pdfQueueDepth--
	})
}

async function renderWithBrowser(html: string): Promise<Uint8Array> {
	const browser = await puppeteer.launch(LAUNCH_OPTIONS)
	let timedOut = false
	const deadline = setTimeout(() => {
		timedOut = true
		// SIGKILL makes every pending protocol call reject, unwedging the
		// render so the queue can advance.
		browser.process()?.kill('SIGKILL')
	}, RENDER_TIMEOUT_MS)
	try {
		return await renderPdf(browser, html)
	} catch (error) {
		throw timedOut ? new Error('PDF render timed out') : error
	} finally {
		clearTimeout(deadline)
		// close() can hang (not just throw) on a wedged browser — bound it,
		// then make sure the process tree dies so it can't starve the VM.
		const closed = await Promise.race([
			browser.close().then(
				() => true,
				() => false,
			),
			new Promise<boolean>(resolve =>
				setTimeout(() => resolve(false), CLOSE_TIMEOUT_MS),
			),
		])
		if (!closed) {
			browser.process()?.kill('SIGKILL')
		}
	}
}

async function renderPdf(browser: Browser, html: string): Promise<Uint8Array> {
	const page = await browser.newPage()
	await page.setContent(html, {
		waitUntil: 'networkidle0'
	})

	// Set viewport to match Letter paper dimensions at 96dpi
	await page.setViewport({ width: 816, height: 1056 })

	// Wait for all fonts (Google Fonts loaded via <link> tags) to be ready
	await page.evaluate(async () => {
		await document.fonts.ready
	})

	// Split content into physical page containers so Puppeteer renders each
	// as its own PDF page.  Four phases:
	//   1. Insert page-gap markers into the live DOM (mirrors resume-iframe.tsx)
	//   2. Collect elements into page buckets based on gap markers
	//   3. Build one .resume container per page
	//   4. Fix overflows — if a container is taller than one page, move its
	//      trailing children to the next container so Puppeteer never has to
	//      break inside a container (which creates orphaned content + blank pages)
	const diagnostics = await page.evaluate(() => {
		const diag = {
			pageCount: 0,
			peels: 0,
			bulletPeels: 0,
			gaveUpSingleChild: 0,
			gaveUpIterationCap: 0,
			containers: [] as { page: number; height: number; children: number }[],
		}

		const resume = document.querySelector('.resume') as HTMLElement
		if (!resume) return diag

		const PAGE_HEIGHT = 1056  // 11in at 96dpi
		const PADDING = 48        // .resume padding
		const CONTENT_HEIGHT = PAGE_HEIGHT - 2 * PADDING // 960px

		// Safety buffer to absorb margin-collapsing drift and sub-pixel
		// rounding across many elements.  Without this, Phase 1's summed
		// totalHeight() can underestimate by 10-20px, causing a container
		// to overflow PAGE_HEIGHT by a few pixels.  Puppeteer then breaks
		// the container mid-content, creating an orphan page.
		const SAFETY_BUFFER = 20
		const EFFECTIVE_CONTENT = CONTENT_HEIGHT - SAFETY_BUFFER // 940px

		// break-inside:avoid is left in place as a safety net. It has no effect
		// on offsetHeight, so it only matters if a container overflows.

		function isSectionContainer(el: HTMLElement): boolean {
			// data-section-split marks a continuation we created ourselves —
			// it must stay splittable or oversized continuations can never
			// emit further page markers.
			return (
				(el.hasAttribute('data-section-id') || el.hasAttribute('data-section-split')) &&
				el.children.length > 1
			)
		}

		/** offsetHeight + marginTop + marginBottom */
		function totalHeight(el: HTMLElement): number {
			const s = window.getComputedStyle(el)
			return el.offsetHeight + (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0)
		}

		/**
		 * Try to split an entry (experience/education) at the bullet level.
		 * Returns null if the entry can't be meaningfully split (no UL, < 2
		 * bullets, or header alone fills the remaining space).
		 *
		 * When successful, returns the bullet index to split at and the height
		 * consumed by the header + fitting bullets.
		 */
		function trySplitEntry(entry: HTMLElement, remaining: number): { bulletSplitIndex: number; usedHeight: number } | null {
			const ul = entry.querySelector('ul')
			if (!ul) return null

			const bullets = Array.from(ul.children) as HTMLElement[]
			if (bullets.length < 2) return null

			// Measure everything before the UL (job header div(s))
			let headerHeight = 0
			for (const ch of Array.from(entry.children) as HTMLElement[]) {
				if (ch === ul) break
				headerHeight += totalHeight(ch)
			}

			// Add UL's own margin-top (not included in bullet measurements)
			const ulStyle = window.getComputedStyle(ul)
			headerHeight += parseFloat(ulStyle.marginTop) || 0

			if (headerHeight >= remaining) return null

			// Scan bullets to find how many fit after the header
			let usedInEntry = headerHeight
			let bulletSplitIndex = -1
			for (let i = 0; i < bullets.length; i++) {
				const h = totalHeight(bullets[i])
				if (usedInEntry + h > remaining) {
					bulletSplitIndex = i
					break
				}
				usedInEntry += h
			}

			// Need at least 1 bullet to fit (don't orphan a job header without bullets)
			if (bulletSplitIndex < 1) return null

			return { bulletSplitIndex, usedHeight: usedInEntry }
		}

		// --- Phase 1: Insert page-gap markers into the live DOM ---
		// Mirrors resume-iframe.tsx's calculatePageBreaks, extended with:
		//   - splitIndex > 1 for sections (no orphaned section headers)
		//   - Bullet-level splitting within entries that overflow a page boundary

		let currentPageUsed = 0
		// A queue rather than a snapshot: continuations we create get spliced
		// in after their source so they are re-processed (and can split again).
		const queue = Array.from(resume.children) as HTMLElement[]

		for (let qi = 0; qi < queue.length; qi++) {
			const child = queue[qi]
			if (child.classList.contains('page-gap')) continue
			if (child.classList.contains('page-break-marker')) continue

			const childHeight = totalHeight(child)
			const remainingOnPage = EFFECTIVE_CONTENT - currentPageUsed

			if (childHeight > remainingOnPage && isSectionContainer(child) && (currentPageUsed > 0 || childHeight > EFFECTIVE_CONTENT)) {
				const sectionChildren = Array.from(child.children) as HTMLElement[]
				let splitIndex = -1
				let usedInSection = 0

				// Find the first section item that doesn't fit
				for (let i = 0; i < sectionChildren.length; i++) {
					const itemHeight = totalHeight(sectionChildren[i])
					if (usedInSection + itemHeight > remainingOnPage && usedInSection > 0) {
						splitIndex = i
						break
					}
					usedInSection += itemHeight
				}

				// Try bullet-level split within the overflow entry
				let bulletSplit: { bulletSplitIndex: number; usedHeight: number } | null = null
				if (splitIndex >= 1 && splitIndex < sectionChildren.length) {
					const spaceForEntry = remainingOnPage - usedInSection
					bulletSplit = trySplitEntry(sectionChildren[splitIndex], spaceForEntry)
				}

				// Determine what we can keep on the current page:
				// - Full entries before the split point (splitIndex > 1)
				// - Partial overflow entry via bullet split
				// Continuations have no section header at index 0, so a split at
				// index 0 is meaningless only for real sections.
				const hasFullEntries = splitIndex > (child.hasAttribute('data-section-id') ? 1 : 0)
				const hasPartialEntry = bulletSplit !== null

				if (hasFullEntries || hasPartialEntry) {
					const continuation = child.cloneNode(false) as HTMLElement
					const sectionId = child.getAttribute('data-section-id') || child.getAttribute('data-section-split') || ''
					continuation.removeAttribute('data-section-id')
					continuation.setAttribute('data-section-split', sectionId)

					if (hasPartialEntry) {
						// Split the overflow entry's UL at the bullet boundary
						const overflowEntry = sectionChildren[splitIndex]
						const ul = overflowEntry.querySelector('ul')!
						const allBullets = Array.from(ul.children) as HTMLElement[]

						// Create continuation UL with overflow bullets
						const contUl = ul.cloneNode(false) as HTMLElement
						for (let i = bulletSplit!.bulletSplitIndex; i < allBullets.length; i++) {
							contUl.appendChild(allBullets[i])
						}

						// Wrap continuation bullets in an entry-like div (no job header repeated)
						const contEntry = overflowEntry.cloneNode(false) as HTMLElement
						contEntry.appendChild(contUl)
						continuation.appendChild(contEntry)

						// Move all entries AFTER the split one into the continuation
						for (let i = splitIndex + 1; i < sectionChildren.length; i++) {
							continuation.appendChild(sectionChildren[i])
						}
					} else {
						// No bullet split — move full entries from splitIndex onward
						for (let i = splitIndex; i < sectionChildren.length; i++) {
							continuation.appendChild(sectionChildren[i])
						}
					}

					const marker = document.createElement('div')
					marker.className = 'page-gap'
					resume.insertBefore(marker, child.nextSibling)
					resume.insertBefore(continuation, marker.nextSibling)

					// Re-process the continuation on a fresh page — if it is
					// itself taller than a page it can split again, emitting
					// proper markers instead of one overflowing bucket.
					queue.splice(qi + 1, 0, continuation)
					currentPageUsed = 0
					continue
				} else {
					// Nothing meaningful fits — push whole section to next page
					const marker = document.createElement('div')
					marker.className = 'page-gap'
					resume.insertBefore(marker, child)
					currentPageUsed = totalHeight(child)
				}
			} else if (childHeight > remainingOnPage && currentPageUsed > 0) {
				// Non-section element doesn't fit — push to next page
				const marker = document.createElement('div')
				marker.className = 'page-gap'
				resume.insertBefore(marker, child)
				currentPageUsed = childHeight
			} else {
				currentPageUsed += childHeight
			}

			while (currentPageUsed >= EFFECTIVE_CONTENT) {
				currentPageUsed -= EFFECTIVE_CONTENT
			}
		}

		// --- Phase 2: Collect elements into page buckets based on gap markers ---
		const allChildren = Array.from(resume.children) as HTMLElement[]
		const pages: HTMLElement[][] = [[]]

		for (const el of allChildren) {
			if (el.classList.contains('page-gap')) {
				if (pages[pages.length - 1].length > 0) {
					pages.push([])
				}
				el.remove()
			} else {
				pages[pages.length - 1].push(el)
			}
		}

		// Drop empty trailing buckets
		while (pages.length > 0 && pages[pages.length - 1].length === 0) {
			pages.pop()
		}

		// Single page — no restructuring needed
		diag.pageCount = pages.length
		if (pages.length <= 1) return diag

		// --- Phase 3: Build one .resume container per page ---
		const parent = resume.parentElement!
		const bgColor = window.getComputedStyle(resume).backgroundColor || 'white'
		// Preserve the template's own padding — modernist uses an asymmetric
		// left gutter (48px 48px 48px 70px) for outdented section labels;
		// hardcoding 48px reflowed every page of its multi-page output.
		const pagePadding = window.getComputedStyle(resume).padding || `${PADDING}px`

		while (resume.firstChild) {
			resume.removeChild(resume.firstChild)
		}
		parent.removeChild(resume)

		function createPageContainer(index: number): HTMLElement {
			const pageDiv = document.createElement('div')
			pageDiv.className = 'resume'
			pageDiv.style.padding = pagePadding
			pageDiv.style.width = '816px'
			pageDiv.style.minHeight = `${PAGE_HEIGHT}px`
			pageDiv.style.boxSizing = 'border-box'
			pageDiv.style.backgroundColor = bgColor
			pageDiv.style.position = 'relative'

			if (index > 0) {
				pageDiv.style.breakBefore = 'page'
				pageDiv.style.pageBreakBefore = 'always'
			}

			return pageDiv
		}

		const containers: HTMLElement[] = []

		for (let p = 0; p < pages.length; p++) {
			const pageDiv = createPageContainer(containers.length)
			containers.push(pageDiv)
			parent.appendChild(pageDiv)

			for (const child of pages[p]) {
				pageDiv.appendChild(child)
			}
		}

		// --- Phase 4: Fix overflows ---
		// Phase 1's height estimates can drift from actual rendered heights due
		// to margin collapsing, sub-pixel rounding, and font metrics across many
		// elements.  When a container is even 1px taller than PAGE_HEIGHT,
		// Puppeteer's CSS paging pushes the overflow onto a new physical page,
		// then the NEXT container's breakBefore:page skips to yet another page —
		// creating an almost-empty orphan page.
		//
		// Fix: walk each container; if it overflows, peel content from the end
		// and move it to the next container.  For sections, peel individual
		// entries (or bullets) rather than moving the entire section.

		function ensureNextContainer(idx: number): HTMLElement {
			if (idx + 1 >= containers.length) {
				const next = createPageContainer(containers.length)
				containers.push(next)
				parent.appendChild(next)
			}
			return containers[idx + 1]
		}

		function prependToContainer(target: HTMLElement, el: HTMLElement) {
			if (target.firstChild) {
				target.insertBefore(el, target.firstChild)
			} else {
				target.appendChild(el)
			}
		}

		for (let i = 0; i < containers.length; i++) {
			const container = containers[i]
			let iterations = 0
			const MAX_ITERATIONS = 50 // guard against infinite loops

			while (container.scrollHeight > PAGE_HEIGHT && iterations++ < MAX_ITERATIONS) {
				const lastChild = container.lastElementChild as HTMLElement
				if (!lastChild) break

				// If the last child is a section with multiple entries,
				// peel its last entry rather than moving the whole section.
				const isSection = lastChild.hasAttribute('data-section-id') || lastChild.hasAttribute('data-section-split')
				// Real sections keep header + at least one entry (> 2) so peeling
				// can never strand an orphaned section header at a page bottom;
				// continuations have no header (> 1). Deadlock breaker: when the
				// section is the container's ONLY child, the whole-section move
				// below can't fire — peel anyway, because an orphaned header
				// beats an overflowing container that Chrome splits mid-content.
				const minPeelChildren = lastChild.hasAttribute('data-section-id') ? 2 : 1
				const canPeel =
					lastChild.children.length > minPeelChildren ||
					(container.children.length === 1 && lastChild.children.length > 1)
				// Shed trailing bullets before peeling a whole entry: entries run
				// ~700px, so a whole-entry peel overshoots and leaves a hole.
				if (isSection && lastChild.lastElementChild) {
					const entry = lastChild.lastElementChild as HTMLElement
					const ul = entry.querySelector('ul')
					if (ul && ul.children.length >= 2) {
						const moved: HTMLElement[] = []
						while (
							container.scrollHeight > PAGE_HEIGHT &&
							ul.children.length > 1
						) {
							const b = ul.lastElementChild as HTMLElement
							ul.removeChild(b)
							moved.unshift(b)
						}

						if (moved.length > 0 && container.scrollHeight <= PAGE_HEIGHT) {
							const nextContainer = ensureNextContainer(i)
							const sectionId =
								lastChild.getAttribute('data-section-id') ||
								lastChild.getAttribute('data-section-split') ||
								''
							const entryId =
								entry.getAttribute('data-experience-id') ||
								entry.getAttribute('data-education-id') ||
								''
							const existingUl = nextContainer.querySelector(
								`[data-bullet-continuation="${entryId}"] > ul`,
							) as HTMLElement | null

							if (existingUl && entryId) {
								for (let k = moved.length - 1; k >= 0; k--) {
									existingUl.insertBefore(moved[k], existingUl.firstChild)
								}
							} else {
								const contUl = ul.cloneNode(false) as HTMLElement
								for (const b of moved) contUl.appendChild(b)
								const contEntry = entry.cloneNode(false) as HTMLElement
								contEntry.setAttribute('data-bullet-continuation', entryId)
								contEntry.appendChild(contUl)
								const wrapper = lastChild.cloneNode(false) as HTMLElement
								wrapper.removeAttribute('data-section-id')
								wrapper.setAttribute('data-section-split', sectionId)
								wrapper.appendChild(contEntry)
								prependToContainer(nextContainer, wrapper)
							}
							diag.bulletPeels++
							continue
						}

						// No fit — restore and fall through to the whole-entry peel.
						for (const b of moved) ul.appendChild(b)
					}
				}

				if (isSection && canPeel) {
					const lastEntry = lastChild.lastElementChild as HTMLElement
					lastChild.removeChild(lastEntry)

					const nextContainer = ensureNextContainer(i)

					// Check if the next container already has a continuation
					// of this section — if so, prepend the entry there
					const nextFirst = nextContainer.firstElementChild as HTMLElement | null
					const sectionId = lastChild.getAttribute('data-section-id') || lastChild.getAttribute('data-section-split') || ''
					const nextIsContinuation = nextFirst && (
						nextFirst.getAttribute('data-section-split') === sectionId ||
						nextFirst.getAttribute('data-section-id') === sectionId
					)

					if (nextIsContinuation && nextFirst) {
						prependToContainer(nextFirst, lastEntry)
					} else {
						// Wrap in a new continuation section
						const wrapper = lastChild.cloneNode(false) as HTMLElement
						wrapper.removeAttribute('data-section-id')
						wrapper.setAttribute('data-section-split', sectionId)
						// Remove section header content (H2 etc) — just keep the entry
						wrapper.appendChild(lastEntry)
						prependToContainer(nextContainer, wrapper)
					}
					diag.peels++
					continue
				}

				// Default: move the whole child to the next container
				if (container.children.length <= 1) {
					diag.gaveUpSingleChild++
					break // can't peel further
				}
				container.removeChild(lastChild)
				diag.peels++

				const nextContainer = ensureNextContainer(i)
				prependToContainer(nextContainer, lastChild)
			}
			if (iterations >= MAX_ITERATIONS) diag.gaveUpIterationCap++
		}

		diag.pageCount = containers.length
		diag.containers = containers.map((c, i) => {
			// scrollHeight is floored by minHeight, so measure the ink extent.
			const first = c.firstElementChild
			const last = c.lastElementChild
			const height =
				first && last
					? Math.round(
							last.getBoundingClientRect().bottom -
								first.getBoundingClientRect().top,
						)
					: 0
			return { page: i + 1, height, children: c.children.length }
		})
		return diag
	})

	// A non-final page under ~65% full means the paginator left a hole.
	const underfilled = diagnostics.containers.filter(
		c => c.page < diagnostics.pageCount && c.height < 620,
	)
	if (
		process.env.PDF_DEBUG ||
		underfilled.length > 0 ||
		diagnostics.gaveUpSingleChild > 0 ||
		diagnostics.gaveUpIterationCap > 0
	) {
		console.warn('[pdf] pagination diagnostics ' + JSON.stringify(diagnostics))
	}

	const pdfBuffer = await page.pdf({
		printBackground: true,
		scale: 1.0,
		format: 'letter',
		margin: {
			top: '0',
			right: '0',
			bottom: '0',
			left: '0'
		}
	})

	return pdfBuffer
}

export function uint8ArrayToBase64(uint8Array: Uint8Array) {
	return Buffer.from(uint8Array).toString('base64');
}
