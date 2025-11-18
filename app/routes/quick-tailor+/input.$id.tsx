import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, TextareaField } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { prisma } from '~/utils/db.server.ts'
import { extractKeywordsFromJobDescription } from '~/utils/keyword-extraction.server.ts'
import { getQuickTailoredResume } from '~/utils/openai.server.ts'
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server.ts'

const JobInputSchema = z.object({
	jobDescription: z.string().min(50, 'Job description must be at least 50 characters'),
})

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

	const parsedResume = JSON.parse(
		quickResume.parsedResumeJson,
	) as OpenAIResumeData

	// Count total accomplishments (bullet points across all experiences)
	const totalAccomplishments = parsedResume.experiences.reduce(
		(count, exp) => count + (exp.bullet_points?.length || 0),
		0,
	)

	return json({
		id,
		totalAccomplishments,
		totalExperiences: parsedResume.experiences.length,
	})
}

export async function action({ request, params }: ActionFunctionArgs) {
	const { id } = params

	if (!id) {
		throw new Response('Not Found', { status: 404 })
	}

	const formData = await request.formData()
	const submission = parse(formData, { schema: JobInputSchema })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (!submission.value) {
		return json(
			{
				status: 'error',
				submission,
			} as const,
			{ status: 400 },
		)
	}

	const { jobDescription } = submission.value

	try {
		// Get the quick resume record
		const quickResume = await prisma.quickTailoredResume.findUnique({
			where: { id },
		})

		if (!quickResume) {
			throw new Response('Not Found', { status: 404 })
		}

		// Extract keywords from job description
		const keywords = await extractKeywordsFromJobDescription(jobDescription)

		// Parse the resume
		const parsedResume = JSON.parse(quickResume.parsedResumeJson)

		// Tailor the resume with OpenAI (always use conservative mode with XX placeholders)
		const { response } = await getQuickTailoredResume({
			parsedResume,
			jobDescription,
			keywords,
			conservativeMode: true,
		})

		const tailoredResumeContent = response.choices[0]?.message?.content

		if (!tailoredResumeContent) {
			throw new Error('Failed to generate tailored resume')
		}

		// Parse the response as JSON (strip markdown code fences if present)
		let tailoredResume
		try {
			let cleanedText = tailoredResumeContent.trim()

			// Remove markdown code fences if present
			if (cleanedText.startsWith('```json')) {
				cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
			} else if (cleanedText.startsWith('```')) {
				cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '')
			}

			tailoredResume = JSON.parse(cleanedText) as any

			// VERIFY STRUCTURE
			console.log('✅ Tailored resume structure:', {
				hasPersonalInfo: !!tailoredResume.personal_info,
				hasSummary: !!tailoredResume.summary,
				experiencesCount: tailoredResume.experiences?.length || 0,
				firstExpHasBullets: tailoredResume.experiences?.[0]?.bullet_points?.length || 0,
				educationCount: tailoredResume.education?.length || 0,
				skillsCount: tailoredResume.skills?.length || 0,
			})
			console.log('First experience sample:', tailoredResume.experiences?.[0])

			// 🚨 FIT WARNING CHECK
			console.log('🚨 FIT WARNING CHECK:', {
				hasFitWarning: !!tailoredResume.fit_warning,
				fitWarningLevel: tailoredResume.fit_warning?.level,
				fitWarning: tailoredResume.fit_warning,
			})
		} catch (e) {
			console.error('Failed to parse tailored resume JSON:', e)
			console.error('Raw content:', tailoredResumeContent.substring(0, 200))
			throw new Error('Failed to parse tailored resume')
		}

		// Update the database record
		await prisma.quickTailoredResume.update({
			where: { id },
			data: {
				jobDescription,
				keywordsJson: JSON.stringify(keywords),
				tailoredResumeJson: JSON.stringify(tailoredResume),
				conservativeMode: true,
			},
		})

		// Redirect to results page
		return redirect(`/quick-tailor/results/${id}`)
	} catch (error) {
		console.error('Error tailoring resume:', error)
		return json(
			{
				status: 'error',
				submission: {
					...submission,
					error: {
						'': ['Failed to tailor resume. Please try again.'],
					},
				},
			} as const,
			{ status: 500 },
		)
	}
}

export default function QuickTailorInput() {
	const { id, totalAccomplishments, totalExperiences } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state === 'submitting'

	const [form, fields] = useForm({
		id: 'quick-tailor-input',
		constraint: getFieldsetConstraint(JobInputSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: JobInputSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="container mx-auto max-w-3xl py-12">
			<div className="mb-8">
				<h1 className="text-4xl font-bold">Add Job Description</h1>
				<p className="mt-2 text-muted-foreground">
					We found {totalAccomplishments} accomplishments across{' '}
					{totalExperiences} positions in your resume
				</p>
			</div>

			<div className="rounded-lg border bg-card p-8">
				<Form method="post" {...form.props}>
					<div className="space-y-6">
						<TextareaField
							labelProps={{
								htmlFor: fields.jobDescription.id,
								children: 'Job Description',
							}}
							textareaProps={
								{
									...conform.textarea(fields.jobDescription),
									placeholder:
										'Paste the full job description here...\n\nInclude requirements, responsibilities, and qualifications for best results.',
									rows: 12,
								} as any
							}
							errors={fields.jobDescription.errors}
						/>

						{actionData?.status === 'error' && actionData.submission.error?.[''] && (
							<ErrorList errors={actionData.submission.error[''] as any} />
						)}

						<Button type="submit" className="w-full flex items-center justify-center gap-2" disabled={isSubmitting} size="lg">
							{isSubmitting && (
								<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							)}
							{isSubmitting ? 'Tailoring your resume...' : 'Tailor My Resume'}
						</Button>
					</div>
				</Form>
			</div>

			<div className="mt-8 rounded-lg bg-muted p-6">
				<h3 className="font-semibold">What happens next:</h3>
				<ul className="mt-2 space-y-2 text-sm text-muted-foreground">
					<li>
						✓ We'll extract key requirements and skills from the job description
					</li>
					<li>
						✓ Optimize your resume bullet points to match the job requirements using AI
					</li>
					<li>
						✓ Add relevant keywords and enhance your accomplishments for ATS optimization
					</li>
					<li>✓ Generate a downloadable Word document you can customize and submit</li>
				</ul>
			</div>
		</div>
	)
}
