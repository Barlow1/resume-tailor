import type { MetaFunction } from '@remix-run/node'
import { addJob, background, tailorJob, topCompanies } from './logos/logos.ts'
import { Link, useActionData, useFetcher } from '@remix-run/react'
import { Button } from '~/components/ui/button.tsx'
import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	SignupSchema,
	type action as signupAction,
} from '../_auth+/signup/index.tsx'
import { ErrorList, Field } from '~/components/forms.tsx'
import { useIsSubmitting } from '~/utils/misc.ts'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { FAQ }  from '~/components/ui/faq.tsx'

export const meta: MetaFunction = () => [
	{ title: 'Resume Tailor' },
	{
		name: 'description',
		content:
			'Land more job interviews: Upload your resume once and our AI customizes it to every job you apply to, save time and improve your shot at getting hired.',
	},
]

export default function Index() {
	const actionData = useActionData<typeof signupAction>()

	const onboardingFetcher = useFetcher()
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
	const isSubmitting = useIsSubmitting()
	return (
		<main className="min-h-screen pb-5">
			<div>
				<img
					className="pointer-events-none absolute left-0 top-0 z-[-1] h-full max-h-[40rem] w-full select-none object-cover"
					src={background}
					alt=""
				/>
				<div className="lg:px-15 max-w-6xl px-2 pt-10 sm:px-6 md:mx-auto">
					<h1 className="text-4xl font-bold md:text-7xl lg:text-8xl">
						<Link to="/login" className="block text-white drop-shadow-md">
							<span>Tailor your resume to each job using AI</span>
						</Link>
					</h1>
					<p className="mt-16 max-w-5xl text-3xl text-white">
						Tired of tailoring your resume to each job description? Upload
						<br /> your resume and let AI tailor your resume for you.
					</p>
					<div className="flex justify-center p-10">
						<Button
							className="whitespace-nowrap"
							size={'wide'}
							variant="primary"
							asChild
						>
							<Link to="/signup">Upload a Resume</Link>
						</Button>
					</div>
					<div className="flex flex-col space-y-24 pt-32">
						<div className="flex flex-col space-y-12">
							<div className="relative">
								<span className="text-3xl font-bold italic text-brand-800  md:text-6xl">
									Nobody
								</span>
								<span className="align-top text-2xl font-bold text-brand-800">
									{' '}
									^
								</span>
								<span className="absolute left-20 top-[-2rem] -rotate-6 font-rainbow text-xl font-normal text-brand-800 sm:left-48 md:text-3xl lg:float-none">
									{' '}
									(we swear)
								</span>
								<span className="text-3xl font-bold text-black dark:text-white md:text-6xl ">
									{' '}
									likes tailoring resumes to job descriptions.{' '}
								</span>
								<span className="text-3xl font-bold text-brand-800 md:text-6xl ">
									Let AI do it for you.
								</span>
							</div>
							<div>
								<span className="text-xl font-bold text-black  dark:text-white md:text-3xl ">
									No more{' '}
								</span>
								<span className="text-xl font-bold text-brand-800  md:text-3xl ">
									copying
								</span>
								<span className="text-xl font-bold text-black  dark:text-white md:text-3xl ">
									{' '}
									monotonous job descriptions,{' '}
								</span>
								<span className="text-xl font-bold text-brand-800  md:text-3xl ">
									editing
								</span>
								<span className="text-xl font-bold text-black  dark:text-white md:text-3xl ">
									{' '}
									62 resumes,{' '}
								</span>
								<span className="text-xl font-bold text-brand-800  md:text-3xl ">
									or
								</span>
								<span className="text-xl font-bold text-black  dark:text-white md:text-3xl ">
									{' '}
								</span>
								<span className="text-xl font-bold text-brand-800  md:text-3xl ">
									submitting the wrong one
								</span>
								<span className="text-xl font-bold text-black  dark:text-white md:text-3xl ">
									{' '}
									for the job
								</span>
								<span className="float-right font-rainbow text-xl font-normal text-brand-800 md:text-3xl lg:float-none">
									{' '}
									(we've done that too)
								</span>
							</div>
							<div>
								<div className="rounded-lg p-5 shadow-2xl dark:bg-gray-900">
									<div>
										<div className="w-full text-xl font-bold text-brand-800 md:text-3xl ">
											Monotonous Job Description
										</div>
										<div className="text-right font-rainbow text-xl font-normal text-brand-800 md:text-center md:text-3xl lg:float-none">
											{' '}
											(you really like reading these?)
										</div>
										<div className="line-clamp-6 text-base font-normal text-black dark:text-white ">
											We are seeking a highly skilled and experienced Senior
											Product Designer with experience designing complex systems
											and workflows. As a Senior Product Designer, you will play
											a crucial role in our product development process,
											contributing to the design and optimization of our
											products, with a focus on enhancing user experience and
											optimizing user flows. The ideal candidate will have a
											strong interest or aptitude in the technical specifics of
											the products they are working on, as well as experience in
											customer acquisition optimization and data-driven
											decision-making.
											<br />
											Your responsibilities will entail designing and enhancing
											the user experience (UX) of our products, considering
											complex decision trees & 3rd party system requirements,
											while ensuring usability, accessibility, and aesthetic
											appeal. Collaborating closely with cross-functional teams,
											including product managers, engineers, and stakeholders,
											to gather requirements, understand
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="flex flex-col space-y-12">
							<div className="text-center text-xl font-bold text-brand-800 md:text-4xl ">
								Trusted by employees at top companies
							</div>
							<img
								className="rounded-lg"
								alt="top company logos"
								src={topCompanies}
							/>
						</div>
						<div className="flex flex-col space-y-12">
							<div>
								<div className=" text-center text-3xl font-bold text-brand-800 md:text-6xl ">
									Copy the job description
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 md:text-3xl lg:mr-32">
									(Command + C)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-black dark:text-white md:text-3xl ">
								Head over to the job board where you've been hunting. Once
								there, select and copy everything on the job posting.
							</div>

							<div className="rounded-lg p-5 shadow-2xl dark:bg-gray-900">
								<div className="text-xl font-bold text-brand-800 md:text-3xl ">
									Monotonous Job Description
								</div>
								<div className="line-clamp-6 pt-5 text-base font-normal text-black dark:text-white ">
									<mark className="bg-blue-200 leading-10">
										We are seeking a highly skilled and experienced Senior
										Product Designer with experience designing complex systems
										and workflows. As a Senior Product Designer, you will play a
										crucial role in our product development process,
										contributing to the design and optimization of our products,
										with a focus on enhancing user experience and optimizing
										user flows. The ideal candidate will have a strong interest
										or aptitude in the technical specifics of the products they
										are working on, as well as experience in customer
										acquisition optimization and data-driven decision-making.
										<br />
										Your responsibilities will entail designing and enhancing
										the user experience (UX) of our products, considering
										complex decision trees & 3rd party system requirements,
										while ensuring usability, accessibility, and aesthetic
										appeal. Collaborating closely with cross-functional teams,
										including product managers, engineers, and stakeholders, to
										gather requirements, understand
									</mark>
								</div>
							</div>
						</div>
						<div className="flex flex-col space-y-12">
							<div>
								<div className="text-center text-3xl font-bold text-brand-800 md:text-6xl ">
									Paste the job description
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 md:text-3xl lg:mr-32">
									(Command + V)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-black dark:text-white md:text-3xl ">
								Paste the job description that you copied into Resume Tailor so
								you can easily tailor your job experiences to match the job
								requirements.
							</div>
							<img
								className="rounded-3xl shadow"
								alt="add a job screenshot"
								src={addJob}
							/>
						</div>
						<div className="flex flex-col space-y-12">
							<div>
								<div className="text-center text-3xl font-bold text-brand-800 md:text-6xl ">
									Tailor your job experience with AI
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 md:text-3xl lg:mr-32">
									(Click)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-black dark:text-white md:text-3xl">
								Let AI do the boring, monotonous editing. Once you have tailored
								results, copy and paste them into your resume.
							</div>
							<img
								className="rounded-3xl shadow"
								alt="tailor resume screenshot"
								src={tailorJob}
							/>
						</div>
						<div className="flex flex-col space-y-12">
							<div>
								<div className="text-center text-3xl font-bold text-brand-800 md:text-6xl">
									Stoked to give it a shot?
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 md:text-3xl lg:mr-32">
									(damn right you are)
								</div>
							</div>
							<div className="mx-auto max-w-2xl text-center text-xl font-bold text-black dark:text-white md:text-3xl">
								We're <span className="text-brand-800">stoked</span> to give you
								access. Provide us with your info below and we'll be in touch
								soon!
							</div>
						</div>
						<div className="flex w-full justify-center">
							<onboardingFetcher.Form
								method="POST"
								className="flex max-w-2xl space-x-5 align-middle"
								action="/signup"
								{...form.props}
							>
								<div>
									<Field
										labelProps={{
											htmlFor: fields.email.id,
											children: 'Email',
										}}
										inputProps={{
											...conform.input(fields.email),
											placeholder: 'enteryour@email.com',
											className: 'w-[10rem] md:w-[27rem]',
										}}
										errors={fields.email.errors}
									/>
									<ErrorList errors={form.errors} id={form.errorId} />
								</div>
								<StatusButton
									className="my-auto whitespace-nowrap"
									status={
										isSubmitting ? 'pending' : actionData?.status ?? 'idle'
									}
									variant={'primary'}
									type="submit"
									disabled={isSubmitting}
								>
									Join the waitlist
								</StatusButton>
							</onboardingFetcher.Form>
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}
