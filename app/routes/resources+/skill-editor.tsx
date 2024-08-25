import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { Field, ErrorList } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { type User } from '~/utils/auth.server.ts'
import { prisma } from '~/utils/db.server.ts'

export const SkillEditorSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	resumeId: z.string().min(1),
	redirectTo: z.string().optional(),
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
	let skill: { id: string; resume: { title: string | null; owner: User } }

	const { id, name, resumeId, redirectTo } = submission.value

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
	console.log('redirectTo', redirectTo)
	return redirect(redirectTo || `/users/${skill.resume.owner.username}/resume/edit`)
}

export function SkillEditor({
	skill,
	resume,
	redirectTo,
}: {
	skill?: {
		id: string
		name: string
	}
	resume: {
		id: string
	}
	redirectTo?: string;
}) {
	const skillEditorFetcher = useFetcher<typeof action>()

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

	return (
		<>
			<h2 className="mb-2 text-h2">{skill ? 'Edit' : 'Add'} skill</h2>
			<skillEditorFetcher.Form
				method="post"
				action="/resources/skill-editor"
				preventScrollReset
				{...form.props}
			>
				<input name="id" type="hidden" value={skill?.id} />
				<input name="resumeId" type="hidden" value={resume.id} />
				<input name="redirectTo" type="hidden" value={redirectTo} />
				<div>
					<Field
						labelProps={{
							htmlFor: fields.name.id,
							children: 'Skill',
						}}
						inputProps={{
							...conform.input(fields.name),
							autoComplete: 'name',
							autoFocus: true,
						}}
						errors={fields.name.errors}
					/>
				</div>
				<ErrorList errors={form.errors} id={form.errorId} />
				<div className="flex justify-end gap-4">
					<Button variant="secondary" type="reset">
						Reset
					</Button>
					<Button
						status={
							skillEditorFetcher.state === 'submitting'
								? 'pending'
								: skillEditorFetcher.data?.status ?? 'idle'
						}
						type="submit"
						disabled={skillEditorFetcher.state !== 'idle'}
					>
						Save
					</Button>
				</div>
			</skillEditorFetcher.Form>
		</>
	)
}
