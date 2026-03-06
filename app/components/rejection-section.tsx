import resumeBadGood from '~/routes/_marketing+/logos/resume-bad-good.webp'
import colorBlur from '~/routes/_marketing+/logos/color-blur.webp'
import { Link } from '@remix-run/react'
import { OptimizedImage } from './ui/optimized-image.tsx'
import { trackCtaClick } from '~/lib/analytics.client.ts'

export function RejectionSection() {
	return (
		<section className="fade-up-hidden mx-auto max-w-5xl px-4 py-24 sm:px-6">
			<div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
				<div className="relative h-full overflow-hidden rounded-xl bg-muted px-12 py-20 shadow-lg">
					<OptimizedImage
						src={colorBlur}
						alt="Color blur"
						className="absolute -right-52 -top-52 -z-10 h-full w-full"
						loading="lazy"
						width={800}
						height={800}
					/>
					<OptimizedImage
						src={resumeBadGood}
						alt="Resume comparison"
						className="h-full w-full"
						loading="lazy"
						width={800}
						height={600}
					/>
				</div>
				<div className="space-y-4">
					<h2 className="text-2xl font-bold text-foreground md:text-3xl">
						We know how frustrating it is to get rejection emails every day
					</h2>
					<p className="text-xl text-muted-foreground">
						If you don't tailor your resume to the job description...
					</p>
					<div className="space-y-3">
						<div className="space-y-1">
							<h3 className="flex items-center text-xl font-semibold text-foreground">
								<span className="mr-2 text-brand-500">✦</span>
								Opportunities Slip Away
							</h3>
							<p className="text-muted-foreground">
								Generic resumes fail to capture attention and cost you
								interviews
							</p>
						</div>
						<div className="space-y-1">
							<h3 className="flex items-center text-xl font-semibold text-foreground">
								<span className="mr-2 text-brand-500">✦</span>
								Hours of Effort Go to Waste
							</h3>
							<p className="text-muted-foreground">
								Easy Apply and countless hours of job applications that only
								result in automated rejections
							</p>
						</div>
						<div className="space-y-1">
							<h3 className="flex items-center text-xl font-semibold text-foreground">
								<span className="mr-2 text-brand-500">✦</span>
								Your Application Gets Overlooked
							</h3>
							<p className="text-muted-foreground">
								Without the right keywords, applicant tracking systems (ATS)
								filter you out before a recruiter even sees your resume
							</p>
						</div>
					</div>
					<p className="text-lg text-muted-foreground">
						And that leads to frustration, missed opportunities, and feeling
						stuck in your job search. We don't want that for you. Resume
						Tailor AI has helped thousands of job seekers stand out and land
						interviews faster. It can do the same for you.
					</p>
					<div className="pt-2">
						<Link
							to="/builder"
							className="inline-block rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-brand-800"
							onClick={() =>
								trackCtaClick(
									'Build your resume free',
									'rejection_section',
									'/builder',
								)
							}
						>
							Build your resume free
						</Link>
					</div>
				</div>
			</div>
		</section>
	)
}
