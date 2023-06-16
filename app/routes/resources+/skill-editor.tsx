import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher, useNavigate, useRouteLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { type User } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'
import { Button, ErrorList, Field } from '~/utils/forms.tsx'

export const SkillEditorSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	resumeId: z.string().min(1),
})

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: SkillEditorSchema,
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
	let skill: { id: string; resume: { title: string; owner: User } }

	const { id, name, resumeId } = submission.value

	const data = {
		name,
		resumeId,
	}

	const select = {
		id: true,
		resume: {
			select: {
				title: true,
				owner: true,
			},
		},
	}
	if (id) {
		const existingSkill = await prisma.skill.findFirst({
			where: { id, resumeId },
			select: { id: true },
		})
		if (!existingSkill) {
			return json(
				{
					status: 'error',
					submission,
				} as const,
				{ status: 404 },
			)
		}
		skill = await prisma.skill.update({
			where: { id },
			data,
			select,
		})
	} else {
		skill = await prisma.skill.create({ data, select })
	}
	return redirect(`/users/${skill.resume.owner.username}/resume/edit`)
}

export function SkillEditor({
	skill,
}: {
	skill?: {
		id: string
		name: string
	}
}) {
	const skillEditorFetcher = useFetcher<typeof action>()
	const navigate = useNavigate()
	const editData = useRouteLoaderData(
		'routes/users+/$username_+/resume+/edit',
	) as { resume: any }

	const [form, fields] = useForm({
		id: 'skill-editor',
		constraint: getFieldsetConstraint(SkillEditorSchema),
		lastSubmission: skillEditorFetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: SkillEditorSchema })
		},
		defaultValue: {
			name: skill?.name,
			id: skill?.id,
		},
		shouldRevalidate: 'onBlur',
	})
	const dismissModal = () => navigate('..', { preventScrollReset: true })

	return (
		<Dialog.Root open={true}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 backdrop-blur-[2px]" />
				<Dialog.Content
					onEscapeKeyDown={dismissModal}
					onInteractOutside={dismissModal}
					onPointerDownOutside={dismissModal}
					className="fixed left-1/2 top-1/2 w-[90vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-night-500 p-12 shadow-lg"
				>
					<Dialog.Title asChild className="text-center">
						<h2 className="mb-2 text-h2">{skill ? 'Edit' : 'Add'} skill</h2>
					</Dialog.Title>
					<skillEditorFetcher.Form
						method="post"
						action="/resources/skill-editor"
						{...form.props}
					>
						<input name="id" type="hidden" value={skill?.id} />
						<input name="resumeId" type="hidden" value={editData?.resume?.id} />
						<div>
							<Field
								labelProps={{
									htmlFor: fields.name.id,
									children: 'Skill',
								}}
								inputProps={{
									...conform.input(fields.name),
									autoComplete: 'name',
								}}
								errors={fields.name.errors}
							/>
						</div>
						<ErrorList errors={form.errors} id={form.errorId} />
						<div className="flex justify-end gap-4">
							<Button size="md" variant="secondary" type="reset">
								Reset
							</Button>
							<Button
								size="md"
								variant="primary"
								status={
									skillEditorFetcher.state === 'submitting'
										? 'pending'
										: skillEditorFetcher.data?.status ?? 'idle'
								}
								type="submit"
								disabled={skillEditorFetcher.state !== 'idle'}
							>
								Submit
							</Button>
						</div>
					</skillEditorFetcher.Form>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	)
}
