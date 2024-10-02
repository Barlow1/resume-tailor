import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	redirect,
	type DataFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Link, useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { ErrorList, Field } from '~/components/forms.tsx'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { prisma } from '~/utils/db.server.ts'
import { sendEmail } from '~/utils/email.server.ts'
import { emailSchema } from '~/utils/user-validation.ts'
import { ForgotUsernameEmail } from './email.server.tsx'

const ForgotUsernameSchema = z.object({
	email: emailSchema,
})

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	const submission = await parse(formData, {
		schema: ForgotUsernameSchema.superRefine(async (data, ctx) => {
			if (data.email.includes('@')) return

			// check the username exists. Usernames have to be unique anyway so anyone
			// signing up can check whether a username exists by trying to sign up
			// with it.
			const user = await prisma.user.findUnique({
				where: { username: data.email },
				select: { id: true },
			})
			if (!user) {
				ctx.addIssue({
					path: ['email'],
					code: z.ZodIssueCode.custom,
					message: 'No user exists with this username',
				})
				return
			}
		}),
		async: true,
		acceptMultipleErrors: () => true,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const { email } = submission.value
	const redirectTo = '/login';

	// fire, forget, and don't wait to combat timing attacks
	void sendUsernameEmail({ request, target: email })

	return redirect(redirectTo.toString())
}

async function sendUsernameEmail({
	request,
	target,
}: {
	request: Request
	target: string
}) {
	const user = await prisma.user.findFirst({
		where: { OR: [{ email: target }, { username: target }] },
		select: { email: true, username: true },
	})
	if (!user) {
		// maybe they're trying to see whether a user exists? We're not gonna tell them...
		return
	}

	await sendEmail({
		to: user.email,
		subject: `Resume Tailor Username Reset`,
		react: (
			<ForgotUsernameEmail username={user.username} />
		),
	})
}

export const meta: MetaFunction = () => {
	return [{ title: 'Username Recovery for Resume Tailor' }]
}

export default function ForgotUsernameRoute() {
	const forgotUsername = useFetcher<typeof action>()

	const [form, fields] = useForm({
		id: 'forgot-username-form',
		constraint: getFieldsetConstraint(ForgotUsernameSchema),
		lastSubmission: forgotUsername.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ForgotUsernameSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="md:container pb-32 pt-20">
			<div className="flex flex-col justify-center">
				<div className="text-center">
					<h1 className="text-h1">Forgot Username</h1>
					<p className="mt-3 text-body-md text-muted-foreground">
						No worries, we'll send your username to your email.
					</p>
				</div>
				<forgotUsername.Form
					method="POST"
					{...form.props}
					className="mx-auto mt-16 min-w-[368px] max-w-sm"
				>
					<div>
						<Field
							labelProps={{
								htmlFor: fields.email.id,
								children: 'Email',
							}}
							inputProps={{
								autoFocus: true,
								...conform.input(fields.email),
							}}
							errors={fields.email.errors}
						/>
					</div>
					<ErrorList errors={form.errors} id={form.errorId} />

					<div className="mt-6">
						<StatusButton
							className="w-full"
							status={
								forgotUsername.state === 'submitting'
									? 'pending'
									: forgotUsername.data?.status ?? 'idle'
							}
							type="submit"
							disabled={forgotUsername.state !== 'idle'}
						>
							Recover username
						</StatusButton>
					</div>
				</forgotUsername.Form>
				<Link to="/login" className="mt-11 text-center text-body-sm font-bold">
					Back to Login
				</Link>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
