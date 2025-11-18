import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	unstable_createMemoryUploadHandler,
	unstable_parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, useActionData, useNavigation } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { parseResumeWithOpenAI } from '~/utils/openai-resume-parser.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { getUserId } from '~/utils/auth.server.ts'

const MAX_SIZE = 1024 * 1024 * 10 // 10MB

const ResumeUploadSchema = z.object({
	resumeFile: z.preprocess(
		value => (value === '' ? new File([], '') : value),
		z
			.instanceof(File)
			.refine(file => file.name !== '' && file.size !== 0, 'File is required')
			.refine(
				file => file.size <= MAX_SIZE,
				'File size must be less than 10MB',
			)
			.refine(
				file => {
					const validTypes = [
						'application/pdf',
						'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
						'image/png',
						'image/jpeg',
					]
					return validTypes.includes(file.type)
				},
				'File must be PDF, DOCX, PNG, or JPEG',
			),
	),
})

export async function loader({ request }: LoaderFunctionArgs) {
	return json({})
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await getUserId(request)

	const formData = await unstable_parseMultipartFormData(
		request,
		unstable_createMemoryUploadHandler({ maxPartSize: MAX_SIZE }),
	)

	const submission = parse(formData, { schema: ResumeUploadSchema })

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

	const { resumeFile } = submission.value

	try {
		// Parse resume with OpenAI
		const parsedResume = await parseResumeWithOpenAI(resumeFile)

		// Store in database
		const quickResume = await prisma.quickTailoredResume.create({
			data: {
				userId: userId || undefined,
				parsedResumeJson: JSON.stringify(parsedResume),
				jobDescription: '', // Will be filled in next step
				keywordsJson: '[]',
				tailoredResumeJson: '{}',
				conservativeMode: true,
			},
		})

		// Redirect to input screen
		return redirect(`/quick-tailor/input/${quickResume.id}`)
	} catch (error) {
		console.error('Error parsing resume:', error)
		return json(
			{
				status: 'error',
				submission: {
					...submission,
					error: {
						resumeFile: ['Failed to parse resume. Please try again.'],
					},
				},
			} as const,
			{ status: 500 },
		)
	}
}

export default function QuickTailorIndex() {
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isSubmitting = navigation.state === 'submitting'

	const [form, fields] = useForm({
		id: 'quick-tailor-upload',
		constraint: getFieldsetConstraint(ResumeUploadSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ResumeUploadSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="container mx-auto max-w-2xl py-12">
			<div className="mb-8 text-center">
				<h1 className="text-4xl font-bold">Quick Resume Tailor</h1>
				<p className="mt-2 text-muted-foreground">
					Upload your resume, add a job description, and get a tailored resume
					in seconds
				</p>
			</div>

			<div className="rounded-lg border bg-card p-8">
				<Form method="post" encType="multipart/form-data" {...form.props}>
					<div className="space-y-4">
						<div>
							<label
								htmlFor={fields.resumeFile.id}
								className="block text-sm font-medium"
							>
								Upload Your Resume
							</label>
							<p className="mt-1 text-sm text-muted-foreground">
								PDF, DOCX, PNG, or JPEG (max 10MB)
							</p>
							<input
								{...conform.input(fields.resumeFile, { type: 'file' })}
								className="mt-2 block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:border-0 file:bg-transparent file:text-sm file:font-medium"
								accept=".pdf,.docx,image/png,image/jpeg"
							/>
							<ErrorList
								id={fields.resumeFile.errorId}
								errors={fields.resumeFile.errors}
							/>
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={isSubmitting}
						>
							{isSubmitting ? 'Uploading and parsing...' : 'Continue'}
						</Button>
					</div>
				</Form>
			</div>

			<div className="mt-8 space-y-4 text-sm text-muted-foreground">
				<h3 className="font-semibold text-foreground">How it works:</h3>
				<ol className="list-inside list-decimal space-y-2">
					<li>Upload your resume - we'll parse it automatically</li>
					<li>Paste the job description you're applying for</li>
					<li>
						We'll tailor your resume with XX placeholders for metrics you need
						to fill in
					</li>
					<li>Download your tailored resume as a Word document</li>
				</ol>
			</div>
		</div>
	)
}
