import type { MetaFunction } from '@remix-run/node'
import { AgentBanner } from '~/components/agent-banner.tsx'
import { HeroSection } from '~/components/hero-section.tsx'
import { FeatureSection } from '~/components/feature-section.tsx'
import { StepsSection } from '~/components/steps-section.tsx'
import { ResumeAnalyzerSection } from '~/components/resume-analyzer-section.tsx'
import { OutreachSection } from '~/components/outreach-section.tsx'
import { TestimonialsSection } from '~/components/testimonials-section.tsx'
import { FinalCtaSection } from '~/components/final-cta-section.tsx'
import { LandingFaq } from '~/components/landing-faq.tsx'
import { LandingFooter } from '~/components/landing-footer.tsx'

export const meta: MetaFunction = () => [
	{ title: 'Resume Tailor: AI Resume Tailoring | Land More Interviews' },
	{
		name: 'description',
		content:
			'Land more interviews faster with AI resume tailoring. Upload once, customize for every job, save time, and boost your hiring chances. Start free today!.',
	},
]

export default function Index() {
	return (
		<div
			style={{
				background: '#08080A',
				minHeight: '100vh',
				overflowX: 'hidden',
			}}
		>
			<AgentBanner />
			<HeroSection />
			<FeatureSection />
			<StepsSection />
			<ResumeAnalyzerSection />
			<OutreachSection />
			<TestimonialsSection />
			<FinalCtaSection />
			<LandingFaq />
			<LandingFooter />
		</div>
	)
}
