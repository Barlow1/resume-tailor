import { parse } from '@conform-to/zod'
import { json, type DataFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { requireUserId } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const ROUTE_PATH = '/resources/delete-file'

const DeleteFormSchema = z.object({
	fileId: z.string(),
})

export async function action({ request }: DataFunctionArgs) {
	await requireUserId(request, { redirectTo: null })
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: DeleteFormSchema,
		acceptMultipleErrors: () => true,
	})
	if (!submission.value) {
		return json(
			{
				status: 'error',
				submission,
			} as const,
			{ status: 400 },
		)
	}
	if (submission.intent !== 'submit') {
		return json({ status: 'success', submission } as const)
	}
	const { fileId } = submission.value
	const file = await prisma.file.findFirst({
		select: { id: true },
		where: {
			id: fileId,
		},
	})
	if (!file) {
		submission.error.fileId = ['file not found']
		return json(
			{
				status: 'error',
				submission,
			} as const,
			{ status: 404 },
		)
	}

	await prisma.file.delete({
		where: { id: file.id },
	})

	return json({ status: 'success' } as const)
}
