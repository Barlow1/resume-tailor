import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	redirect,
	type DataFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { ErrorList, Field } from '~/components/forms.tsx'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { prepareVerification } from '~/routes/resources+/verify.tsx'
import { prisma } from '~/utils/db.server.ts'
import { sendEmail } from '~/utils/email.server.ts'
import { useIsSubmitting } from '~/utils/misc.ts'
import { emailSchema } from '~/utils/user-validation.ts'
import { SignupEmail } from './email.server.tsx'
import { GoogleReCaptcha } from 'react-google-recaptcha-v3'
import { useCallback, useState } from 'react'
import { getRecaptchaScore } from '~/utils/recaptcha.server.ts'

export const onboardingOTPQueryParam = 'code'
export const onboardingEmailQueryParam = 'email'
export const verificationType = 'onboarding'

export const SignupSchema = z.object({
	email: emailSchema,
})

export async function action({ request }: DataFunctionArgs) {
	const formData = await request.formData()
	const submission = await parse(formData, {
		schema: SignupSchema.superRefine(async (data, ctx) => {
			const existingUser = await prisma.user.findUnique({
				where: { email: data.email },
				select: { id: true },
			})
			if (existingUser) {
				ctx.addIssue({
					path: ['email'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this email',
				})
				return
			}
		}),
		acceptMultipleErrors: () => true,
		async: true,
	})
	const token = formData.get('_captcha')
	if (token && typeof token === 'string') {
		const score = await getRecaptchaScore(token, process.env.RECAPTCHA_SECRET_KEY)
		if (!score) {
			return json({ status: 'error', submission } as const, { status: 401 })
		}
	}
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const { email } = submission.value
	const { verifyUrl, redirectTo, otp } = await prepareVerification({
		period: 10 * 60,
		request,
		type: 'onboarding',
		target: email,
	})

	const response = await sendEmail({
		to: email,
		subject: `Welcome to Resume Tailor!`,
		react: <SignupEmail onboardingUrl={verifyUrl.toString()} otp={otp} />,
	})

	if (response.status === 'success') {
		return redirect(redirectTo.toString())
	} else {
		submission.error[''] = response.error.message
		return json({ status: 'error', submission } as const, { status: 500 })
	}
}

export const meta: MetaFunction = () => {
	return [
		{ title: 'Sign Up | Resume Tailor' },
		{
			name: 'description',
			content: 'Land more job interviews.',
		},
	]
}

export default function SignupRoute() {
	const actionData = useActionData<typeof action>()
	const isSubmitting = useIsSubmitting()
	const [form, fields] = useForm({
		id: 'signup-form',
		constraint: getFieldsetConstraint(SignupSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			const result = parse(formData, { schema: SignupSchema })
			return result
		},
		shouldRevalidate: 'onBlur',
	})
	const [token, setToken] = useState<string | null>(null)
	const onVerify = useCallback((token: string) => {
		setToken(token)
	}, [])

	return (
		<div className="flex flex-col justify-center pb-32 pt-20 md:container">
			<div className="text-center">
				<h1 className="text-h1">Let's start your journey!</h1>
				<p className="mt-3 text-body-md text-muted-foreground">
					Please enter your email.
				</p>
			</div>
			<Form
				method="POST"
				className="mx-auto mt-16 min-w-[368px] max-w-sm"
				{...form.props}
			>
				{token ? <input type="hidden" name="_captcha" value={token} /> : null}
				<Field
					labelProps={{
						htmlFor: fields.email.id,
						children: 'Email',
					}}
					inputProps={{ ...conform.input(fields.email), autoFocus: true }}
					errors={fields.email.errors}
				/>
				<ErrorList errors={form.errors} id={form.errorId} />
				<StatusButton
					className="w-full"
					status={isSubmitting ? 'pending' : actionData?.status ?? 'idle'}
					type="submit"
					disabled={isSubmitting || !token}
				>
					Submit
				</StatusButton>
			</Form>
			<GoogleReCaptcha onVerify={onVerify} action="signup" />
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
