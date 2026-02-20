import { Link } from '@remix-run/react'
import { trackCtaClick } from '~/lib/analytics.client.ts'

export function StepsSection() {
	const steps = [
		{
			number: '1',
			title: 'Make Your Resume',
			description: 'Start fresh or upload your existing one',
		},
		{
			number: '2',
			title: 'Tailor It To Every Job',
			description:
				'Match your resume to the job description and get more interviews with AI tailoring you can apply to effortlessly',
		},
		{
			number: '3',
			title: 'Land Interviews',
			description: 'Stand out and impress recruiters with AI resume tailoring',
		},
	]

	return (
		<div className="mt-24">
			<div className="text-center">
				<span className="inline-block rounded-full bg-brand-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-500">
					How it works
				</span>
				<h2 className="mt-4 text-3xl font-bold md:text-4xl">
					When You Use Resume Tailor,
					<br />
					You Get More Interviews
				</h2>
				<p className="mt-2 text-muted-foreground">It only takes 3 steps</p>
			</div>

			<div className="relative mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
				{/* Desktop connecting line */}
				<div className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-brand-500/20 via-brand-500/40 to-brand-500/20 md:block" />

				{steps.map((step, index) => (
					<div key={index} className="flex flex-col items-center text-center">
						{/* Step circle */}
						<div className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-brand-500 to-brand-800 shadow-lg">
							<span className="text-2xl font-black text-white">{step.number}</span>
						</div>

						{/* Card */}
						<div className="w-full flex-1 rounded-2xl border border-border bg-card p-8 shadow-sm transition-shadow duration-200 hover:shadow-md">
							<div className="mb-1 text-[64px] font-black leading-none text-brand-500/8 select-none">
								{step.number}
							</div>
							<h3 className="text-xl font-bold tracking-tight">{step.title}</h3>
							<p className="mt-3 leading-relaxed text-muted-foreground">
								{step.description}
							</p>
						</div>
					</div>
				))}
			</div>

			<div className="mt-12 text-center">
				<Link
					to="/builder"
					className="hover:bg-brand-600 inline-block rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white"
					onClick={() =>
						trackCtaClick('BUILD YOUR RESUME NOW', 'steps_section', '/builder')
					}
				>
					BUILD YOUR RESUME NOW
				</Link>
			</div>
		</div>
	)
}
