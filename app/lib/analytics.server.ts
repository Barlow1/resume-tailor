/**
 * PostHog Server-Side Analytics
 *
 * Handles:
 * - Server-side event tracking via posthog-node
 * - User identification from session
 * - Anonymous ID correlation
 * - Remix action/loader integration
 */

import { PostHog } from 'posthog-node'
import type {
	AnalyticsEventName,
	AnalyticsEventMap,
	UserProperties,
} from './analytics.types.ts'

// ============================================================================
// CONFIGURATION
// ============================================================================

const POSTHOG_KEY = process.env.POSTHOG_API_KEY || ''
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'
const ANONYMOUS_ID_COOKIE = 'rt_anonymous_id'

// ============================================================================
// POSTHOG CLIENT SINGLETON
// ============================================================================

let posthogClient: PostHog | null = null

/**
 * Get or create PostHog client instance
 */
function getPostHogClient(): PostHog | null {
	if (!POSTHOG_KEY || POSTHOG_KEY === 'phc_YOUR_POSTHOG_KEY') {
		return null
	}

	if (!posthogClient) {
		posthogClient = new PostHog(POSTHOG_KEY, {
			host: POSTHOG_HOST,
			// Flush events in batches
			flushAt: 20,
			flushInterval: 10000, // 10 seconds
		})
	}

	return posthogClient
}

/**
 * Shutdown PostHog client (call on server shutdown)
 */
export async function shutdownAnalytics(): Promise<void> {
	if (posthogClient) {
		await posthogClient.shutdown()
		posthogClient = null
	}
}

// ============================================================================
// ANONYMOUS ID EXTRACTION
// ============================================================================

/**
 * Extract anonymous ID from request cookies
 */
export function getAnonymousIdFromRequest(request: Request): string | null {
	const cookieHeader = request.headers.get('Cookie') || ''
	const cookies = cookieHeader.split(';').map(c => c.trim())
	const anonCookie = cookies.find(c => c.startsWith(`${ANONYMOUS_ID_COOKIE}=`))

	if (anonCookie) {
		return anonCookie.split('=')[1]
	}

	return null
}

// ============================================================================
// SERVER-SIDE TRACKING
// ============================================================================

interface TrackServerEventOptions {
	/** User ID if authenticated */
	userId?: string
	/** Anonymous ID from client cookie */
	anonymousId?: string
	/** Request object for extracting context */
	request?: Request
	/** Additional properties to merge */
	additionalProperties?: Record<string, unknown>
}

/**
 * Track event from server-side code
 * Handles user ID resolution and anonymous ID correlation
 */
export function trackServerEvent<T extends AnalyticsEventName>(
	eventName: T,
	properties: AnalyticsEventMap[T],
	options: TrackServerEventOptions = {},
): void {
	const client = getPostHogClient()

	// Extract anonymous ID from request if not provided
	let anonymousId = options.anonymousId
	if (!anonymousId && options.request) {
		anonymousId = getAnonymousIdFromRequest(options.request) || undefined
	}

	// Determine distinct ID (prefer user ID, fall back to anonymous ID)
	const distinctId = options.userId || anonymousId

	if (!distinctId) {
		console.warn('[Analytics] No distinct ID available for server event:', eventName)
		return
	}

	// Build full properties object
	const fullProperties = {
		...properties,
		...(options.additionalProperties || {}),
		timestamp: new Date().toISOString(),
		platform: 'web',
		$lib: 'posthog-node',
		// Include both IDs for correlation
		...(options.userId && { user_id: options.userId }),
		...(anonymousId && { anonymous_id: anonymousId }),
	}

	if (client) {
		client.capture({
			distinctId,
			event: eventName,
			properties: fullProperties,
		})
	}

	// Always log in development
	if (process.env.NODE_ENV === 'development') {
		console.log('[Analytics Server] Track:', eventName, {
			distinctId,
			...fullProperties,
		})
	}
}

// ============================================================================
// USER IDENTIFICATION (SERVER-SIDE)
// ============================================================================

/**
 * Identify user from server-side
 * Use after successful login/signup
 */
export function identifyUser(
	userId: string,
	properties: UserProperties,
	anonymousId?: string,
): void {
	const client = getPostHogClient()

	if (client) {
		// Identify user with properties
		client.identify({
			distinctId: userId,
			properties: {
				...properties,
				...(anonymousId && { anonymous_id: anonymousId }),
			},
		})

		// Alias anonymous ID to user ID if provided
		if (anonymousId) {
			client.alias({
				distinctId: userId,
				alias: anonymousId,
			})
		}
	}

	if (process.env.NODE_ENV === 'development') {
		console.log('[Analytics Server] Identify:', userId, properties)
	}
}

// ============================================================================
// REMIX INTEGRATION HELPERS
// ============================================================================

/**
 * Context object passed to actions/loaders
 */
export interface AnalyticsContext {
	userId?: string
	anonymousId: string | null
	track: <T extends AnalyticsEventName>(
		eventName: T,
		properties: AnalyticsEventMap[T],
	) => void
}

/**
 * Create analytics context from request
 * Use in Remix loaders/actions
 */
export function createAnalyticsContext(
	request: Request,
	userId?: string,
): AnalyticsContext {
	const anonymousId = getAnonymousIdFromRequest(request)

	return {
		userId,
		anonymousId,
		track: <T extends AnalyticsEventName>(
			eventName: T,
			properties: AnalyticsEventMap[T],
		) => {
			trackServerEvent(eventName, properties, {
				userId,
				anonymousId: anonymousId || undefined,
				request,
			})
		},
	}
}

// ============================================================================
// SPECIFIC EVENT HELPERS
// ============================================================================

/**
 * Track signup completed event
 */
export function trackSignupCompleted(
	userId: string,
	method: 'email' | 'oauth',
	provider?: 'google' | 'github' | 'linkedin',
	request?: Request,
): void {
	const anonymousId = request ? getAnonymousIdFromRequest(request) : null

	// Track the event
	trackServerEvent(
		'signup_completed',
		{
			method,
			provider,
			user_id: userId,
		},
		{ userId, anonymousId: anonymousId || undefined, request },
	)

	// Identify the user
	identifyUser(
		userId,
		{
			created_at: new Date().toISOString(),
			plan_type: 'free',
		},
		anonymousId || undefined,
	)
}

/**
 * Track login completed event
 */
export function trackLoginCompleted(
	userId: string,
	method: 'email' | 'oauth',
	provider?: 'google' | 'github' | 'linkedin',
	request?: Request,
): void {
	trackServerEvent(
		'login_completed',
		{
			method,
			provider,
			user_id: userId,
		},
		{
			userId,
			anonymousId: request ? getAnonymousIdFromRequest(request) || undefined : undefined,
			request,
		},
	)
}

/**
 * Track resume uploaded event
 */
export function trackResumeUploaded(
	userId: string,
	fileType: 'pdf' | 'docx' | 'doc',
	fileSizeKb: number,
	request?: Request,
): void {
	trackServerEvent(
		'resume_uploaded',
		{
			file_type: fileType,
			file_size_kb: fileSizeKb,
		},
		{ userId, request },
	)
}

/**
 * Track resume parsed event
 */
export function trackResumeParsed(
	userId: string,
	success: boolean,
	sectionsFound: string[],
	parseDurationMs: number,
	request?: Request,
): void {
	trackServerEvent(
		'resume_parsed',
		{
			success,
			sections_found: sectionsFound,
			parse_duration_ms: parseDurationMs,
		},
		{ userId, request },
	)
}

/**
 * Track resume created event with resume number for multi-resume analysis
 * @param resumeNumber - The nth resume this user has created (1 = first, 2 = second, etc.)
 */
export function trackResumeCreated(
	userId: string,
	method: 'upload' | 'scratch' | 'clone',
	resumeId: string,
	request?: Request,
	resumeNumber?: number,
): void {
	trackServerEvent(
		'resume_created',
		{
			method,
			resume_id: resumeId,
			resume_number: resumeNumber ?? 1,
		},
		{ userId, request },
	)

	// Update user properties for retention analysis
	const isFirstResume = (resumeNumber ?? 1) === 1
	const isSecondResume = resumeNumber === 2

	identifyUser(userId, {
		lifetime_resumes: resumeNumber ?? 1,
		last_active_at: new Date().toISOString(),
		...(isFirstResume && { first_resume_at: new Date().toISOString() }),
		...(isSecondResume && { has_multi_resume: true }),
	})
}

/**
 * Track job created event with job number for multi-job analysis
 * @param jobNumber - The nth job this user has created (1 = first, 2 = second, etc.)
 */
export function trackJobCreated(
	userId: string,
	source: 'manual' | 'paste',
	jobId: string,
	hasCompany: boolean,
	request?: Request,
	jobNumber?: number,
): void {
	trackServerEvent(
		'job_created',
		{
			source,
			job_id: jobId,
			has_company: hasCompany,
			job_number: jobNumber ?? 1,
		},
		{ userId, request },
	)

	// Update user properties for retention analysis
	const isSecondJob = jobNumber === 2

	identifyUser(userId, {
		lifetime_jobs: jobNumber ?? 1,
		last_active_at: new Date().toISOString(),
		...(isSecondJob && { has_multi_job: true }),
	})
}

/**
 * Track AI tailor started event
 */
export function trackAiTailorStarted(
	userId: string,
	experienceId: string,
	hasJobContext: boolean,
	isFreeTier: boolean,
	request?: Request,
	resumeId?: string,
	jobId?: string,
): void {
	trackServerEvent(
		'ai_tailor_started',
		{
			experience_id: experienceId,
			has_job_context: hasJobContext,
			is_free_tier: isFreeTier,
			resume_id: resumeId,
			job_id: jobId,
		},
		{ userId, request },
	)
}

/**
 * Track AI tailor completed event
 */
export function trackAiTailorCompleted(
	userId: string,
	experienceId: string,
	durationMs: number,
	success: boolean,
	tokensUsed?: number,
	request?: Request,
	resumeId?: string,
	jobId?: string,
): void {
	trackServerEvent(
		'ai_tailor_completed',
		{
			experience_id: experienceId,
			duration_ms: durationMs,
			success,
			tokens_used: tokensUsed,
			resume_id: resumeId,
			job_id: jobId,
		},
		{ userId, request },
	)
}

/**
 * Track AI generate started event
 */
export function trackAiGenerateStarted(
	userId: string,
	experienceId: string,
	promptType: 'bullet' | 'summary' | 'full',
	request?: Request,
	resumeId?: string,
	jobId?: string,
): void {
	trackServerEvent(
		'ai_generate_started',
		{
			experience_id: experienceId,
			prompt_type: promptType,
			resume_id: resumeId,
			job_id: jobId,
		},
		{ userId, request },
	)
}

/**
 * Track AI generate completed event
 */
export function trackAiGenerateCompleted(
	userId: string,
	experienceId: string,
	bulletsGenerated: number,
	durationMs: number,
	success: boolean,
	request?: Request,
): void {
	trackServerEvent(
		'ai_generate_completed',
		{
			experience_id: experienceId,
			bullets_generated: bulletsGenerated,
			duration_ms: durationMs,
			success,
		},
		{ userId, request },
	)
}

/**
 * Track analysis started event
 */
export function trackAnalysisStarted(
	userId: string,
	resumeId?: string,
	jobId?: string,
	request?: Request,
): void {
	trackServerEvent(
		'analysis_started',
		{
			resume_id: resumeId,
			job_id: jobId,
		},
		{ userId, request },
	)
}

/**
 * Track analysis completed event
 */
export function trackAnalysisCompleted(
	userId: string,
	score: number,
	issuesCount: number,
	durationMs: number,
	resumeId?: string,
	request?: Request,
): void {
	trackServerEvent(
		'analysis_completed',
		{
			resume_id: resumeId,
			score,
			issues_count: issuesCount,
			duration_ms: durationMs,
		},
		{ userId, request },
	)
}

/**
 * Track resume downloaded event
 */
export function trackResumeDownloaded(
	userId: string,
	format: 'pdf' | 'docx',
	resumeId: string,
	isPaid: boolean,
	downloadCount: number,
	request?: Request,
): void {
	trackServerEvent(
		'resume_downloaded',
		{
			format,
			resume_id: resumeId,
			is_paid: isPaid,
			download_count: downloadCount,
		},
		{ userId, request },
	)
}

/**
 * Track trial started event
 */
export function trackTrialStarted(
	userId: string,
	plan: 'weekly' | 'monthly',
): void {
	trackServerEvent(
		'trial_started',
		{
			plan,
			user_id: userId,
		},
		{ userId },
	)

	// Update user properties
	identifyUser(userId, {
		plan_type: 'trial',
		subscription_status: 'active',
	})
}

/**
 * Track subscription created event
 */
export function trackSubscriptionCreated(
	userId: string,
	plan: 'weekly' | 'monthly',
	value: number,
	currency: string = 'USD',
): void {
	trackServerEvent(
		'subscription_created',
		{
			plan,
			value,
			currency,
			user_id: userId,
		},
		{ userId },
	)

	// Update user properties
	identifyUser(userId, {
		plan_type: 'paid',
		subscription_status: 'active',
	})
}

/**
 * @deprecated Use trackSubscriptionCanceledWithContext for full churn analysis
 */
export function trackSubscriptionCanceled(
	userId: string,
	plan: 'weekly' | 'monthly',
	daysActive: number,
	reason?: string,
): void {
	// Forward to the new function with default values
	trackSubscriptionCanceledWithContext(
		userId,
		plan,
		daysActive,
		0, // lifetimeAiOps - unknown in legacy calls
		0, // lifetimeDownloads - unknown in legacy calls
		false, // cancelAtPeriodEnd - unknown in legacy calls
		reason,
		undefined, // feedback
	)
}

/**
 * Track onboarding path selected event
 */
export function trackOnboardingPathSelected(
	userId: string,
	path: 'tailor' | 'generate' | 'scratch' | 'upload-generate',
	request?: Request,
): void {
	trackServerEvent(
		'onboarding_path_selected',
		{ path },
		{ userId, request },
	)
}

/**
 * Track onboarding step completed event
 */
export function trackOnboardingStepCompleted(
	userId: string,
	stepName: string,
	stepNumber: number,
	path: 'tailor' | 'generate' | 'scratch' | 'upload-generate',
	request?: Request,
): void {
	trackServerEvent(
		'onboarding_step_completed',
		{
			step_name: stepName,
			step_number: stepNumber,
			path,
		},
		{ userId, request },
	)
}

/**
 * Track user activated event
 */
export function trackUserActivated(
	userId: string,
	timeToValueSeconds: number,
	activationPath: 'tailor' | 'generate' | 'scratch' | 'upload-generate' | 'unknown',
	resumeMethod: 'upload' | 'scratch' | 'clone',
	firstAiAction: 'tailor' | 'generate',
	request?: Request,
): void {
	trackServerEvent(
		'user_activated',
		{
			time_to_value_seconds: timeToValueSeconds,
			activation_path: activationPath,
			resume_method: resumeMethod,
			first_ai_action: firstAiAction,
		},
		{ userId, request },
	)

	// Update user properties with activation timestamp
	identifyUser(userId, {
		activated_at: new Date().toISOString(),
	})
}

/**
 * Track outreach generated event
 */
export function trackOutreachGenerated(
	userId: string,
	messageType: 'recruiter' | 'hiring_manager' | 'general',
	resumeId?: string,
	request?: Request,
): void {
	trackServerEvent(
		'outreach_generated',
		{
			resume_id: resumeId,
			message_type: messageType,
		},
		{ userId, request },
	)
}

// ============================================================================
// RETENTION EVENT HELPERS (PMF-critical)
// ============================================================================

/**
 * Track when user edits AI-generated content after accepting it
 * Quality signal: high edit % = AI didn't help much
 */
export function trackAiOutputEdited(
	userId: string,
	experienceId: string,
	editType: 'tailor' | 'generate',
	timeSinceAcceptMs: number,
	originalContent: string,
	editedContent: string,
	resumeId?: string,
	request?: Request,
): void {
	// Calculate change percentage using simple diff
	const originalLength = originalContent.length
	const editedLength = editedContent.length
	const changedPercentage = calculateChangePercentage(originalContent, editedContent)

	trackServerEvent(
		'ai_output_edited',
		{
			experience_id: experienceId,
			edit_type: editType,
			time_since_accept_ms: timeSinceAcceptMs,
			original_length: originalLength,
			edited_length: editedLength,
			changed_percentage: changedPercentage,
			resume_id: resumeId,
		},
		{ userId, request },
	)
}

/**
 * Calculate percentage of content that changed
 * Uses simple length-based heuristic + character diff
 */
function calculateChangePercentage(original: string, edited: string): number {
	if (original === edited) return 0
	if (original.length === 0) return 100

	// Simple approach: compare character-by-character matches
	const maxLen = Math.max(original.length, edited.length)
	let matches = 0

	const originalLower = original.toLowerCase()
	const editedLower = edited.toLowerCase()

	// Count matching characters at same positions
	const minLen = Math.min(original.length, edited.length)
	for (let i = 0; i < minLen; i++) {
		if (originalLower[i] === editedLower[i]) {
			matches++
		}
	}

	const similarity = matches / maxLen
	const changePercentage = Math.round((1 - similarity) * 100)

	return Math.min(100, Math.max(0, changePercentage))
}

/**
 * Track subscription canceled with full churn context
 */
export function trackSubscriptionCanceledWithContext(
	userId: string,
	plan: 'weekly' | 'monthly',
	daysActive: number,
	lifetimeAiOps: number,
	lifetimeDownloads: number,
	cancelAtPeriodEnd: boolean,
	reason?: string,
	feedback?: string,
): void {
	trackServerEvent(
		'subscription_canceled',
		{
			plan,
			days_active: daysActive,
			lifetime_ai_operations: lifetimeAiOps,
			lifetime_downloads: lifetimeDownloads,
			cancel_at_period_end: cancelAtPeriodEnd,
			reason,
			feedback,
		},
		{ userId },
	)

	// Update user properties
	identifyUser(userId, {
		subscription_status: 'canceled',
	})
}

/**
 * Track error events for debugging and monitoring
 */
export function trackError(
	errorMessage: string,
	errorContext: string,
	userId?: string,
	errorStack?: string,
	request?: Request,
): void {
	trackServerEvent(
		'error_occurred',
		{
			error_message: errorMessage,
			error_context: errorContext,
			error_stack: errorStack,
		},
		{ userId, request },
	)
}
