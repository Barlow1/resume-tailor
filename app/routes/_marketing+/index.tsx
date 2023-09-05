import type { V2_MetaFunction } from '@remix-run/node'
import { addJob, background, tailorJob, topCompanies } from './logos/logos.ts'
import { Link } from '@remix-run/react'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'

export const meta: V2_MetaFunction = () => [{ title: 'Resume Tailor' }]

export default function Index() {
	return (
		<main className="min-h-screen pb-5">
			<div>
				<img
					className="pointer-events-none absolute left-0 top-0 z-[-1] h-full max-h-[30rem] w-full select-none object-cover md:max-h-[33rem] lg:max-h-[38rem]"
					src={background}
					alt=""
				/>
				<div className="lg:px-15 max-w-6xl px-2 pt-10 sm:px-6 md:mx-auto">
					<h1 className="text-4xl font-bold md:text-7xl lg:text-8xl">
						<Link to="/login" className="block text-white drop-shadow-md">
							<span>Tailor your resume to each job using AI</span>
						</Link>
					</h1>
					<p className="mt-6 max-w-lg text-xl text-white sm:max-w-2xl md:text-2xl">
						Tired of tailoring your resume to each job description? Upload your
						resume and let AI tailor your resume for you.
					</p>
					<div className="flex justify-center p-10">
						<Button
							variant={'always-light'}
							className="whitespace-nowrap"
							size={'wide'}
							asChild
						>
							<Link to="/signup">Upload a Resume</Link>
						</Button>
					</div>
					<div className="flex flex-col space-y-16 pt-16 md:pt-24">
						<div className="flex flex-col space-y-10">
							<div className="relative">
								<span className="text-3xl font-bold text-brand-800 sm:text-6xl">
									Nobody
								</span>
								<span className="align-top text-2xl font-bold text-brand-800">
									{' '}
									^
								</span>
								<span className="absolute left-20 top-[-1.5rem] -rotate-6 font-rainbow text-xl font-normal text-brand-800 sm:left-48 lg:float-none">
									{' '}
									(we swear)
								</span>
								<span className="text-3xl font-bold text-primary sm:text-6xl">
									{' '}
									likes tailoring resumes to job descriptions.{' '}
								</span>
								<span className="text-3xl font-bold text-brand-800 sm:text-6xl">
									Let AI do it for you.
								</span>
							</div>
							<div>
								<span className="text-xl font-bold  text-primary sm:text-3xl">
									No more{' '}
								</span>
								<span className="text-xl font-bold  text-brand-800 sm:text-3xl">
									copying
								</span>
								<span className="text-xl font-bold  text-primary sm:text-3xl">
									{' '}
									monotonous job descriptions,{' '}
								</span>
								<span className="text-xl font-bold  text-brand-800 sm:text-3xl">
									editing
								</span>
								<span className="text-xl font-bold  text-primary sm:text-3xl">
									{' '}
									62 resumes,{' '}
								</span>
								<span className="text-xl font-bold  text-brand-800 sm:text-3xl">
									or
								</span>
								<span className="text-xl font-bold  text-primary sm:text-3xl">
									{' '}
								</span>
								<span className="text-xl font-bold  text-brand-800 sm:text-3xl">
									submitting the wrong one
								</span>
								<span className="text-xl font-bold  text-primary sm:text-3xl">
									{' '}
									for the job
								</span>
								<span className="float-right font-rainbow text-xl font-normal text-brand-800 lg:float-none">
									{' '}
									(we've done that too)
								</span>
							</div>
							<div>
								<div className="rounded-lg p-5 shadow-2xl">
									<div>
										<div className="w-full text-xl font-bold text-brand-800 sm:text-4xl">
											Monotonous Job Description
										</div>
										<div className="text-right font-rainbow text-xl font-normal text-brand-800 md:text-center lg:float-none">
											{' '}
											(you really like reading these?)
										</div>
										<div className="line-clamp-6 text-base font-normal text-primary sm:text-2xl">
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
						<div className="flex flex-col space-y-10">
							<div className="text-center  text-2xl font-bold text-brand-800 sm:text-4xl">
								Trusted by employees at top companies
							</div>
							<img
								className="rounded-lg"
								alt="top company logos"
								src={topCompanies}
							/>
						</div>
						<div className="flex flex-col space-y-10">
							<div>
								<div className=" text-center text-3xl font-bold text-brand-800 sm:text-6xl">
									Copy the job description
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 lg:mr-32">
									(Command + C)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-primary sm:text-3xl">
								Head over to the job board where you've been hunting. Once
								there, select and copy everything on the job posting.
							</div>

							<div className="rounded-lg p-5 shadow-2xl">
								<div className="text-xl font-bold text-brand-800 sm:text-4xl">
									Monotonous Job Description
								</div>
								<div className="line-clamp-6 pt-5 text-base font-normal text-primary sm:text-2xl">
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
						<div className="flex flex-col space-y-10">
							<div>
								<div className="text-center text-3xl font-bold text-brand-800 sm:text-6xl">
									Paste the job description
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 lg:mr-32">
									(Command + V)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-primary sm:text-4xl">
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
						<div className="flex flex-col space-y-10">
							<div>
								<div className="text-center text-3xl font-bold text-brand-800 sm:text-6xl">
									Tailor your job experience with AI
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 lg:mr-32">
									(Click)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-primary sm:text-4xl">
								Let AI do the boring, monotonous editing. Once you have tailored
								results, copy and paste them into your resume.
							</div>
							<img
								className="rounded-3xl shadow"
								alt="tailor resume screenshot"
								src={tailorJob}
							/>
						</div>
						<div className="flex flex-col space-y-10">
							<div>
								<div className="text-center text-3xl font-bold text-brand-800 sm:text-6xl">
									Stoked to give it a shot?
								</div>
								<div className="text-right font-rainbow text-xl font-normal text-brand-800 lg:mr-32">
									(damn right you are)
								</div>
							</div>
							<div className="text-center text-xl font-bold text-primary sm:text-4xl">
								We're stoked to give you access. Provide us with your info below
								and we'll be in touch soon!
							</div>
						</div>
						<div className="flex w-full justify-center">
							<div className="flex max-w-2xl space-x-5">
								<Input className="pr-5" placeholder="enteryour@email.com" />
								<Button className="whitespace-nowrap">Join the waitlist</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	)
}
