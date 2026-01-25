/**
 * PostHog Analytics Event Type Definitions
 *
 * This file provides type safety for all analytics events across client and server.
 * Each event has strictly defined properties to ensure consistent tracking.
 */

// ============================================================================
// PRE-AUTH EVENTS (Client-side, anonymous)
// ============================================================================

export interface PageViewedEvent {
	path: string
	referrer: string | null
	utm_source?: string
	utm_medium?: string
	utm_campaign?: string
	utm_term?: string
	utm_content?: string
}

export interface CtaClickedEvent {
	cta_name: string
	cta_location: string
	destination: string
}

export interface PricingViewedEvent {
	referrer?: string
}

export interface SignupFormStartedEvent {
	referrer?: string
}

// ============================================================================
// AUTH FLOW EVENTS (Mix of client + server)
// ============================================================================

export interface SignupStartedEvent {
	method: 'email' | 'oauth'
	provider?: 'google' | 'github' | 'linkedin'
}

export interface SignupCompletedEvent {
	method: 'email' | 'oauth'
	provider?: 'google' | 'github' | 'linkedin'
	user_id: string
}

export interface SignupFailedEvent {
	method: 'email' | 'oauth'
	provider?: 'google' | 'github' | 'linkedin'
	error_type: string
}

export interface LoginCompletedEvent {
	method: 'email' | 'oauth'
	provider?: 'google' | 'github' | 'linkedin'
	user_id: string
}

export interface OauthStartedEvent {
	provider: 'google' | 'github' | 'linkedin'
}

export interface EmailVerifiedEvent {
	user_id: string
}

// ============================================================================
// ONBOARDING EVENTS (Server-side)
// ============================================================================

export type OnboardingPath = 'tailor' | 'generate' | 'scratch' | 'upload-generate'

export interface OnboardingPathSelectedEvent {
	path: OnboardingPath
}

export interface OnboardingStepCompletedEvent {
	step_name: string
	step_number: number
	path: OnboardingPath
}

export interface OnboardingCompletedEvent {
	path: OnboardingPath
	duration_seconds: number
}

export interface OnboardingAbandonedEvent {
	last_step: string
	path: OnboardingPath
}

// ============================================================================
// CORE VALUE MOMENT EVENTS (Server-side)
// ============================================================================

export interface ResumeUploadedEvent {
	file_type: 'pdf' | 'docx' | 'doc'
	file_size_kb: number
}

export interface ResumeParsedEvent {
	success: boolean
	sections_found: string[]
	parse_duration_ms: number
}

export interface ResumeCreatedEvent {
	method: 'upload' | 'scratch' | 'clone'
	resume_id: string
	resume_number: number // 1st, 2nd, 3rd resume - identifies power users
}

export interface JobCreatedEvent {
	source: 'manual' | 'paste'
	job_id: string
	has_company: boolean
	job_number: number // 1st, 2nd, 3rd job - identifies engaged users
}

export interface JobSelectedEvent {
	job_id: string
	resume_id: string
}

export interface AiTailorStartedEvent {
	experience_id: string
	has_job_context: boolean
	is_free_tier: boolean
	resume_id?: string
	job_id?: string
}

export interface AiTailorCompletedEvent {
	experience_id: string
	tokens_used?: number
	duration_ms: number
	success: boolean
	resume_id?: string
	job_id?: string
}

export interface AiTailorAcceptedEvent {
	experience_id: string
	changes_made: number
}

export interface AiTailorRejectedEvent {
	experience_id: string
}

export interface AiGenerateStartedEvent {
	experience_id: string
	prompt_type: 'bullet' | 'summary' | 'full'
	resume_id?: string
	job_id?: string
}

export interface AiGenerateCompletedEvent {
	experience_id: string
	bullets_generated: number
	duration_ms: number
	success: boolean
}

export interface AnalysisStartedEvent {
	resume_id?: string
	job_id?: string
}

export interface AnalysisCompletedEvent {
	resume_id?: string
	score: number
	issues_count: number
	duration_ms: number
}

export interface OutreachGeneratedEvent {
	resume_id?: string
	message_type: 'recruiter' | 'hiring_manager' | 'general'
}

export interface ResumeDownloadedEvent {
	format: 'pdf' | 'docx'
	resume_id: string
	is_paid: boolean
	download_count: number
}

// ============================================================================
// PAYWALL / CONVERSION EVENTS (Mix)
// ============================================================================

export type PaywallTrigger = 'ai_limit' | 'download_limit' | 'analysis_limit' | 'outreach_limit'

export interface PaywallShownEvent {
	trigger: PaywallTrigger
	usage_count: number
	limit: number
}

export interface PaywallDismissedEvent {
	trigger: PaywallTrigger
	time_viewed_ms: number
}

export interface CheckoutStartedEvent {
	plan: 'weekly' | 'monthly'
	is_trial: boolean
	trigger: PaywallTrigger | 'direct'
}

export interface TrialStartedEvent {
	plan: 'weekly' | 'monthly'
	user_id: string
}

export interface SubscriptionCreatedEvent {
	plan: 'weekly' | 'monthly'
	value: number
	currency: string
	user_id: string
}

export interface SubscriptionCanceledEvent {
	plan: 'weekly' | 'monthly'
	reason?: string // from Stripe cancellation_details.reason
	feedback?: string // from Stripe cancellation_details.feedback
	days_active: number
	cancel_at_period_end: boolean // true = will cancel at period end, false = immediate
	lifetime_ai_operations: number // churn correlation signal
	lifetime_downloads: number
}

// ============================================================================
// ENGAGEMENT EVENTS (Client-side)
// ============================================================================

export interface BuilderOpenedEvent {
	resume_id: string
	has_job: boolean
	section_count: number
}

export type BuilderSection = 'experience' | 'education' | 'skills' | 'summary' | 'contact' | 'header'

export interface BuilderSectionEditedEvent {
	section: BuilderSection
	resume_id: string
}

export type AiModalType = 'tailor' | 'generate'

export interface AiModalOpenedEvent {
	modal_type: AiModalType
	experience_id?: string
}

export interface AiModalClosedEvent {
	modal_type: AiModalType
	had_result: boolean
	was_accepted: boolean
	session_duration_ms: number
}

export type FeatureName =
	| 'resume_upload'
	| 'job_creation'
	| 'ai_tailor'
	| 'ai_generate'
	| 'pdf_download'
	| 'docx_download'
	| 'resume_analysis'
	| 'outreach'
	| 'builder'

export interface FeatureFirstUseEvent {
	feature_name: FeatureName
}

// ============================================================================
// ACTIVATION EVENT
// ============================================================================

export interface UserActivatedEvent {
	time_to_value_seconds: number
	activation_path: OnboardingPath | 'unknown'
	resume_method: 'upload' | 'scratch' | 'clone'
	first_ai_action: 'tailor' | 'generate'
}

// ============================================================================
// RETENTION EVENTS (Server-side) - Critical for PMF measurement
// ============================================================================

/**
 * Fired when user returns after 24h+ absence (but < 14 days)
 * Key retention signal - who comes back?
 */
export interface UserReturnedEvent {
	days_since_last_active: number
	return_trigger: string // which action brought them back (e.g., 'builder_load', 'job_created')
	sessions_count: number
	is_subscribed: boolean
	lifetime_ai_operations: number
}

/**
 * Fired when user returns after 14+ days absence
 * Resurrection signal - powerful for win-back analysis
 */
export interface UserResurrectedEvent {
	days_since_last_active: number
	return_trigger: string
	was_previously_activated: boolean
	is_subscribed: boolean
	lifetime_ai_operations: number
}

/**
 * Fired when user edits AI-generated content after accepting it
 * Quality signal - did the AI actually help or did they rewrite it?
 */
export interface AiOutputEditedEvent {
	experience_id: string
	edit_type: 'tailor' | 'generate'
	time_since_accept_ms: number
	original_length: number
	edited_length: number
	changed_percentage: number // 0-100, higher = more editing needed
	resume_id?: string
}

// ============================================================================
// EVENT MAP - Maps event names to their property types
// ============================================================================

export interface AnalyticsEventMap {
	// Pre-auth
	page_viewed: PageViewedEvent
	cta_clicked: CtaClickedEvent
	pricing_viewed: PricingViewedEvent
	signup_form_started: SignupFormStartedEvent

	// Auth flow
	signup_started: SignupStartedEvent
	signup_completed: SignupCompletedEvent
	signup_failed: SignupFailedEvent
	login_completed: LoginCompletedEvent
	oauth_started: OauthStartedEvent
	email_verified: EmailVerifiedEvent

	// Onboarding
	onboarding_path_selected: OnboardingPathSelectedEvent
	onboarding_step_completed: OnboardingStepCompletedEvent
	onboarding_completed: OnboardingCompletedEvent
	onboarding_abandoned: OnboardingAbandonedEvent

	// Core value moments
	resume_uploaded: ResumeUploadedEvent
	resume_parsed: ResumeParsedEvent
	resume_created: ResumeCreatedEvent
	job_created: JobCreatedEvent
	job_selected: JobSelectedEvent
	ai_tailor_started: AiTailorStartedEvent
	ai_tailor_completed: AiTailorCompletedEvent
	ai_tailor_accepted: AiTailorAcceptedEvent
	ai_tailor_rejected: AiTailorRejectedEvent
	ai_generate_started: AiGenerateStartedEvent
	ai_generate_completed: AiGenerateCompletedEvent
	analysis_started: AnalysisStartedEvent
	analysis_completed: AnalysisCompletedEvent
	outreach_generated: OutreachGeneratedEvent
	resume_downloaded: ResumeDownloadedEvent

	// Paywall / Conversion
	paywall_shown: PaywallShownEvent
	paywall_dismissed: PaywallDismissedEvent
	checkout_started: CheckoutStartedEvent
	trial_started: TrialStartedEvent
	subscription_created: SubscriptionCreatedEvent
	subscription_canceled: SubscriptionCanceledEvent

	// Engagement
	builder_opened: BuilderOpenedEvent
	builder_section_edited: BuilderSectionEditedEvent
	ai_modal_opened: AiModalOpenedEvent
	ai_modal_closed: AiModalClosedEvent
	feature_first_use: FeatureFirstUseEvent

	// Activation
	user_activated: UserActivatedEvent

	// Retention (PMF signals)
	user_returned: UserReturnedEvent
	user_resurrected: UserResurrectedEvent
	ai_output_edited: AiOutputEditedEvent
}

// Type for event names
export type AnalyticsEventName = keyof AnalyticsEventMap

// Helper type for getting properties of a specific event
export type EventProperties<T extends AnalyticsEventName> = AnalyticsEventMap[T]

// ============================================================================
// USER PROPERTIES (for identify calls)
// ============================================================================

export interface UserProperties {
	// Identity
	email?: string
	name?: string
	username?: string
	created_at?: string

	// Subscription
	plan_type?: 'free' | 'trial' | 'paid'
	subscription_status?: 'active' | 'canceled' | 'expired' | 'none'

	// Activation timestamps
	activated_at?: string
	first_resume_at?: string
	first_ai_action_at?: string
	first_download_at?: string

	// Lifetime counters (INCREMENT these, don't just set once)
	lifetime_resumes?: number
	lifetime_jobs?: number
	lifetime_ai_operations?: number // tailor + generate combined
	lifetime_downloads?: number
	lifetime_analyses?: number

	// Activity tracking (for retention cohorts)
	last_active_at?: string // UPDATE on every authenticated action
	days_active?: number // unique calendar days with activity
	sessions_count?: number // total sessions

	// Engagement depth (for power user identification)
	has_multi_resume?: boolean // created 2+ resumes
	has_multi_job?: boolean // created 2+ jobs
	max_ai_ops_single_resume?: number // most AI operations on one resume

	// Legacy (keep for backwards compatibility)
	resume_count?: number
	job_count?: number
	tailor_count?: number
	generate_count?: number
	download_count?: number
}

// ============================================================================
// COMMON PROPERTIES (automatically added to all events)
// ============================================================================

export interface CommonEventProperties {
	timestamp: string
	session_id?: string
	user_id?: string
	anonymous_id?: string
	is_authenticated: boolean
	plan_type?: 'free' | 'trial' | 'paid'
	platform: 'web'
	app_version?: string
}
