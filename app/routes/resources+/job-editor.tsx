import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, Field, TextareaField } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const JobEditorSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1),
	content: z.string().min(1),
	redirectTo: z.string().optional(),
})

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: JobEditorSchema,
		acceptMultipleErrors: () => true,
	})
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
	let job: { id: string; owner: { username: string } }

	const { title, content, id, redirectTo } = submission.value

	const data = {
		ownerId: userId,
		title: title,
		content: content,
	}

	const select = {
		id: true,
		owner: {
			select: {
				username: true,
			},
		},
	}
	if (id) {
		const existingJob = await prisma.job.findFirst({
			where: { id, ownerId: userId },
			select: { id: true },
		})
		if (!existingJob) {
			return json(
				{
					status: 'error',
					submission,
				} as const,
				{ status: 404 },
			)
		}
		job = await prisma.job.update({
			where: { id },
			data,
			select,
		})
	} else {
		job = await prisma.job.create({ data, select })

		await prisma.gettingStartedProgress.upsert({
			create: {
				hasSavedJob: true,
				hasSavedResume: false,
				hasGeneratedResume: false,
				hasTailoredResume: false,
				ownerId: userId,
			},
			update: {
				hasSavedJob: true,
			},
			where: {
				ownerId: userId,
			},
		})
	}
	return redirect(
		`/users/${job.owner.username}/jobs/${job.id}${
			redirectTo ? `/${redirectTo}` : ''
		}`,
	)
}

export function JobEditor({
	job,
	redirectTo,
}: {
	job?: { id: string; title: string; content: string }
	redirectTo?: string
}) {
	const jobEditorFetcher = useFetcher<typeof action>()

	const [form, fields] = useForm({
		id: 'job-editor',
		constraint: getFieldsetConstraint(JobEditorSchema),
		lastSubmission: jobEditorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: JobEditorSchema })
		},
		defaultValue: {
			title: job?.title,
			content: job?.content,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<jobEditorFetcher.Form
			method="post"
			action="/resources/job-editor"
			{...form.props}
		>
			<h2 className="mb-2 text-h5">Add a job</h2>
			<p className="mb-2 text-gray-300">
				Copy and paste the job title & description your applying for
			</p>
			<input name="id" type="hidden" value={job?.id} />
			<input name="redirectTo" type="hidden" value={redirectTo} />
			<Field
				labelProps={{ htmlFor: fields.title.id, children: 'Job Title' }}
				inputProps={{
					...conform.input(fields.title),
					autoComplete: 'title',
				}}
				errors={fields.title.errors}
			/>
			<TextareaField
				labelProps={{ htmlFor: fields.content.id, children: 'Job Description' }}
				textareaProps={{
					...conform.textarea(fields.content),
					autoComplete: 'content',
				}}
				isAutoSize
				errors={fields.content.errors}
			/>
			<ErrorList errors={form.errors} id={form.errorId} />
			<div className="flex justify-end gap-4">
				<Button variant="secondary" type="reset">
					Reset
				</Button>
				<Button
					status={
						jobEditorFetcher.state === 'submitting'
							? 'pending'
							: jobEditorFetcher.data?.status ?? 'idle'
					}
					type="submit"
					disabled={jobEditorFetcher.state !== 'idle'}
				>
					Save
				</Button>
			</div>
		</jobEditorFetcher.Form>
	)
}
