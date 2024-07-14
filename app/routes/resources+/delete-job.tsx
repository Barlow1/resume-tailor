import { json, type DataFunctionArgs, redirect } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { Button } from '~/components/ui/button.tsx'
import { ErrorList } from '~/components/forms.tsx'

const DeleteFormSchema = z.object({
	jobid: z.string(),
})

export async function action({ request }: DataFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: DeleteFormSchema,
		acceptMultipleErrors: () => true,
	})
	if (!submission.value || submission.intent !== 'submit') {
		return json(
			{
				status: 'error',
				submission,
			} as const,
			{ status: 400 },
		)
	}

	const { jobid } = submission.value

	const job = await prisma.job.findFirst({
		select: { id: true, owner: { select: { username: true } } },
		where: {
			id: jobid,
			ownerId: userId,
		},
	})
	if (!job) {
		submission.error.jobid = ['Job not found']
		return json({ status: 'error', submission } as const, {
			status: 404,
		})
	}

	await prisma.job.delete({
		where: { id: job.id },
	})

	return redirect(`/users/${job.owner.username}/jobs`)
}

export function DeleteJob({ id }: { id: string }) {
	const jobDeleteFetcher = useFetcher<typeof action>()

	const [form] = useForm({
		id: 'delete-job',
		constraint: getFieldsetConstraint(DeleteFormSchema),
		onValidate({ formData }) {
			return parse(formData, { schema: DeleteFormSchema })
		},
	})

	return (
		<jobDeleteFetcher.Form
			method="post"
			action="/resources/delete-job"
			{...form.props}
		>
			<input type="hidden" name="jobid" value={id} />
			<Button
				type="submit"
				variant="danger"
				status={
					jobDeleteFetcher.state === 'submitting'
						? 'pending'
						: jobDeleteFetcher.data?.status ?? 'idle'
				}
				disabled={jobDeleteFetcher.state !== 'idle'}
			>
				Delete
			</Button>
			<ErrorList errors={form.errors} id={form.errorId} />
		</jobDeleteFetcher.Form>
	)
}
