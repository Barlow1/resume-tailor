import { Link } from '@remix-run/react'

export function HeroSection() {
	return (
		<div className="mx-auto flex max-w-6xl flex-col items-center justify-center">
			<div className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-2 lg:divide-x lg:divide-gray-200 lg:dark:divide-gray-700">
				<div className="space-y-6">
					<h2 className="text-4xl font-bold text-gray-900 dark:text-white">
						Most Job Seekers Struggle to Create Resumes That Stand Out
					</h2>
					<p className="text-lg text-gray-600 dark:text-gray-300">
						At Resume Tailor, we know how challenging it can be to land the
						perfect job. To stand out, you need more than just a resume—you need
						one that's optimized, highlights your strengths, and is tailored to
						the job description. But building and customizing resumes is
						tedious, time-consuming, and frustrating.
					</p>
					<p className="text-lg text-gray-600 dark:text-gray-300">
						Whether you're wondering how to use AI to write a resume, searching
						for resume tailoring AI, AI resume summary generator or thinking,
						"Can AI write my resume?"—the answer is yes. Our tool creates and
						fixes your resume by analyzing job descriptions and ensuring it's
						ATS-friendly.
					</p>
				</div>
				<div className="space-y-6 lg:pl-8">
					<div className="rounded-lg">
						<p className="mb-6 text-xl text-gray-900 dark:text-white">
							That's why we created Resume Tailor—a powerful AI-driven tool that
							doesn't just tailor your resume but also helps you build one from
							scratch if needed. Here's how it works:
						</p>
						<div className="space-y-4">
							<div className="flex gap-4">
								<span className="text-xl font-bold text-gray-900 dark:text-white">
									1-
								</span>
								<p className="text-gray-600 dark:text-gray-300">
									Upload your existing resume or start fresh
								</p>
							</div>
							<div className="flex gap-4">
								<span className="text-xl font-bold text-gray-900 dark:text-white">
									2-
								</span>
								<p className="text-gray-600 dark:text-gray-300">
									Let AI match your resume with the job description
								</p>
							</div>
							<div className="flex gap-4">
								<span className="text-xl font-bold text-gray-900 dark:text-white">
									3-
								</span>
								<p className="text-gray-600 dark:text-gray-300">
									Standout as the perfect candidate for the role. Stop wasting
									time and start applying to your dream jobs with confidence
								</p>
							</div>
						</div>
						<p className="mt-6 text-gray-600 dark:text-gray-300">
							Stop wondering, "How do I use AI to write a resume?" or "Can AI
							write a resume for me?"—Resume Tailor AI does it all. Whether you
							need to fix your resume, create a tailored resume for free, or
							optimize your job applications, our AI-driven platform makes it
							effortless.
						</p>
					</div>
				</div>
			</div>
			<div className="mx-auto pt-4">
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
