import type { MetaFunction } from '@remix-run/node'
import { resumeBuilderScreenshot, topCompanies } from './logos/logos.ts'
import banner1 from './logos/baner-1-2.webp'
import banner2 from './logos/baner-1-3.webp'
import connect from './logos/connect.webp'
import { Link } from '@remix-run/react'
import { FAQ } from '~/components/ui/faq.tsx'
import { FeatureSection } from '~/components/feature-section.tsx'
import { RejectionSection } from '~/components/rejection-section.tsx'
import { StepsSection } from '~/components/steps-section.tsx'
import { HeroSection } from '~/components/hero-section.tsx'
import { OptimizedImage } from '~/components/ui/optimized-image.tsx'
import { OutreachSection } from '~/components/outreach-section.tsx'
import { ResumeAnalyzerSection } from '~/components/resume-analyzer-section.tsx'

export const meta: MetaFunction = () => [
	{ title: 'Resume Tailor AI | Tailor Your Resume to Any Job' },
	{
		name: 'description',
		content:
			'Use AI resume tailoring to match your resume to any job description in minutes. Upload your resume, paste the JD, get ATS-friendly keywords and bullet rewrites. Start free today.',
	},
]

export default function Index() {
	return (
		<main className="min-h-screen rounded-3xl pb-5">
			<div>
				<div className="lg:px-15 max-w-6xl px-2 pt-10 sm:px-6 md:mx-auto">
					<div className="flex flex-col items-center justify-center">
						<h1 className="text-center text-3xl font-bold md:text-5xl lg:text-6xl">
							<Link to="/login" className="block drop-shadow-md">
								<span>Land More</span>{' '}
								<span className="bg-gradient-to-r from-brand-500 to-brand-800 bg-clip-text text-transparent">
									Interviews, Faster
								</span>
							</Link>
						</h1>
						<p className="max-w-5xl pt-6 text-center text-xl">
							Create a tailored resume for every job you apply to—in minutes
						</p>
						<div className="flex justify-center pt-6">
							<Link
								to="/builder"
								className="hover:bg-brand-600 inline-block rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white"
							>
								BUILD YOUR RESUME NOW
							</Link>
						</div>
						<div className="relative mt-10 max-w-4xl justify-self-center overflow-visible rounded-t-3xl bg-gradient-to-r from-brand-500 to-brand-800">
							<OptimizedImage
								src={banner1}
								alt=""
								className="absolute -left-52 -top-32 -z-10 w-[250px]"
								width={250}
								height={250}
								loading='eager'
							/>
							<OptimizedImage
								src={banner2}
								alt=""
								className="absolute -right-52 -top-44 -z-10 w-[300px]"
								width={300}
								height={300}
								loading='eager'
							/>
							<OptimizedImage
								src={connect}
								alt=""
								className="absolute left-1/2 top-[30%] -z-10 min-w-[100vw] -translate-x-1/2 -translate-y-1/2"
								width={1920}
								height={1080}
								loading='eager'
							/>
							<div className="flex justify-center p-6 pb-0">
								<OptimizedImage
									src={resumeBuilderScreenshot}
									alt="Resume Builder Screenshot"
									className="w-full rounded-t-xl object-contain"
									width={1200}
									height={800}
									loading='eager'
								/>
							</div>
						</div>
					</div>

					<FeatureSection />
					<RejectionSection />
					<StepsSection />
					<HeroSection />

					<div className="flex flex-col space-y-24 pt-24">
						<div className="flex flex-col space-y-12">
							<div className="text-center text-xl font-bold md:text-4xl ">
								Trusted by employees at top companies
							</div>
							<OptimizedImage
								className="rounded-lg"
								alt="top company logos"
								src={topCompanies}
								loading="lazy"
								width={1200}
								height={150}
							/>
						</div>
					<ResumeAnalyzerSection />
					<OutreachSection />
						<FAQ />
					</div>
				</div>
			</div>
		</main>
	)
}
