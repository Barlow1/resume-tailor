import { Link } from '@remix-run/react'
import clsx from 'clsx'
import step1 from '~/routes/_marketing+/logos/step-1.png'
import step2 from '~/routes/_marketing+/logos/step-2.png'
import step3 from '~/routes/_marketing+/logos/step-3.png'

export function StepsSection() {
	const steps = [
		{
			number: '1',
			title: 'Make Your Resume',
			description: 'Start fresh or upload your existing one',
			image: step1,
		},
		{
			number: '2',
			title: 'Tailor It (To Every Job)',
			description:
				'Match your resume to the job description and get more interviews with AI tailoring you can apply to effortlessly',
			image: step2,
		},
		{
			number: '3',
			title: 'Land Interviews',
			description: 'Stand out and impress recruiters with AI resume tailoring',
			image: step3,
		},
	]

	return (
		<div className="mt-24">
			<h2 className="text-center">
				<div className="text-3xl font-bold">
					When You Use Resume Tailor,
					<br />
					You Get More Interviews
				</div>
				<div className="mt-1 text-sm text-muted-foreground">
					It only takes 3 steps
				</div>
			</h2>

			<div className="gap-y-18 relative mt-20 grid grid-cols-1">
				{steps.map((step, index) => (
					<div key={index} className="relative grid grid-cols-2 gap-24">
						<div
							className={clsx(
								'relative',
								index % 2 === 0 ? 'order-first' : 'order-last',
							)}
						>
							{/* Content */}
							<div className="relative z-10 flex h-[500px] flex-col items-start justify-start rounded-xl p-8">
								<div>
									<h3 className="flex items-center text-xl font-bold">
										<span className="mr-2 text-3xl text-brand-500">✦</span>
										{step.title}
									</h3>
									<p className="mt-2 text-2xl text-muted-foreground">
										{step.description}
									</p>
								</div>
							</div>
						</div>
						<div className="relative">
							{/* Large background number */}
							<div
								className={clsx(
									'text-brand-100 absolute text-[200px] font-bold opacity-50',
									index % 2 === 0 ? '-left-24' : '-right-24',
								)}
							>
								{step.number}
							</div>
							<div className="relative h-[80%] rounded-xl bg-muted p-8">
								{/* Image placeholder */}
								<div className="aspect-video h-full w-full rounded-lg bg-muted-foreground/10">
									<img src={step.image} alt={step.title} className="h-full w-full object-fill rounded-lg" />
								</div>

								{/* Connecting dotted lines */}
								{index < steps.length - 1 && (
									<div
										className={clsx(
											'absolute -z-10 h-full w-[160%] scale-x-[-1]',
											index % 2 === 0
												? 'right-24 top-[75%]'
												: 'left-24 top-[75%]',
										)}
									>
										<svg
											className={clsx(
												'absolute h-[300px] w-full',
												index % 2 === 0 ? 'right-0' : 'left-0',
											)}
											preserveAspectRatio="none"
											viewBox="0 0 710 300"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												className="stroke-muted-foreground/30"
												strokeWidth="2"
												strokeDasharray="4 4"
												d={
													index % 2 === 0
														? 'M684 150H50 M50 75V150 M684 150V225'
														: 'M26 150h584 M610 75V150 M26 150V225'
												}
											/>
										</svg>
									</div>
								)}
							</div>
						</div>
					</div>
				))}
			</div>

			<div className="text-center">
				<Link
					to="/builder"
					className="hover:bg-brand-600 inline-block rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white"
				>
					BUILD YOUR RESUME NOW
				</Link>
			</div>
		</div>
	)
}
