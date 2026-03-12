import { json, type DataFunctionArgs, redirect } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { deleteBuilderResume } from '~/utils/builder-resume.server.ts'
import { Button } from '~/components/ui/button.tsx'
import { ErrorList } from '~/components/forms.tsx'

const DeleteFormSchema = z.object({
	resumeId: z.string(),
})

export async function action({ request }: DataFunctionArgs) {
	await requireUserId(request)
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

	const { resumeId } = submission.value

	try {
		await deleteBuilderResume(resumeId)
	} catch {
		submission.error.resumeId = ['Resume not found']
		return json({ status: 'error', submission } as const, {
			status: 404,
		})
	}

	return redirect('/builder')
}

export function DeleteResume({ id }: { id: string }) {
	const fetcher = useFetcher<typeof action>()

	const [form] = useForm({
		id: `delete-resume-${id}`,
		constraint: getFieldsetConstraint(DeleteFormSchema),
		onValidate({ formData }) {
			return parse(formData, { schema: DeleteFormSchema })
		},
	})

	return (
		<fetcher.Form
			method="post"
			action="/resources/delete-resume"
			{...form.props}
			onSubmit={event => {
				if (!confirm('Are you sure? This cannot be undone.')) {
					event.preventDefault()
				}
			}}
		>
			<input type="hidden" name="resumeId" value={id} />
			<Button
				type="submit"
				variant="danger"
				size="sm"
				status={
					fetcher.state === 'submitting'
						? 'pending'
						: fetcher.data?.status ?? 'idle'
				}
				disabled={fetcher.state !== 'idle'}
			>
				Delete
			</Button>
			<ErrorList errors={form.errors} id={form.errorId} />
		</fetcher.Form>
	)
}
