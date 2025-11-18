import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData, useNavigation } from '@remix-run/react'
import { prisma } from '~/utils/db.server.ts'
import { getJobFit, getQuickTailoredResume } from '~/utils/openai.server.ts'
import { extractKeywords } from '~/utils/keyword-extraction.server.ts'
import { semanticKeywordMatch } from '~/utils/semantic-keyword-matcher.server.ts'
import { Button } from '~/components/ui/button.tsx'
import { Download, FileText } from 'lucide-react'

export async function loader({ params }: LoaderFunctionArgs) {
	const { id } = params

	if (!id) {
		throw new Response('Not Found', { status: 404 })
	}

	const quickResume = await prisma.quickTailoredResume.findUnique({
		where: { id },
	})

	if (!quickResume) {
		throw new Response('Not Found', { status: 404 })
	}

	const tailoredResume = JSON.parse(quickResume.tailoredResumeJson) as any
	const originalResume = JSON.parse(quickResume.parsedResumeJson) as any
	const keywords = JSON.parse(quickResume.keywordsJson) as string[]

	console.log('[Results Loader] About to perform semantic keyword matching...')
	console.log('[Results Loader] Job description length:', quickResume.jobDescription.length)
	console.log('[Results Loader] Tailored resume JSON size:', JSON.stringify(tailoredResume).length)
	console.log('[Results Loader] Keywords to match:', keywords.length)

	// Use AI semantic matching instead of literal keyword matching
	// This accounts for synonyms, variations, and conceptual matches
	const { matchedKeywords, missedKeywords, matchScore: semanticMatchScore } = await semanticKeywordMatch({
		keywords,
		resume: tailoredResume,
	})

	console.log('[Results Loader] Semantic matching complete:', {
		matched: matchedKeywords.length,
		missed: missedKeywords.length,
		score: semanticMatchScore,
	})

	let jobFitData: any = {
		match_score: semanticMatchScore,
		highlights: [
			{
				label: 'ATS Keywords Matched',
				detail: `Resume demonstrates ${matchedKeywords.length} of ${keywords.length} key requirements (using AI semantic matching)`,
				evidence: { text: matchedKeywords.slice(0, 5).join(', ') + (matchedKeywords.length > 5 ? '...' : ''), experienceId: null, descriptionId: null }
			},
			{
				label: 'Bullet Points Enhanced',
				detail: 'Rewrote experience bullets to match job requirements using CAR/STAR format',
				evidence: { text: 'Enhanced with quantified achievements and action verbs', experienceId: null, descriptionId: null }
			}
		],
		skills: {
			matched: matchedKeywords,
			missing: missedKeywords
		},
		recommendations: [
			'Replace any XX placeholders with your actual metrics before applying',
			'Customize the summary section further if needed',
			'Proofread for any formatting issues',
		],
	}

	console.log('[Results Loader] Using quick default job fit data (getJobFit disabled)')

	// COMMENTED OUT - CAUSING HANG
	// try {
	// 	const startTime = Date.now()
	// 	console.log('[Results Loader] Calling getJobFit at', new Date().toISOString())

	// 	const { response } = await getJobFit({
	// 		jobTitle: 'Target Role',
	// 		jobDescription: quickResume.jobDescription,
	// 		resume: tailoredResume as any,
	// 		user: { id: quickResume.userId || 'anonymous', username: 'quick_tailor_user' },
	// 	})

	// 	const elapsedTime = Date.now() - startTime
	// 	console.log('[Results Loader] getJobFit complete in', elapsedTime, 'ms')
	// 	console.log('[Results Loader] Response content length:', response.choices[0]?.message?.content?.length)

	// 	jobFitData = JSON.parse(response.choices[0]?.message?.content || '{}') as any
	// } catch (error) {
	// 	console.error('[Results Loader] Error calling getJobFit:', error)
	// 	// Continue with empty defaults if job fit analysis fails
	// 	jobFitData = {
	// 		match_score: 75,
	// 		highlights: [],
	// 		skills: { matched: [], missing: [] },
	// 		recommendations: ['Fill in XX placeholders with actual metrics', 'Review and verify all bullet points', 'Ensure skills section is complete'],
	// 	}
	// }

	console.log('[Results Loader] Returning results...')

	return json({
		id,
		tailoredResume,
		originalResume,
		keywords,
		matchScore: (jobFitData.match_score || 0) as number,
		highlights: (jobFitData.highlights || []) as any[],
		skills: (jobFitData.skills || { matched: [], missing: [] }) as { matched: string[]; missing: string[] },
		recommendations: (jobFitData.recommendations || []) as string[],
		conservativeMode: quickResume.conservativeMode,
		fitWarning: tailoredResume.fit_warning || null,
	})
}

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData()
	const action = formData.get('action')

	if (action === 'retailor-with-context') {
		const resumeId = formData.get('resumeId') as string
		const additionalContext = formData.get('additionalContext') as string

		if (!resumeId || !additionalContext?.trim()) {
			throw new Response('Missing required fields', { status: 400 })
		}

		// Fetch the existing tailored resume
		const quickTailored = await prisma.quickTailoredResume.findUnique({
			where: { id: resumeId },
		})

		if (!quickTailored) {
			throw new Response('Resume not found', { status: 404 })
		}

		// Re-extract keywords to ensure we have them
		const keywords = JSON.parse(quickTailored.keywordsJson) as string[]
		const previousTailored = JSON.parse(quickTailored.tailoredResumeJson)

		// Re-run tailoring WITH the additional context
		// Pass the previous tailored resume separately so AI can preserve good work
		const { response } = await getQuickTailoredResume({
			parsedResume: JSON.parse(quickTailored.parsedResumeJson),
			jobDescription: quickTailored.jobDescription,
			keywords,
			conservativeMode: quickTailored.conservativeMode,
			additionalContext, // User's context about their experience
			previousTailoredResume: previousTailored, // Previous version to build on
		})

		const tailoredResumeContent = response.choices[0]?.message?.content
		if (!tailoredResumeContent) {
			throw new Error('Failed to generate tailored resume')
		}

		const tailoredResume = JSON.parse(tailoredResumeContent)

		// Update the database with the new tailored resume
		await prisma.quickTailoredResume.update({
			where: { id: resumeId },
			data: {
				tailoredResumeJson: JSON.stringify(tailoredResume),
			},
		})

		// Redirect back to results to show updated resume
		return redirect(`/quick-tailor/results/${resumeId}`)
	}

	return null
}

export default function QuickTailorResults() {
	const { id, tailoredResume, originalResume, matchScore, highlights, skills, recommendations, conservativeMode, fitWarning } = useLoaderData<typeof loader>()
	const navigation = useNavigation()
	const isRetailoring = navigation.state === 'submitting' && navigation.formData?.get('action') === 'retailor-with-context'

	// Calculate qualitative fit level based on match score
	let fitLevel =
		matchScore >= 70 ? { label: 'Strong Fit', color: 'green', emoji: '✅', bgColor: 'bg-green-50', borderColor: 'border-green-500', textColor: 'text-green-700' } :
		matchScore >= 50 ? { label: 'Good Fit', color: 'blue', emoji: '👍', bgColor: 'bg-blue-50', borderColor: 'border-blue-500', textColor: 'text-blue-700' } :
		matchScore >= 30 ? { label: 'Moderate Fit', color: 'yellow', emoji: '⚠️', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500', textColor: 'text-yellow-700' } :
		{ label: 'Poor Fit', color: 'red', emoji: '❌', bgColor: 'bg-red-50', borderColor: 'border-red-500', textColor: 'text-red-700' }

	// Adjust fit level based on domain expertise warnings
	if (fitWarning) {
		if (fitWarning.level === 'red') {
			// Red warnings: Always override to Poor Fit (serious domain mismatch)
			fitLevel = { label: 'Poor Fit', color: 'red', emoji: '❌', bgColor: 'bg-red-50', borderColor: 'border-red-500', textColor: 'text-red-700' }
		} else if (fitWarning.level === 'yellow') {
			// Yellow warnings: Downgrade by one level (transferable but notable gaps)
			if (matchScore >= 70) {
				// Strong Fit → Good Fit
				fitLevel = { label: 'Good Fit', color: 'blue', emoji: '👍', bgColor: 'bg-blue-50', borderColor: 'border-blue-500', textColor: 'text-blue-700' }
			} else if (matchScore >= 50) {
				// Good Fit → Moderate Fit
				fitLevel = { label: 'Moderate Fit', color: 'yellow', emoji: '⚠️', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500', textColor: 'text-yellow-700' }
			}
			// Moderate/Poor stay the same
		}
	}

	// Check if there are actually XX placeholders in the resume
	const hasXXPlaceholders = JSON.stringify(tailoredResume).includes('XX')

	// Helper: check if bullet contains XX placeholder
	const hasPlaceholder = (text: string) => text.includes('XX')

	// Helper: check if bullet was added (new index beyond original length)
	const isNewBullet = (expIdx: number, bulletIdx: number) => {
		const originalExp = originalResume?.experiences?.[expIdx]
		const originalBulletCount = originalExp?.bullet_points?.length || 0
		return bulletIdx >= originalBulletCount
	}

	// Helper: check if bullet was rewritten (text changed but not new)
	const wasRewritten = (expIdx: number, bulletIdx: number) => {
		const originalExp = originalResume?.experiences?.[expIdx]
		const originalBullet = originalExp?.bullet_points?.[bulletIdx]
		const tailoredBullet = tailoredResume.experiences?.[expIdx]?.bullet_points?.[bulletIdx]

		if (!originalBullet || !tailoredBullet) return false
		return originalBullet !== tailoredBullet && bulletIdx < (originalExp?.bullet_points?.length || 0)
	}

	// Helper: check if summary was rewritten
	const summaryWasRewritten = () => {
		const originalSummary = originalResume?.summary || ''
		const tailoredSummary = tailoredResume.summary || ''
		return originalSummary !== tailoredSummary && originalSummary.length > 0
	}

	// Helper: get added skills
	const getAddedSkills = () => {
		const originalSkills = originalResume?.skills || []
		const tailoredSkills = tailoredResume.skills || []
		return tailoredSkills.filter((skill: string) => !originalSkills.includes(skill))
	}

	const addedSkills = getAddedSkills()

	return (
		<div className="container mx-auto max-w-6xl py-12">
			{/* FIT WARNING - Compact and respectful */}
			{fitWarning && (
				<div className={
					fitWarning.level === 'red'
						? 'bg-red-50 border-l-4 border-red-600 rounded p-6 mb-6'
						: 'bg-yellow-50 border-l-4 border-yellow-500 rounded p-6 mb-6'
				}>
					<div className="flex items-start gap-3">
						<span className="text-2xl">{fitWarning.level === 'red' ? '⚠️' : '💡'}</span>
						<div className="flex-1">
							<h3 className="font-bold text-lg mb-2">
								{fitWarning.level === 'red'
									? 'Poor Fit for This Role'
									: 'Moderate Fit - Consider These Points'}
							</h3>

							{/* Just show ONE key reason, not all 5 */}
							<p className="text-gray-800 mb-3">
								{fitWarning.reasons?.[0]}
							</p>

							{/* Collapsible details */}
							<details className="mb-3">
								<summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
									See detailed assessment →
								</summary>
								<div className="mt-3 pl-4 border-l-2 border-gray-300 space-y-3">
									{fitWarning.reasons && fitWarning.reasons.length > 1 && (
										<div>
											<p className="font-semibold mb-1">Key concerns:</p>
											<ul className="text-sm space-y-1">
												{fitWarning.reasons.slice(1).map((reason: string, idx: number) => (
													<li key={idx}>• {reason}</li>
												))}
											</ul>
										</div>
									)}

									{fitWarning.hard_questions && fitWarning.hard_questions.length > 0 && (
										<div>
											<p className="font-semibold mb-1">Can you answer these?</p>
											<ul className="text-sm space-y-1">
												{fitWarning.hard_questions.slice(0, 3).map((q: string, idx: number) => (
													<li key={idx}>• {q}</li>
												))}
											</ul>
										</div>
									)}
								</div>
							</details>

							{/* NEW: Option to provide context */}
							<details className="mb-3">
								<summary className="cursor-pointer text-purple-600 hover:text-purple-800 font-medium">
									✏️ I have relevant experience - let me explain →
								</summary>
								<Form method="post" className="mt-3 space-y-3">
									<input type="hidden" name="action" value="retailor-with-context" />
									<input type="hidden" name="resumeId" value={id} />

									<div>
										<label className="block text-sm font-medium mb-1">
											Additional context about your experience:
										</label>
										<textarea
											name="additionalContext"
											rows={6}
											className="w-full border border-gray-300 rounded p-3 text-sm"
											placeholder={`Example for government workflow role:\n\nAt Apollo Medical, I worked directly with VA hospitals and navigated federal HIPAA compliance. I led procurement discussions with 3 government healthcare agencies and managed a 6-month contracting cycle. The 'digital health platform' was actually a documentation system for government-funded clinics serving 5,000+ veterans.\n\nBe specific: What did you actually do? Who were your users? What workflows did you optimize?`}
										/>
									</div>

									<div className="flex gap-3">
										<button
											type="submit"
											disabled={isRetailoring}
											className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded font-medium flex items-center gap-2"
										>
											{isRetailoring && (
												<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											)}
											{isRetailoring ? 'Re-tailoring...' : 'Re-tailor with this context'}
										</button>
										{!isRetailoring && (
											<p className="text-xs text-gray-600 self-center">
												We'll re-generate your resume with this information
											</p>
										)}
									</div>
								</Form>
							</details>

							{/* Short, direct recommendation */}
							<p className="text-sm text-gray-700">
								<strong>Our take:</strong>{' '}
								{fitWarning.level === 'red'
									? `This role requires domain expertise you don't have. If you have relevant experience, add context above. Otherwise, consider roles in ${fitWarning.alternative_suggestion?.split(':')[1]?.split('.')[0] || 'adjacent domains'}.`
									: 'You can apply, but be ready to address these gaps in your cover letter.'}
							</p>
						</div>
					</div>
				</div>
			)}

			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="text-4xl font-bold">Your Tailored Resume</h1>
					<p className="mt-2 text-muted-foreground">
						Optimized for ATS and tailored to the job requirements
					</p>
				</div>

				<div className="flex gap-3">
					<Link to={`/resources/download-docx?id=${id}`} reloadDocument>
						<Button size="lg" className="gap-2">
							<Download className="h-4 w-4" />
							Download DOCX
						</Button>
					</Link>
				</div>
			</div>

			{/* Match Score Badge */}
			<div className={`mb-6 rounded-lg border-2 ${fitLevel.borderColor} ${fitLevel.bgColor} p-6`}>
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">Resume Fit Assessment</h2>
						<p className="text-sm text-muted-foreground">
							Based on {skills.matched.length} of {skills.matched.length + skills.missing.length} key requirements
						</p>
					</div>
					<div className="flex flex-col items-center justify-center gap-2">
						<span className="text-5xl">{fitLevel.emoji}</span>
						<span className={`text-xl font-bold ${fitLevel.textColor}`}>{fitLevel.label}</span>
					</div>
				</div>

				{/* Skills match summary */}
				<div className="mt-4 grid grid-cols-2 gap-4">
					<div className="rounded-md bg-green-50 p-3 dark:bg-green-950/20">
						<p className="text-sm font-medium text-green-900 dark:text-green-100">
							Matched Skills: {skills.matched.length}
						</p>
						<p className="mt-1 text-xs text-green-700 dark:text-green-300">
							{skills.matched.slice(0, 5).join(', ')}
							{skills.matched.length > 5 && `... +${skills.matched.length - 5} more`}
						</p>
					</div>
					<div className="rounded-md bg-orange-50 p-3 dark:bg-orange-950/20">
						<p className="text-sm font-medium text-orange-900 dark:text-orange-100">
							Missing Skills: {skills.missing.length}
						</p>
						<p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
							{skills.missing.slice(0, 5).join(', ')}
							{skills.missing.length > 5 && `... +${skills.missing.length - 5} more`}
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Left Column: Resume Preview */}
				<div className="space-y-6">
					<div className="rounded-lg border bg-card p-6">
						<div className="mb-4 flex items-center gap-2">
							<FileText className="h-5 w-5" />
							<h2 className="text-lg font-semibold">Resume Preview</h2>
						</div>

						<div className="space-y-6 text-sm">
							{/* Header */}
							<div className="border-b pb-4 text-center">
								<h3 className="text-2xl font-bold">{tailoredResume.personal_info.full_name}</h3>
								<p className="mt-1 text-muted-foreground">
									{tailoredResume.personal_info.email} | {tailoredResume.personal_info.phone}
								</p>
								{tailoredResume.personal_info.location && (
									<p className="text-muted-foreground">{tailoredResume.personal_info.location}</p>
								)}
							</div>

							{/* Summary */}
							{tailoredResume.summary && (
								<div>
									<h4 className="mb-2 font-semibold uppercase">Professional Summary</h4>
									<div className={summaryWasRewritten() ? 'rounded-md border-l-4 border-yellow-500 bg-yellow-50 p-3 dark:bg-yellow-950/20' : ''}>
										<p className="text-muted-foreground">{tailoredResume.summary}</p>
										{summaryWasRewritten() && (
											<p className="mt-2 text-xs font-medium text-yellow-700 dark:text-yellow-400">
												✏️ Enhanced for keywords and impact
											</p>
										)}
									</div>
								</div>
							)}

							{/* Experience */}
							{tailoredResume.experiences && tailoredResume.experiences.length > 0 && (
								<div>
									<h4 className="mb-3 font-semibold uppercase">Professional Experience</h4>
									<div className="space-y-4">
										{tailoredResume.experiences.map((exp: any, idx: number) => (
											<div key={idx} className="space-y-2">
												<div>
													<p className="font-semibold">
														{exp.title} | {exp.company}
													</p>
													<p className="text-xs text-muted-foreground">
														{exp.date_start} - {exp.date_end || 'Present'}
														{exp.location && ` | ${exp.location}`}
													</p>
												</div>
												<ul className="ml-4 list-disc space-y-1 text-muted-foreground">
													{exp.bullet_points.map((bullet: string, bidx: number) => {
														const isNew = isNewBullet(idx, bidx)
														const hasXX = hasPlaceholder(bullet)
														const rewritten = wasRewritten(idx, bidx)

														// Determine styling based on change type
														let className = ''
														let label = ''

														if (isNew) {
															className = 'rounded-md border-l-4 border-green-500 bg-green-50 p-2 my-1 dark:bg-green-950/20'
															label = hasXX ? '➕ Added - Fill in XX values' : '➕ Added'
														} else if (hasXX) {
															className = 'rounded-md border-l-4 border-orange-500 bg-orange-50 p-2 my-1 dark:bg-orange-950/20'
															label = '⚠️ Fill in XX values'
														} else if (rewritten) {
															className = 'rounded-md border-l-4 border-yellow-500 bg-yellow-50 p-2 my-1 dark:bg-yellow-950/20'
															label = '✏️ Enhanced'
														}

														return (
															<li key={bidx} className={className || ''}>
																{bullet}
																{label && (
																	<span className={`ml-2 text-xs font-medium ${
																		isNew ? 'text-green-700 dark:text-green-400' :
																		hasXX ? 'text-orange-700 dark:text-orange-400' :
																		'text-yellow-700 dark:text-yellow-400'
																	}`}>
																		{label}
																	</span>
																)}
															</li>
														)
													})}
												</ul>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Skills */}
							{tailoredResume.skills && tailoredResume.skills.length > 0 && (
								<div>
									<h4 className="mb-2 font-semibold uppercase">Skills</h4>
									<div className="flex flex-wrap gap-2">
										{tailoredResume.skills.map((skill: string, sidx: number) => {
											const isAdded = addedSkills.includes(skill)
											return (
												<span
													key={sidx}
													className={
														isAdded
															? 'rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-700 dark:bg-green-950/20 dark:text-green-400'
															: 'rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-900'
													}
												>
													{skill}
													{isAdded && <span className="ml-1">✨</span>}
												</span>
											)
										})}
									</div>
								</div>
							)}

							{/* Education */}
							{tailoredResume.education && tailoredResume.education.length > 0 && (
								<div>
									<h4 className="mb-3 font-semibold uppercase">Education</h4>
									<div className="space-y-2">
										{tailoredResume.education.map((edu: any, idx: number) => (
											<div key={idx}>
												<p className="font-semibold">
													{edu.school} | {edu.degree} in {edu.major}
												</p>
												<p className="text-xs text-muted-foreground">
													{edu.date_start} - {edu.date_end || 'Present'}
													{edu.location && ` | ${edu.location}`}
												</p>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Column: Analysis */}
				<div className="space-y-6">
					{/* Why We Selected These Bullets */}
					<div className="rounded-lg border bg-card p-6">
						<h2 className="mb-4 text-lg font-semibold">Why We Made These Changes</h2>
						<div className="space-y-4">
							{highlights.slice(0, 4).map((highlight: any, idx: number) => (
								<div key={idx} className="rounded-md bg-muted p-3">
									<p className="font-medium">{highlight.label}</p>
									<p className="mt-1 text-sm text-muted-foreground">{highlight.detail}</p>
									{highlight.evidence && (
										<p className="mt-2 text-xs italic text-muted-foreground">"{highlight.evidence.text}"</p>
									)}
								</div>
							))}
						</div>
					</div>

					{/* Recommendations */}
					{recommendations.length > 0 && (
						<div className="rounded-lg border bg-card p-6">
							<h2 className="mb-4 text-lg font-semibold">Next Steps</h2>
							<ul className="space-y-2">
								{recommendations.map((rec: string, idx: number) => (
									<li key={idx} className="flex gap-2 text-sm">
										<span className="font-semibold text-primary">{idx + 1}.</span>
										<span className="text-muted-foreground">{rec}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{hasXXPlaceholders && (
						<div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-6 dark:border-orange-900 dark:bg-orange-950/20">
							<h3 className="font-semibold text-orange-900 dark:text-orange-100">
								Don't Forget to Replace XX Placeholders!
							</h3>
							<p className="mt-2 text-sm text-orange-700 dark:text-orange-300">
								Your resume has "XX" placeholders where specific metrics would make
								your accomplishments stronger. Open the downloaded Word document and
								replace these with your real numbers before submitting.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="mt-8 flex gap-4">
				<Link to="/quick-tailor">
					<Button variant="outline">Tailor Another Resume</Button>
				</Link>
			</div>
		</div>
	)
}
