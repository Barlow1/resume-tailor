import { useState } from 'react'
import { lc } from './landing-colors.ts'
import { FadeUp } from './fade-up.tsx'
import { useMobile } from '~/hooks/use-mobile.ts'

const faqs = [
	{
		q: 'How is this different from using ChatGPT?',
		a: "ChatGPT can rewrite text, but it can't format a resume, score it against ATS systems, track multiple versions per job, or export a clean PDF. Resume Tailor is a purpose-built tool that handles the entire workflow \u2014 from editing to tailoring to applying.",
	},
	{
		q: 'Is my resume ATS-compatible?',
		a: 'Yes. Our analyzer scores your resume against the job description and flags formatting issues, missing keywords, and skill gaps that would cause ATS systems to filter you out.',
	},
	{
		q: 'How long does tailoring take?',
		a: 'About 30 seconds. Paste a job description, click tailor, review the changes, and download. Most users tailor and apply in under 2 minutes.',
	},
	{
		q: 'Can I use my existing resume?',
		a: 'Yes. Upload any PDF or start fresh in our builder. Either way, you get a formatted, editable resume you can tailor to any job.',
	},
	{
		q: 'What does it cost?',
		a: 'You can start free. Pro plans unlock unlimited tailoring, AI outreach, and advanced analytics. See our pricing page for details.',
	},
	{
		q: 'Is my data private?',
		a: 'Yes. Your resumes and job descriptions are encrypted and never shared. You can delete your data at any time.',
	},
]

// JSON-LD for SEO rich results
const faqJsonLd = {
	'@context': 'https://schema.org',
	'@type': 'FAQPage',
	mainEntity: faqs.map(item => ({
		'@type': 'Question',
		name: item.q,
		acceptedAnswer: { '@type': 'Answer', text: item.a },
	})),
}

export function LandingFaq() {
	const [open, setOpen] = useState<number | null>(null)
	const mobile = useMobile()

	return (
		<section style={{ padding: mobile ? '80px 20px' : '100px 24px' }}>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
			/>
			<div style={{ maxWidth: 640, margin: '0 auto' }}>
				<FadeUp>
					<h2
						style={{
							color: lc.text,
							fontSize: 'clamp(28px,4vw,38px)',
							fontWeight: 700,
							letterSpacing: '-0.035em',
							textAlign: 'center',
							marginBottom: 48,
						}}
					>
						Frequently asked questions
					</h2>
				</FadeUp>
				{faqs.map((f, i) => (
					<FadeUp key={i} delay={i * 0.05}>
						<div style={{ borderBottom: `1px solid ${lc.brd}` }}>
							<button
								type="button"
								onClick={() =>
									setOpen(open === i ? null : i)
								}
								style={{
									width: '100%',
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									padding: '20px 0',
									background: 'none',
									border: 'none',
									cursor: 'pointer',
									textAlign: 'left',
								}}
							>
								<span
									style={{
										color: lc.text,
										fontSize: 15,
										fontWeight: 500,
									}}
								>
									{f.q}
								</span>
								<span
									style={{
										color: lc.mut,
										fontSize: 20,
										transform:
											open === i
												? 'rotate(45deg)'
												: 'rotate(0deg)',
										transition: 'transform 0.2s',
										flexShrink: 0,
										marginLeft: 16,
									}}
								>
									+
								</span>
							</button>
							<div
								style={{
									maxHeight: open === i ? 200 : 0,
									overflow: 'hidden',
									transition: 'max-height 0.3s ease',
								}}
							>
								<p
									style={{
										color: lc.sec,
										fontSize: 14,
										lineHeight: 1.7,
										paddingBottom: 20,
										margin: 0,
									}}
								>
									{f.a}
								</p>
							</div>
						</div>
					</FadeUp>
				))}
			</div>
		</section>
	)
}
