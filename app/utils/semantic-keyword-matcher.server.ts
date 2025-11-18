import { OpenAI } from 'openai'

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY ?? 'test-key',
	timeout: 30000, // 30 second timeout
})

export async function semanticKeywordMatch({
	keywords,
	resume,
}: {
	keywords: string[]
	resume: any
}): Promise<{
	matchedKeywords: string[]
	missedKeywords: string[]
	matchScore: number
}> {
	const resumeText = JSON.stringify(resume)

	const prompt = `You are a resume keyword matching expert. Your CORE PHILOSOPHY: If they clearly DID the work, MATCH it - even if worded differently.

KEYWORDS TO MATCH:
${keywords.map((kw, i) => `${i + 1}. ${kw}`).join('\n')}

RESUME CONTENT:
${resumeText}

═══════════════════════════════════════════════════════════════════
CRITICAL RULE: CONCEPT > EXACT PHRASE
═══════════════════════════════════════════════════════════════════

❌ WRONG: "experimentation frameworks" not matched because it doesn't say "experimentation frameworks"
✅ CORRECT: "experimentation frameworks" MATCHED because resume shows "12 A/B tests" (A/B testing IS experimentation)

❌ WRONG: "cohort analysis" not matched because it doesn't say "cohort analysis"
✅ CORRECT: "cohort analysis" MATCHED because resume shows "analyzed user behavior" and "segmentation" (this IS cohort work)

❌ WRONG: "dashboard" not matched because word "dashboard" not present
✅ CORRECT: "dashboard" MATCHED because resume shows "SQL analytics" and "tracked metrics" (implies dashboard/reporting)

═══════════════════════════════════════════════════════════════════
UNIVERSAL MATCHING PATTERNS (apply to ANY domain/role)
═══════════════════════════════════════════════════════════════════

These patterns work across ALL industries and job types:

1. TOOLS & SYSTEMS IMPLY USAGE:
   - If resume mentions a tool/system → they have experience with it
   - "Salesforce" in resume = CRM experience, sales operations, pipeline management
   - "Excel" or "financial models" = financial analysis, budgeting, forecasting
   - "EMR" or "Epic" = healthcare documentation, patient records, clinical workflows
   - "SQL" = data analysis, reporting, dashboards, analytics

2. OUTCOMES IMPLY METHODS:
   - If they achieved an outcome → they used relevant methods
   - "increased sales 30%" = sales strategy, pipeline management, closing deals
   - "reduced costs 20%" = cost optimization, budget management, efficiency improvement
   - "improved patient satisfaction" = patient care, quality improvement, service excellence
   - "50% retention increase" = churn reduction, customer success, engagement

3. RESPONSIBILITIES IMPLY SKILLS:
   - If they held a role → they have standard responsibilities of that role
   - "Account Executive" = cold calling, prospecting, demos, quota attainment, CRM
   - "Registered Nurse" = patient care, charting, medication administration, vital signs
   - "Content Marketing Manager" = content creation, SEO, social media, campaigns
   - "Paralegal" = legal research, document review, case management, compliance

4. METRICS PROVE CAPABILITY:
   - If they report metrics → they tracked/analyzed that metric
   - "120% quota attainment" = sales performance, pipeline management, closing
   - "$2M budget managed" = financial management, budgeting, cost control
   - "40 patients/day" = patient care, time management, clinical workflows
   - "95% customer satisfaction" = customer service, quality, relationship management

5. SYNONYMS & VARIATIONS (universal across domains):
   - Research: "customer interviews" = "client feedback" = "stakeholder research" = "user research"
   - Strategy: "strategic planning" = "roadmap" = "vision" = "long-term planning"
   - Collaboration: "cross-functional" = "partnered with" = "worked with" = "collaborated"
   - Optimization: "improved" = "streamlined" = "optimized" = "enhanced" = "increased efficiency"
   - Analysis: "analyzed" = "evaluated" = "assessed" = "reviewed" = "examined"

6. DOMAIN-SPECIFIC KNOWLEDGE (use your training):
   Use your knowledge of different domains to match concepts:

   SALES: pipeline → funnel, leads → prospects, close → win, quota → target
   HEALTHCARE: EMR → EHR → medical records, charting → documentation, rounds → patient care
   LEGAL: brief → legal writing, discovery → case investigation, contract review → legal analysis
   FINANCE: P&L → financial statements, budgeting → financial planning, variance → analysis
   MARKETING: SEO → search optimization, content → marketing materials, campaigns → initiatives
   DESIGN: wireframes → mockups, prototypes → designs, user flows → UX design
   ENGINEERING: deployment → release, refactor → code improvement, CI/CD → automation
   OPERATIONS: supply chain → logistics, inventory → stock management, lean → process improvement
   HR: recruiting → talent acquisition, onboarding → new hire integration, engagement → retention

═══════════════════════════════════════════════════════════════════
EVIDENCE STANDARD
═══════════════════════════════════════════════════════════════════

MATCH if resume shows:
✅ Direct mention ("A/B testing")
✅ Synonym/variation ("experiments", "tests")
✅ Specific examples ("ran 12 A/B tests")
✅ Metrics proving they did it ("improved conversion 30% via testing")
✅ Tools that imply capability ("SQL" implies analytics/dashboard work)

NO MATCH only if:
❌ Completely different domain with zero overlap
❌ No evidence whatsoever of that type of work
❌ Would require fabricating experience they don't have

═══════════════════════════════════════════════════════════════════
EXAMPLES ACROSS ALL DOMAINS - STUDY THESE CAREFULLY
═══════════════════════════════════════════════════════════════════

PRODUCT/TECH EXAMPLES:

Example 1:
Keyword: "experimentation frameworks"
Resume: "Conducted 12 A/B tests on pricing and UX"
Decision: ✅ MATCH
Reasoning: "A/B testing IS experimentation. They clearly run experiments."

Example 2:
Keyword: "SQL"
Resume: "Analyzed user behavior data with SQL"
Decision: ✅ MATCH
Reasoning: "Explicitly mentions SQL."

Example 3:
Keyword: "dashboard"
Resume: "Built SQL queries to track key metrics"
Decision: ✅ MATCH
Reasoning: "Tracking metrics with SQL strongly implies dashboard/reporting work."

SALES EXAMPLES:

Example 4:
Keyword: "pipeline management"
Resume: "Managed 50+ active opportunities through Salesforce, achieving 120% quota"
Decision: ✅ MATCH
Reasoning: "Managing opportunities through CRM IS pipeline management. Quota attainment proves it."

Example 5:
Keyword: "cold calling"
Resume: "Prospected 100+ accounts daily, generating 20 qualified leads per week"
Decision: ✅ MATCH
Reasoning: "Prospecting accounts IS cold calling. Different phrase, same activity."

Example 6:
Keyword: "sales cycle"
Resume: "Closed 15 enterprise deals averaging 6 months from first contact to signature"
Decision: ✅ MATCH
Reasoning: "Describing deal timeline from contact to close IS describing sales cycle."

HEALTHCARE EXAMPLES:

Example 7:
Keyword: "patient documentation"
Resume: "Charted vital signs, medications, and assessments in Epic for 40+ patients daily"
Decision: ✅ MATCH
Reasoning: "Charting in EMR IS patient documentation. Clear match."

Example 8:
Keyword: "clinical workflows"
Resume: "Coordinated patient care from admission through discharge, managing handoffs between departments"
Decision: ✅ MATCH
Reasoning: "Coordinating patient care journey IS understanding clinical workflows."

Example 9:
Keyword: "HIPAA compliance"
Resume: "Maintained patient privacy and security protocols per hospital policy"
Decision: ✅ MATCH
Reasoning: "Patient privacy protocols in healthcare context = HIPAA compliance."

MARKETING EXAMPLES:

Example 10:
Keyword: "content strategy"
Resume: "Created 50+ blog posts, social media campaigns, and email sequences that increased traffic 45%"
Decision: ✅ MATCH
Reasoning: "Creating coordinated content across channels IS content strategy."

Example 11:
Keyword: "SEO"
Resume: "Optimized website content, improving organic search rankings for 20 key terms"
Decision: ✅ MATCH
Reasoning: "Optimizing for search rankings IS SEO work."

FINANCE EXAMPLES:

Example 12:
Keyword: "financial modeling"
Resume: "Built Excel models for 3-year revenue forecasting and scenario analysis"
Decision: ✅ MATCH
Reasoning: "Building forecast models in Excel IS financial modeling."

Example 13:
Keyword: "budget management"
Resume: "Managed $5M departmental budget, reducing costs 15% while maintaining service levels"
Decision: ✅ MATCH
Reasoning: "Managing budget and achieving cost reduction IS budget management."

LEGAL EXAMPLES:

Example 14:
Keyword: "contract review"
Resume: "Reviewed and negotiated 100+ vendor agreements, identifying risk provisions"
Decision: ✅ MATCH
Reasoning: "Reviewing agreements IS contract review."

Example 15:
Keyword: "legal research"
Resume: "Researched case law and statutes using Westlaw to support litigation strategy"
Decision: ✅ MATCH
Reasoning: "Explicitly mentions legal research tools and case law research."

DESIGN EXAMPLES:

Example 16:
Keyword: "wireframing"
Resume: "Created low-fidelity mockups in Figma for 20+ feature flows"
Decision: ✅ MATCH
Reasoning: "Low-fidelity mockups ARE wireframes. Same concept, different phrasing."

Example 17:
Keyword: "user testing"
Resume: "Conducted usability sessions with 15 users, iterating designs based on feedback"
Decision: ✅ MATCH
Reasoning: "Usability sessions ARE user testing."

OPERATIONS EXAMPLES:

Example 18:
Keyword: "supply chain optimization"
Resume: "Reduced inventory carrying costs 20% while improving fulfillment speed to 2 days"
Decision: ✅ MATCH
Reasoning: "Optimizing inventory and fulfillment IS supply chain optimization."

Example 19:
Keyword: "process improvement"
Resume: "Streamlined onboarding workflow, reducing time-to-productivity from 4 weeks to 2 weeks"
Decision: ✅ MATCH
Reasoning: "Streamlining workflows IS process improvement."

NO MATCH EXAMPLE (universal):

Example 20:
Keyword: "clinical decision support"
Resume: "Built consumer SaaS for job seekers"
Decision: ❌ NO MATCH
Reasoning: "Completely different domain. No clinical/healthcare work mentioned."

═══════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════

For each keyword:
1. Check if resume demonstrates that capability (be GENEROUS)
2. Match if concept is present, even with different words
3. Use your full knowledge of ALL domains (not just examples above)
4. Only say NO MATCH if truly zero evidence

The examples above cover common domains, but you have knowledge of ALL fields:
- Education (curriculum development, lesson planning, assessment)
- Construction (project management, safety compliance, blueprints)
- Hospitality (guest services, revenue management, operations)
- Manufacturing (quality control, lean production, Six Sigma)
- Real Estate (property management, leasing, market analysis)
- And every other professional domain

Apply the same generous concept-matching principles to ALL domains.

Return ONLY valid JSON:
{
  "matched": ["keyword1", "keyword5", ...],
  "missed": ["keyword2", "keyword3", ...],
  "reasoning": {
    "keyword1": "Brief reason for match/no-match"
  }
}

REMEMBER: If they clearly DID the work → MATCH, even if worded differently.

Your response must be ONLY valid JSON. No markdown, no code fences, no text outside JSON.`

	try {
		console.log('[Semantic Matching] Starting keyword matching...')
		console.log('[Semantic Matching] Keywords to match:', keywords.length)

		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [{ role: 'user', content: prompt }],
			response_format: { type: 'json_object' },
			temperature: 0.1, // Low temperature for consistency
		})

		const result = JSON.parse(response.choices[0]?.message?.content || '{}')

		const matchedKeywords = result.matched || []
		const missedKeywords = result.missed || []
		const matchScore = Math.round((matchedKeywords.length / keywords.length) * 100)

		console.log('[Semantic Matching] Results:', {
			total: keywords.length,
			matched: matchedKeywords.length,
			missed: missedKeywords.length,
			score: matchScore,
		})

		// Log detailed reasoning for debugging
		if (result.reasoning) {
			console.log('[Semantic Matching] Reasoning sample:')
			const reasoningKeys = Object.keys(result.reasoning).slice(0, 3)
			reasoningKeys.forEach(key => {
				console.log(`  - ${key}: ${result.reasoning[key]}`)
			})
		}

		return {
			matchedKeywords,
			missedKeywords,
			matchScore,
		}
	} catch (error) {
		console.error('[Semantic Matching] Error:', error)

		// Fallback to simple substring matching if AI fails
		console.log('[Semantic Matching] Falling back to simple substring matching')
		const resumeTextLower = resumeText.toLowerCase()
		const matchedKeywords = keywords.filter(kw =>
			resumeTextLower.includes(kw.toLowerCase())
		)
		const missedKeywords = keywords.filter(kw =>
			!resumeTextLower.includes(kw.toLowerCase())
		)

		return {
			matchedKeywords,
			missedKeywords,
			matchScore: Math.round((matchedKeywords.length / keywords.length) * 100),
		}
	}
}
