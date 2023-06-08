import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { Button, ErrorList, Field, TextareaField } from '~/utils/forms.tsx'

export const JobEditorSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1),
	content: z.string().min(1),
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

	const { title, content, id } = submission.value

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
	}
	return redirect(`/users/${job.owner.username}/jobs/${job.id}`)
}

export function JobEditor({
	job,
}: {
	job?: { id: string; title: string; content: string }
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
			<input name="id" type="hidden" value={job?.id} />
			<Field
				labelProps={{ htmlFor: fields.title.id, children: 'Title' }}
				inputProps={{
					...conform.input(fields.title),
					autoComplete: 'title',
				}}
				errors={fields.title.errors}
			/>
			<TextareaField
				labelProps={{ htmlFor: fields.content.id, children: 'Content' }}
				textareaProps={{
					...conform.textarea(fields.content),
					autoComplete: 'content',
				}}
				errors={fields.content.errors}
			/>
			<ErrorList errors={form.errors} id={form.errorId} />
			<div className="flex justify-end gap-4">
				<Button size="md" variant="secondary" type="reset">
					Reset
				</Button>
				<Button
					size="md"
					variant="primary"
					status={
						jobEditorFetcher.state === 'submitting'
							? 'pending'
							: jobEditorFetcher.data?.status ?? 'idle'
					}
					type="submit"
					disabled={jobEditorFetcher.state !== 'idle'}
				>
					Submit
				</Button>
			</div>
		</jobEditorFetcher.Form>
	)
}
