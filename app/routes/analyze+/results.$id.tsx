import * as React from 'react'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import {
	Link,
	useLoaderData,
	useNavigate,
	useRevalidator,
} from '@remix-run/react'
import { prisma } from '~/utils/db.server.ts'
import { KeywordPlan } from '~/components/keyword-plan.tsx'
import type { KeywordSnippet } from '~/lib/keywords/types.ts'

// ---------- Types (align with getAiFeedback) ----------
type ImproveItem = { current?: string; suggest: string; why: string }

type SuggestedBullet = {
	id: string
	content: string
	why: string
	addToExperience: number
}

type KeywordPlan = {
	term: string
	priority: 'critical' | 'important' | 'nice'
	where: Array<'skills' | 'summmary' | 'bullet'>
	supported: boolean
	proof?: string
	proofSuggestions?: string
	synonms?: string[]
	snippets?: { skills?: string; summary?: string; bullet?: string }
}

type Feedback = {
	fitPct: number
	summary: string
	strengths?: string[]
	weaknesses?: string[]
	redFlags?: string[]
	improveBullets?: ImproveItem[]
	suggestedBullets?: SuggestedBullet[]
	keywords?: { resume: string[]; jd: string[]; missing: string[] }
	keywordBullets?: { suggest: string; why: string }[]
	keywordPlan?: { top10: KeywordSnippet[] }
}

type AnalysisRow = {
	id: string
	title: string
	company: string
	jdText: string
	resumeTxt: string | null
	resumeData: string | null
	fitPct: number | null
	feedback: string | null // JSON string
	createdAt: string | Date
	updatedAt: string | Date
}

type LoaderData = {
	analysis: AnalysisRow
	feedback: Feedback | null
}

const resumeKey = (id: string) => `analysis-resume-${id}`

// ---------- Loader: read from DB directly ----------
export async function loader({ params }: LoaderFunctionArgs) {
	const id = params.id!
	const analysis = await prisma.analysis.findUnique({
		where: { id },
		select: {
			id: true,
			title: true,
			company: true,
			jdText: true,
			resumeTxt: true,
			resumeData: true,
			fitPct: true,
			feedback: true,
			createdAt: true,
			updatedAt: true,
		},
	})

	if (!analysis) throw new Response('Analysis not found', { status: 404 })

	let parsed: Feedback | null = null
	try {
		parsed = analysis.feedback
			? (JSON.parse(analysis.feedback) as Feedback)
			: null
	} catch {
		parsed = null
	}

	return json<LoaderData>({ analysis, feedback: parsed })
}

// ---------- Component ----------
export default function ResultsPage() {
	const { analysis, feedback: loadedFeedback } = useLoaderData<typeof loader>()
	const nav = useNavigate()
	const revalidator = useRevalidator()
	const cap = 5

	// Check if we're in streaming mode
	const [searchParams] = React.useState(() => {
		if (typeof window === 'undefined') return new URLSearchParams()
		return new URLSearchParams(window.location.search)
	})
	const isStreaming = searchParams.get('streaming') === 'true'

	const [resumeTxt] = React.useState<string>(() => {
		if (typeof window === 'undefined') return analysis.resumeTxt ?? ''
		return (
			localStorage.getItem(resumeKey(analysis.id)) ?? analysis.resumeTxt ?? ''
		)
	})
	const [newFit, setNewFit] = React.useState<number | null>(null)
	const [_reanalyzing, setReanalyzing] = React.useState(false)
	const [selectedBullets, setSelectedBullets] = React.useState<string[]>([])
	const [bulletExperienceMap, setBulletExperienceMap] = React.useState<Record<string, number>>({})
	const [sendingToBuilder, setSendingToBuilder] = React.useState(false)

	// Parse resume data to get experiences
	const experiences = React.useMemo(() => {
		try {
			if (analysis.resumeData) {
				const parsedData = JSON.parse(analysis.resumeData) as { experiences?: any[] }
				return parsedData.experiences || []
			}
		} catch (e) {
			console.error('Failed to parse resumeData:', e)
		}
		return []
	}, [analysis.resumeData])

	// Streaming state
	const [streamingFeedback, setStreamingFeedback] = React.useState<Partial<Feedback>>({})
	const [isStreamingActive, setIsStreamingActive] = React.useState(isStreaming)
	const [streamCompleted, setStreamCompleted] = React.useState(false)
	const [streamError, setStreamError] = React.useState<string | null>(null)

	// Use streaming feedback if we have it and are streaming/just completed, otherwise use loaded feedback
	// Keep showing streaming feedback until we have saved data loaded
	const hasStreamingData = Object.keys(streamingFeedback).length > 0
	const feedback = (isStreamingActive || (streamCompleted && hasStreamingData && !loadedFeedback))
		? (streamingFeedback as Feedback)
		: loadedFeedback

	// Initialize bulletExperienceMap when suggestedBullets change
	React.useEffect(() => {
		if (feedback?.suggestedBullets) {
			setBulletExperienceMap(prev => {
				const newMap = { ...prev }
				feedback.suggestedBullets?.forEach(bullet => {
					// Only set if not already set (preserve user selections)
					if (!(bullet.id in newMap)) {
						newMap[bullet.id] = bullet.addToExperience
					}
				})
				return newMap
			})
		}
	}, [feedback?.suggestedBullets])

	React.useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(resumeKey(analysis.id), resumeTxt ?? '')
		}
	}, [analysis.id, resumeTxt])

	// Streaming effect
	// eslint-disable-next-line react-hooks/exhaustive-deps
	React.useEffect(() => {
		if (!isStreaming || typeof window === 'undefined') return

		const streamingData = localStorage.getItem(`analysis-streaming-${analysis.id}`)
		if (!streamingData) {
			setStreamError('Missing analysis data')
			setIsStreamingActive(false)
			return
		}

		const { title, company, jdText, resumeTxt: resume } = JSON.parse(streamingData) as {
			title: string
			company: string
			jdText: string
			resumeTxt: string
		}

		const params = new URLSearchParams({
			analysisId: analysis.id,
			jdText,
			resumeTxt: resume,
			title,
			company,
		})

		const sse = new EventSource(`/resources/analyze-stream?${params}`)
		let accumulatedJson = ''
		let parseTimeout: NodeJS.Timeout | null = null

		sse.addEventListener('message', event => {
			const data = event.data

			// Less verbose logging - only log special events
			if (data === '[DONE]' || data.startsWith('[ERROR]')) {
				console.log('📨 SSE event:', data)
			}

			if (data === '[DONE]') {
				console.log('✅ Stream complete, saving...')
				console.log('📦 Final JSON length:', accumulatedJson.length)
				console.log('📦 JSON preview (first 200):', accumulatedJson.substring(0, 200))
				console.log('📦 JSON preview (last 200):', accumulatedJson.substring(accumulatedJson.length - 200))
				sse.close()
				setIsStreamingActive(false)
				setStreamCompleted(true)
				// Final parse to ensure we have everything
				if (parseTimeout) clearTimeout(parseTimeout)
				parseStreamingJson(accumulatedJson)
				// Save final result
				saveFinalStreamingResult(accumulatedJson, title, company, jdText, resume)
				return
			}

			if (data.startsWith('[ERROR]')) {
				console.error('❌ Stream error:', data)
				sse.close()
				setIsStreamingActive(false)
				setStreamError(data.replace('[ERROR]', ''))
				return
			}

			// Accumulate JSON
			accumulatedJson += data

			// Throttle parsing to every 100ms to avoid excessive renders
			if (parseTimeout) clearTimeout(parseTimeout)
			parseTimeout = setTimeout(() => {
				parseStreamingJson(accumulatedJson)
			}, 100)
		})

		sse.addEventListener('error', event => {
			console.error('SSE error:', event)
			sse.close()
			setIsStreamingActive(false)
			setStreamError('Connection lost')
		})

		return () => {
			sse.close()
		}
	}, [isStreaming, analysis.id])

	function parseStreamingJson(jsonStr: string) {
		try {
			const updates: Partial<Feedback> = {}

			// Only log at milestone lengths
			const shouldLog = jsonStr.length === 500 || jsonStr.length === 2000 || jsonStr.length === 5000
			if (shouldLog) {
				console.log('📡 Streaming progress:', jsonStr.length, 'chars')
			}

			// Parse fitPct
			const fitMatch = jsonStr.match(/"fitPct"\s*:\s*(\d+)/)
			if (fitMatch) {
				updates.fitPct = parseInt(fitMatch[1])
			}

			// Parse summary (handle escaped quotes and newlines)
			const summaryMatch = jsonStr.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
			if (summaryMatch) {
				updates.summary = summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
			}

			// Parse strengths array
			const strengthsMatch = jsonStr.match(/"strengths"\s*:\s*\[(.*?)(?:\]|$)/s)
			if (strengthsMatch) {
				const strengthsStr = strengthsMatch[1]
				const strengths: string[] = []
				const strengthMatches = strengthsStr.matchAll(/"((?:[^"\\]|\\.)*)"/g)
				for (const match of strengthMatches) {
					strengths.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'))
				}
				if (strengths.length > 0) {
					updates.strengths = strengths
				}
			}

			// Parse weaknesses array
			const weaknessesMatch = jsonStr.match(/"weaknesses"\s*:\s*\[(.*?)(?:\]|$)/s)
			if (weaknessesMatch) {
				const weaknessesStr = weaknessesMatch[1]
				const weaknesses: string[] = []
				const weaknessMatches = weaknessesStr.matchAll(/"((?:[^"\\]|\\.)*)"/g)
				for (const match of weaknessMatches) {
					weaknesses.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'))
				}
				if (weaknesses.length > 0) {
					updates.weaknesses = weaknesses
				}
			}

			// Parse redFlags array - extract each complete item
			const redFlagsMatch = jsonStr.match(/"redFlags"\s*:\s*\[(.*?)(?:\]|$)/s)
			if (redFlagsMatch) {
				const redFlagsStr = redFlagsMatch[1]
				const flags: string[] = []
				// Match each complete string in the array
				const flagMatches = redFlagsStr.matchAll(/"((?:[^"\\]|\\.)*)"/g)
				for (const match of flagMatches) {
					flags.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'))
				}
				if (flags.length > 0) {
					updates.redFlags = flags
				}
			}

			// Parse improveBullets array - extract each complete object
			const improveBulletsMatch = jsonStr.match(/"improveBullets"\s*:\s*\[(.*?)(?:\]|$)/s)
			if (improveBulletsMatch) {
				const bulletsStr = improveBulletsMatch[1]
				const bullets: ImproveItem[] = []
				// Match each complete object in the array
				const objectRegex = /\{\s*"current"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"suggest"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"why"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
				const simpleRegex = /\{\s*"suggest"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"why"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g

				let match
				while ((match = objectRegex.exec(bulletsStr)) !== null) {
					bullets.push({
						current: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						suggest: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						why: match[3].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
					})
				}
				while ((match = simpleRegex.exec(bulletsStr)) !== null) {
					bullets.push({
						current: '',
						suggest: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						why: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
					})
				}
				if (bullets.length > 0) {
					updates.improveBullets = bullets
				}
			}

			// Parse keywords object
			const keywordsMatch = jsonStr.match(/"keywords"\s*:\s*\{(.*?)(?:\}|$)/s)
			if (keywordsMatch) {
				const keywordsObj = `{${keywordsMatch[1]}}`
				try {
					// Try to parse the keywords object if it's complete enough
					const completed = keywordsObj.endsWith('}') ? keywordsObj : keywordsObj + '}'
					const keywords = JSON.parse(completed) as { resume: string[]; jd: string[]; missing: string[] }
					updates.keywords = keywords
				} catch {
					// Partial parse - extract what we can
					const resumeMatch = keywordsMatch[1].match(/"resume"\s*:\s*\[(.*?)\]/s)
					const jdMatch = keywordsMatch[1].match(/"jd"\s*:\s*\[(.*?)\]/s)
					const missingMatch = keywordsMatch[1].match(/"missing"\s*:\s*\[(.*?)\]/s)

					updates.keywords = {
						resume: resumeMatch ? extractStringArray(resumeMatch[1]) : [],
						jd: jdMatch ? extractStringArray(jdMatch[1]) : [],
						missing: missingMatch ? extractStringArray(missingMatch[1]) : [],
					}
				}
			}

			// Parse keywordPlan.top10 array - simplified approach
			// Try to extract and parse progressively more complete keywordPlan objects
			const keywordPlanMatch = jsonStr.match(/"keywordPlan"\s*:\s*\{/s)
			if (keywordPlanMatch) {
				try {
					// Find the start of keywordPlan
					const keywordPlanStart = jsonStr.indexOf('"keywordPlan"')
					const remaining = jsonStr.substring(keywordPlanStart)

					// Try to find the closing brace for keywordPlan object
					// We need to match: "keywordPlan": { "top10": [ ... ] }
					// Look for pattern where we have keywordPlan, followed by top10 array, then closing braces

					// Simple heuristic: look for "keywordBullets" or the final closing brace
					let endIdx = remaining.indexOf('"keywordBullets"')
					if (endIdx === -1) {
						// keywordBullets not found yet, try to find reasonable end
						// Count braces to find matching close
						let depth = 0
						let inString = false
						let escape = false
						let start = remaining.indexOf(':') + 1 // Start after "keywordPlan":

						for (let i = start; i < remaining.length; i++) {
							const char = remaining[i]

							if (escape) {
								escape = false
								continue
							}
							if (char === '\\') {
								escape = true
								continue
							}
							if (char === '"') {
								inString = !inString
								continue
							}
							if (inString) continue

							if (char === '{' || char === '[') depth++
							if (char === '}' || char === ']') depth--

							if (depth === 0 && (char === '}' || char === ']')) {
								endIdx = i + 1
								break
							}
						}
					}

					if (endIdx > 0) {
						// Extract just the keywordPlan section
						const keywordPlanStr = remaining.substring(0, endIdx)
						// Wrap it to make valid JSON
						const wrapped = `{${keywordPlanStr}}`

						try {
							const parsed = JSON.parse(wrapped) as { keywordPlan?: { top10?: any[] } }
							if (parsed.keywordPlan?.top10 && parsed.keywordPlan.top10.length > 0) {
								updates.keywordPlan = parsed.keywordPlan as { top10: any[] }
								console.log('🔑 Parsed keywordPlan items:', parsed.keywordPlan.top10.length)
							}
						} catch (e) {
							// Not valid JSON yet, keep accumulating
							// Only log at milestones to avoid spam
							if (jsonStr.length % 2000 < 100) {
								console.log('⏳ keywordPlan found but not complete yet, trying to parse...')
							}
						}
					}
				} catch (err) {
					console.error('❌ keywordPlan parse error:', err)
				}
			} else {
				// Log that we haven't found keywordPlan yet at milestones
				if (jsonStr.length % 1000 < 100 && jsonStr.length > 2000) {
					console.log('⏳ No keywordPlan found yet at', jsonStr.length, 'chars')
				}
			}

			// Parse suggestedBullets array - extract each complete object
			const suggestedBulletsMatch = jsonStr.match(/"suggestedBullets"\s*:\s*\[(.*?)(?:\]|$)/s)
			if (suggestedBulletsMatch) {
				const suggestedStr = suggestedBulletsMatch[1]
				const suggestedBullets: SuggestedBullet[] = []

				// Match each complete suggested bullet object
				const suggestedRegex = /\{\s*"id"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"why"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"addToExperience"\s*:\s*(\d+)\s*\}/g
				let match
				while ((match = suggestedRegex.exec(suggestedStr)) !== null) {
					suggestedBullets.push({
						id: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						content: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						why: match[3].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						addToExperience: parseInt(match[4]),
					})
				}

				if (suggestedBullets.length > 0) {
					updates.suggestedBullets = suggestedBullets
					console.log('✨ Parsed suggestedBullets:', suggestedBullets.length)
				}
			}

			// Parse keywordBullets array - extract each complete object
			const keywordBulletsMatch = jsonStr.match(/"keywordBullets"\s*:\s*\[(.*?)(?:\]|$)/s)
			if (keywordBulletsMatch) {
				console.log('🔍 Found keywordBullets in JSON, attempting to parse...')
				const bulletsStr = keywordBulletsMatch[1]
				const bullets: Array<{ suggest: string; why: string }> = []

				// Match each complete bullet object
				const bulletRegex = /\{\s*"suggest"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"why"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
				let match
				while ((match = bulletRegex.exec(bulletsStr)) !== null) {
					bullets.push({
						suggest: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
						why: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
					})
				}

				if (bullets.length > 0) {
					updates.keywordBullets = bullets
					console.log('💡 Parsed keywordBullets:', bullets.length)
				} else {
					console.log('⚠️ keywordBullets found but no items parsed yet')
				}
			} else {
				// Log that we haven't found keywordBullets yet at milestones
				if (jsonStr.length % 1000 < 100 && jsonStr.length > 2000) {
					console.log('⏳ No keywordBullets found yet at', jsonStr.length, 'chars')
				}
			}

			// Only log when we have interesting updates
			const updateKeys = Object.keys(updates)
			const hasInterestingUpdate = updateKeys.includes('keywordPlan') ||
				updateKeys.includes('keywordBullets') ||
				(updateKeys.length > 0 && jsonStr.length < 1000)
			if (hasInterestingUpdate) {
				console.log('🔄 Updating:', updateKeys.join(', '))
			}

			setStreamingFeedback(prev => ({ ...prev, ...updates }))
		} catch (err) {
			// Log parse errors but don't crash
			console.error('❌ Streaming parse error:', err)
		}
	}

	function extractStringArray(str: string): string[] {
		const matches = str.matchAll(/"((?:[^"\\]|\\.)*)"/g)
		const result: string[] = []
		for (const match of matches) {
			result.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'))
		}
		return result
	}

	async function saveFinalStreamingResult(
		jsonStr: string,
		title: string,
		company: string,
		jdText: string,
		resumeTxt: string,
	) {
		console.log('💾 Saving streaming result...')
		try {
			const parsed = JSON.parse(jsonStr) as { fitPct?: number; keywordPlan?: { top10?: any[] } }
			console.log('✅ Parsed JSON successfully', {
				hasFitPct: !!parsed.fitPct,
				hasKeywordPlan: !!parsed.keywordPlan,
				keywordPlanLength: parsed.keywordPlan?.top10?.length || 0,
			})

			const response = await fetch(`/resources/update-analysis/${analysis.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					company,
					jdText,
					resumeTxt,
					feedback: parsed,
				}),
			})

			if (!response.ok) {
				const errorText = await response.text()
				console.error('❌ Save failed:', response.status, errorText)
				throw new Error(`Save failed: ${response.status} - ${errorText}`)
			}

			console.log('✅ Save successful, revalidating...')

			// Clear streaming data from localStorage
			localStorage.removeItem(`analysis-streaming-${analysis.id}`)

			// Remove streaming param from URL
			const url = new URL(window.location.href)
			url.searchParams.delete('streaming')
			window.history.replaceState({}, '', url)

			// Revalidate to get the saved data from the server
			revalidator.revalidate()
		} catch (err) {
			console.error('❌ Failed to save streaming result:', err)
			setStreamError(`Failed to save results: ${err instanceof Error ? err.message : 'Unknown error'}`)
			setStreamCompleted(false) // Clear the completed state so we don't get stuck
		}
	}

	// Detect when revalidation completes after streaming
	React.useEffect(() => {
		console.log('Revalidation effect:', {
			streamCompleted,
			revalidatorState: revalidator.state,
			hasLoadedFeedback: !!loadedFeedback,
		})

		if (streamCompleted && revalidator.state === 'idle' && loadedFeedback) {
			console.log('✅ Revalidation completed, clearing streaming state')
			// Revalidation completed and we have loaded feedback
			// We can now clear the streaming state
			setStreamingFeedback({})
			setStreamCompleted(false)
		}
	}, [streamCompleted, revalidator.state, loadedFeedback])

	async function _reanalyze() {
		setReanalyzing(true)
		try {
			const res = await fetch(`/resources/update-analysis/${analysis.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					// keep current job meta unless user changed it elsewhere
					title: analysis.title,
					company: analysis.company,
					jdText: analysis.jdText,
					resumeTxt,
				}),
			})

			if (res.status === 401) {
				nav(`/login?redirectTo=analyze/results/${analysis.id}`)
				return
			}
			if (res.status === 402) {
				// you can show your subscribe modal here if you want
				alert(
					'You’ve reached the free analysis limit. Please upgrade to continue.',
				)
				return
			}
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || `Re-analyze failed (${res.status})`)
			}

			// result shape from our update route: { analysis, feedback }
			const data = (await res.json()) as {
				analysis?: { fitPct?: number | null }
				feedback?: { fitPct?: number }
			}
			const nextFit =
				(typeof data.analysis?.fitPct === 'number'
					? data.analysis?.fitPct
					: null) ??
				(typeof data.feedback?.fitPct === 'number'
					? data.feedback.fitPct
					: null)

			setNewFit(nextFit ?? null)

			revalidator.revalidate()
		} catch (err) {
			console.error(err)
			alert('Re-analyze failed. Check server logs.')
		} finally {
			setReanalyzing(false)
		}
	}

	const improvements = feedback?.improveBullets ?? []
	const fit =
		typeof analysis.fitPct === 'number'
			? analysis.fitPct
			: feedback?.fitPct ?? null

	return (
		<div className="mx-auto max-w-5xl p-6">
			{/* Page header */}
			<header className="mb-6">
				<h1 className="mt-3 text-3xl font-bold tracking-tight">
					Results &amp; Edits
				</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
					Review your fit, scan red flags, and apply targeted edits below.
					Re-analyze anytime to see how your changes improve the score.
				</p>
			</header>

			{/* Results card */}
			<section className="rounded-2xl border border-border bg-card shadow-sm">
				<div className="rounded-t-2xl bg-gradient-to-r from-muted to-muted/80 px-5 py-3">
					<h2 className="text-sm font-semibold text-card-foreground">
						Analysis Summary
					</h2>
				</div>

				<div className="space-y-6 px-5 py-5">
					{/* Streaming indicator */}
					{isStreamingActive && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<svg
								className="h-4 w-4 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
							>
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
									opacity="0.25"
								/>
								<path
									d="M22 12a10 10 0 0 1-10 10"
									stroke="currentColor"
									strokeWidth="4"
									strokeLinecap="round"
								/>
							</svg>
							Analyzing your resume...
						</div>
					)}


					{/* Saving indicator */}
					{streamCompleted && !loadedFeedback && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<svg
								className="h-4 w-4 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
							>
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
									opacity="0.25"
								/>
								<path
									d="M22 12a10 10 0 0 1-10 10"
									stroke="currentColor"
									strokeWidth="4"
									strokeLinecap="round"
								/>
							</svg>
							Saving results...
						</div>
					)}

					{/* Error indicator */}
					{streamError && (
						<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
							{streamError}
						</div>
					)}

					{/* Fit block */}
					<div>
						<div className="mb-2 flex items-center gap-3">
							<span className="text-base font-semibold text-foreground">
								Fit
							</span>
							{fit != null ? (
								<>
									<span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
										{fit}%
									</span>
									{newFit != null && (
										<span className="text-xs font-medium text-green-700">
											→ {newFit}%
										</span>
									)}
								</>
							) : (
								<div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
							)}
						</div>

						{/* Progress bar */}
						<div className="h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border">
							<div
								className="h-full bg-primary transition-all duration-500"
								style={{
									width: `${Math.max(0, Math.min(100, newFit ?? fit ?? 0))}%`,
								}}
								aria-hidden="true"
							/>
						</div>
					</div>

					{/* Summary text */}
					{feedback?.summary ? (
						<p className="text-sm leading-relaxed text-foreground">
							{feedback.summary}
						</p>
					) : isStreamingActive ? (
						<div className="space-y-2">
							<div className="h-4 w-full animate-pulse rounded bg-muted" />
							<div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
							<div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
						</div>
					) : null}

					{/* Strengths */}
					<div>
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							✓ Strengths
						</h3>
						{feedback?.strengths && feedback.strengths.length > 0 ? (
							<ul className="space-y-1.5 text-sm text-foreground">
								{feedback.strengths.map((s, i) => (
									<li
										key={i}
										className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
										style={{ animationDelay: `${i * 50}ms` }}
									>
										<span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
										<span>{s}</span>
									</li>
								))}
							</ul>
						) : isStreamingActive ? (
							<div className="space-y-2">
								{[...Array(3)].map((_, i) => (
									<div key={i} className="flex items-start gap-2">
										<div className="mt-1 h-1.5 w-1.5 rounded-full bg-muted" />
										<div className="h-4 flex-1 animate-pulse rounded bg-muted" />
									</div>
								))}
							</div>
						) : null}
					</div>

					{/* Weaknesses */}
					<div>
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							⚠ Areas to Improve
						</h3>
						{feedback?.weaknesses && feedback.weaknesses.length > 0 ? (
							<ul className="space-y-1.5 text-sm text-foreground">
								{feedback.weaknesses.map((w, i) => (
									<li
										key={i}
										className="flex items-start gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
										style={{ animationDelay: `${i * 50}ms` }}
									>
										<span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
										<span>{w}</span>
									</li>
								))}
							</ul>
						) : isStreamingActive ? (
							<div className="space-y-2">
								{[...Array(3)].map((_, i) => (
									<div key={i} className="flex items-start gap-2">
										<div className="mt-1 h-1.5 w-1.5 rounded-full bg-muted" />
										<div className="h-4 flex-1 animate-pulse rounded bg-muted" />
									</div>
								))}
							</div>
						) : null}
					</div>


					{/* Improvements table */}
					<div>
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							Improvements
						</h3>
						<div className="overflow-x-auto rounded-xl border border-border">
							<table className="min-w-full text-left text-sm">
								<thead className="bg-muted">
									<tr className="text-muted-foreground">
										<th className="px-3 py-2 font-semibold">Current</th>
										<th className="px-3 py-2 font-semibold">Suggestion</th>
										<th className="px-3 py-2 font-semibold">Why</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{improvements.length > 0 ? (
										improvements.map((b, i) => (
											<tr
												key={i}
												className="animate-in fade-in slide-in-from-left-2 align-top duration-300"
												style={{ animationDelay: `${i * 100}ms` }}
											>
												<td className="px-3 py-3 text-foreground">
													{b.current ?? ''}
												</td>
												<td className="px-3 py-3 text-foreground">
													{b.suggest}
												</td>
												<td className="px-3 py-3 text-foreground">{b.why}</td>
											</tr>
										))
									) : isStreamingActive ? (
										[...Array(3)].map((_, i) => (
											<tr key={i} className="align-top">
												<td className="px-3 py-3">
													<div className="h-4 w-24 animate-pulse rounded bg-muted" />
												</td>
												<td className="px-3 py-3">
													<div className="h-4 w-full animate-pulse rounded bg-muted" />
												</td>
												<td className="px-3 py-3">
													<div className="h-4 w-32 animate-pulse rounded bg-muted" />
												</td>
											</tr>
										))
									) : (
										<tr>
											<td
												className="px-3 py-3 italic text-muted-foreground"
												colSpan={3}
											>
												No suggestions yet.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
					{/* Top-10 Keyword Plan */}
					<KeywordPlan plan={feedback?.keywordPlan} isLoading={isStreamingActive} />
					{/* Keyword Analyzer */}
					<div className="rounded-t-xl bg-muted px-5 py-3">
						<h2 className="text-sm font-semibold text-card-foreground">
							Keyword Analyzer
						</h2>
					</div>

					<div className="grid gap-4 px-5 py-4 md:grid-cols-3">
						<div>
							<div className="mb-2 text-xs font-medium text-muted-foreground">
								JD Keywords
							</div>
							<div className="flex flex-wrap gap-2">
								{(feedback?.keywords?.jd ?? []).slice(0, cap).map((k, i) => (
									<span
										key={k}
										className="animate-in fade-in zoom-in-90 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground duration-200"
										style={{ animationDelay: `${i * 30}ms` }}
									>
										{k}
									</span>
								))}
								{isStreamingActive &&
									(feedback?.keywords?.jd ?? []).length === 0 &&
									[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="h-5 w-16 animate-pulse rounded-full bg-muted"
										/>
									))}
							</div>
						</div>
						<div>
							<div className="mb-2 text-xs font-medium text-muted-foreground">
								Resume Keywords
							</div>
							<div className="flex flex-wrap gap-2">
								{(feedback?.keywords?.resume ?? []).slice(0, cap).map((k, i) => (
									<span
										key={k}
										className="animate-in fade-in zoom-in-90 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground duration-200"
										style={{ animationDelay: `${i * 30}ms` }}
									>
										{k}
									</span>
								))}
								{isStreamingActive &&
									(feedback?.keywords?.resume ?? []).length === 0 &&
									[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="h-5 w-16 animate-pulse rounded-full bg-muted"
										/>
									))}
							</div>
						</div>
						<div>
							<div className="mb-2 text-xs font-medium text-muted-foreground">
								Missing in Resume
							</div>
							<div className="flex flex-wrap gap-2">
								{(feedback?.keywords?.missing ?? []).slice(0, cap).map((k, i) => (
									<span
										key={k}
										className="animate-in fade-in zoom-in-90 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive duration-200"
										style={{ animationDelay: `${i * 30}ms` }}
									>
										{k}
									</span>
								))}
								{isStreamingActive &&
									(feedback?.keywords?.missing ?? []).length === 0 &&
									[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="h-5 w-16 animate-pulse rounded-full bg-muted"
										/>
									))}
							</div>
						</div>
					</div>

					{/* Keyword-focused Suggestions */}
					{(feedback?.keywordBullets?.length || isStreamingActive) && (
						<div className="px-5 pb-5">
							<div className="mb-2 text-sm font-semibold text-foreground">
								Keyword-focused Suggestions
							</div>
							{feedback?.keywordBullets && feedback.keywordBullets.length > 0 ? (
								<ul className="list-disc space-y-2 pl-6 text-sm text-foreground">
									{feedback.keywordBullets.map((b, i) => (
										<li
											key={i}
											className="animate-in fade-in slide-in-from-left-2 duration-300"
											style={{ animationDelay: `${i * 100}ms` }}
										>
											<div className="font-medium">{b.suggest}</div>
											<div className="text-xs text-muted-foreground">{b.why}</div>
										</li>
									))}
								</ul>
							) : isStreamingActive ? (
								<ul className="list-disc space-y-2 pl-6 text-sm">
									{[...Array(3)].map((_, i) => (
										<li key={i}>
											<div className="mb-1 h-4 w-full animate-pulse rounded bg-muted" />
											<div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
										</li>
									))}
								</ul>
							) : null}
						</div>
					)}

					{/* Suggested Bullets to Stand Out */}
					<div>
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							Suggested Bullets to Stand Out
						</h3>
						<p className="mb-4 text-sm text-muted-foreground">
							Select the bullets you want to add to your resume. Click "Open in Builder" below to see them added to your resume.
						</p>

						{feedback?.suggestedBullets && feedback.suggestedBullets.length > 0 ? (
							<>
								<div className="space-y-3">
									{feedback.suggestedBullets.map((bullet) => {
										const selectedExpIndex = bulletExperienceMap[bullet.id] ?? bullet.addToExperience

										return (
											<div
												key={bullet.id}
												className="rounded-lg border border-border p-4"
											>
												<div className="flex gap-3">
													<input
														type="checkbox"
														checked={selectedBullets.includes(bullet.id)}
														onChange={(e) => {
															if (e.target.checked) {
																setSelectedBullets([...selectedBullets, bullet.id])
															} else {
																setSelectedBullets(
																	selectedBullets.filter(id => id !== bullet.id)
																)
															}
														}}
														className="mt-1 h-4 w-4 flex-shrink-0"
													/>

													<div className="flex-1">
														<div className="text-sm font-medium text-foreground">
															{bullet.content}
														</div>
														<div className="mt-2 text-xs text-muted-foreground">
															Why: {bullet.why}
														</div>

														{experiences.length > 0 && (
															<div className="mt-3">
																<label className="block text-xs font-medium text-muted-foreground mb-1">
																	Add to experience:
																</label>
																<select
																	value={selectedExpIndex}
																	onChange={(e) => {
																		const newIndex = parseInt(e.target.value)
																		setBulletExperienceMap(prev => ({
																			...prev,
																			[bullet.id]: newIndex
																		}))
																	}}
																	className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
																>
																	{experiences.map((exp: any, idx: number) => (
																		<option key={idx} value={idx}>
																			{exp.role} @ {exp.company} ({exp.startDate} - {exp.endDate || 'Present'})
																		</option>
																	))}
																</select>
															</div>
														)}
													</div>
												</div>
											</div>
										)
									})}
								</div>

								<div className="mt-4 flex items-center gap-4">
								<button
									onClick={async () => {
										if (selectedBullets.length === 0) return

										setSendingToBuilder(true)
										try {
											const res = await fetch('/resources/create-builder-from-analysis', {
												method: 'POST',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({
													analysisId: analysis.id,
													selectedBulletIds: selectedBullets,
													bulletExperienceMap: bulletExperienceMap,
												}),
											})

											if (res.status === 401) {
												nav(`/login?redirectTo=/analyze/results/${analysis.id}`)
												return
											}

											if (!res.ok) {
												const errorData = (await res.json()) as { error?: string }
												throw new Error(errorData.error || 'Failed to create builder resume')
											}

											await res.json()

											// Navigate to builder
											nav('/builder')
										} catch (error) {
											console.error('Failed to open in builder:', error)
											alert('Failed to open in builder. Please try again.')
										} finally {
											setSendingToBuilder(false)
										}
									}}
									disabled={selectedBullets.length === 0 || sendingToBuilder}
									className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition
										${
											selectedBullets.length === 0 || sendingToBuilder
												? 'cursor-not-allowed bg-primary/60 text-primary-foreground'
												: 'bg-primary text-primary-foreground hover:bg-primary/90'
										}`}
								>
									{sendingToBuilder && (
										<svg
											className="mr-2 h-4 w-4 animate-spin"
											viewBox="0 0 24 24"
											fill="none"
										>
											<circle
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
												opacity="0.25"
											/>
											<path
												d="M22 12a10 10 0 0 1-10 10"
												stroke="currentColor"
												strokeWidth="4"
												strokeLinecap="round"
											/>
										</svg>
									)}
									📝 Open in Builder with {selectedBullets.length} Selected Bullet{selectedBullets.length !== 1 ? 's' : ''}
								</button>
							</div>
						</>
					) : isStreamingActive ? (
						<div className="space-y-3">
							{[...Array(3)].map((_, i) => (
								<div key={i} className="rounded-lg border border-border p-4">
									<div className="flex gap-3">
										<div className="mt-1 h-4 w-4 rounded bg-muted" />
										<div className="flex-1 space-y-2">
											<div className="h-4 w-full animate-pulse rounded bg-muted" />
											<div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
											<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
										</div>
									</div>
								</div>
							))}
						</div>
					) : null}
				</div>

				</div>
			</section>

			{/* Footer nav */}
			<div className="mt-6 flex flex-wrap gap-4">
				<Link
					to={`../../analyze/job/${analysis.id}`}
					className="text-sm text-muted-foreground underline-offset-4 hover:underline"
				>
					← Back to Job
				</Link>
				<Link
					to="../../analyze"
					className="text-sm text-muted-foreground underline-offset-4 hover:underline"
				>
					Start Over
				</Link>
			</div>
		</div>
	)
}
