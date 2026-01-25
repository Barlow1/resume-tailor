/**
 * Retention Tracking Service
 *
 * Handles PMF-critical retention signals:
 * - Return visit detection (24h+ gap)
 * - Resurrection detection (14d+ gap)
 * - Incremental user property updates
 * - Activity tracking for cohort analysis
 *
 * Call trackUserActivity() on every meaningful authenticated action
 * to maintain accurate retention metrics.
 */

import { prisma } from '~/utils/db.server.ts'
import { trackServerEvent, identifyUser } from './analytics.server.ts'

const RETURN_THRESHOLD_HOURS = 24
const RESURRECTION_THRESHOLD_DAYS = 14

interface ActivityContext {
	userId: string
	trigger: string // e.g., 'builder_load', 'job_created', 'ai_tailor'
	request?: Request
}

interface UserActivityData {
	lastActiveAt: Date | null
	sessionsCount: number
	daysActive: number
	lifetimeAiOps: number
	isSubscribed: boolean
	wasActivated: boolean
}

/**
 * Track user activity and detect return/resurrection events
 *
 * Call this on every meaningful authenticated action:
 * - Builder page load
 * - Job creation
 * - Resume creation
 * - AI operation
 * - Download
 * - Analysis
 */
export async function trackUserActivity(ctx: ActivityContext): Promise<void> {
	const { userId, trigger, request } = ctx

	// Get user's current activity state
	const activityData = await getUserActivityData(userId)

	if (!activityData) {
		// New user or data not found - just update last_active
		await updateLastActive(userId)
		return
	}

	const now = new Date()
	const lastActive = activityData.lastActiveAt

	// Check for return/resurrection if we have a last active timestamp
	if (lastActive) {
		const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60)
		const daysSinceActive = Math.floor(hoursSinceActive / 24)

		// Resurrection: 14+ days
		if (daysSinceActive >= RESURRECTION_THRESHOLD_DAYS) {
			trackServerEvent(
				'user_resurrected',
				{
					days_since_last_active: daysSinceActive,
					return_trigger: trigger,
					was_previously_activated: activityData.wasActivated,
					is_subscribed: activityData.isSubscribed,
					lifetime_ai_operations: activityData.lifetimeAiOps,
				},
				{ userId, request },
			)
		}
		// Return: 24h+ but < 14 days
		else if (hoursSinceActive >= RETURN_THRESHOLD_HOURS) {
			trackServerEvent(
				'user_returned',
				{
					days_since_last_active: daysSinceActive,
					return_trigger: trigger,
					sessions_count: activityData.sessionsCount + 1,
					is_subscribed: activityData.isSubscribed,
					lifetime_ai_operations: activityData.lifetimeAiOps,
				},
				{ userId, request },
			)
		}
	}

	// Update activity tracking
	await updateUserActivityTracking(userId, activityData, now)
}

/**
 * Get user's activity data from database
 */
async function getUserActivityData(userId: string): Promise<UserActivityData | null> {
	const [user, progress, subscription] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: {
				activatedAt: true,
			},
		}),
		prisma.gettingStartedProgress.findUnique({
			where: { ownerId: userId },
			select: {
				tailorCount: true,
				generateCount: true,
				updatedAt: true,
			},
		}),
		prisma.subscription.findFirst({
			where: { ownerId: userId, active: true },
			select: { id: true },
		}),
	])

	if (!user) return null

	// Use progress.updatedAt as proxy for last activity
	// This gets updated when user does AI operations
	const lastActiveAt = progress?.updatedAt ?? null

	return {
		lastActiveAt,
		sessionsCount: 0, // We'll track this via PostHog user properties
		daysActive: 0, // We'll track this via PostHog user properties
		lifetimeAiOps: (progress?.tailorCount ?? 0) + (progress?.generateCount ?? 0),
		isSubscribed: !!subscription,
		wasActivated: !!user.activatedAt,
	}
}

/**
 * Update last active timestamp in database
 * Uses GettingStartedProgress.updatedAt as the tracking field
 */
async function updateLastActive(userId: string): Promise<void> {
	await prisma.gettingStartedProgress.upsert({
		where: { ownerId: userId },
		update: {
			updatedAt: new Date(),
		},
		create: {
			ownerId: userId,
			hasSavedJob: false,
			hasSavedResume: false,
			hasTailoredResume: false,
			hasGeneratedResume: false,
			tailorCount: 0,
			generateCount: 0,
			downloadCount: 0,
			analysisCount: 0,
			outreachCount: 0,
			quickTailorDownloadCount: 0,
		},
	})
}

/**
 * Update user activity tracking in PostHog
 */
async function updateUserActivityTracking(
	userId: string,
	currentData: UserActivityData,
	now: Date,
): Promise<void> {
	const lastActive = currentData.lastActiveAt
	const isNewDay = !lastActive || !isSameDay(lastActive, now)

	// Update PostHog user properties
	identifyUser(userId, {
		last_active_at: now.toISOString(),
		// Increment days_active if this is a new calendar day
		// Note: PostHog will handle the increment via $set
		...(isNewDay && { days_active: currentData.daysActive + 1 }),
	})

	// Also update the database
	await updateLastActive(userId)
}

/**
 * Check if two dates are the same calendar day
 */
function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	)
}

// ============================================================================
// INCREMENTAL USER PROPERTY UPDATES
// ============================================================================

/**
 * Increment a user's lifetime counter and update related properties
 * Call this after successful actions (resume created, job created, etc.)
 */
export async function incrementUserProperty(
	userId: string,
	property: 'lifetime_resumes' | 'lifetime_jobs' | 'lifetime_ai_operations' | 'lifetime_downloads' | 'lifetime_analyses',
	currentCount: number,
): Promise<void> {
	const newCount = currentCount + 1
	const updates: Record<string, unknown> = {
		[property]: newCount,
		last_active_at: new Date().toISOString(),
	}

	// Set milestone properties
	if (property === 'lifetime_resumes' && newCount === 2) {
		updates.has_multi_resume = true
	}
	if (property === 'lifetime_jobs' && newCount === 2) {
		updates.has_multi_job = true
	}

	// Set first-time timestamps
	if (newCount === 1) {
		const timestampMap: Record<string, string> = {
			lifetime_resumes: 'first_resume_at',
			lifetime_downloads: 'first_download_at',
			lifetime_ai_operations: 'first_ai_action_at',
		}
		const timestampProp = timestampMap[property]
		if (timestampProp) {
			updates[timestampProp] = new Date().toISOString()
		}
	}

	identifyUser(userId, updates)
}

/**
 * Get current counts for a user from the database
 * Used to calculate accurate lifetime values
 */
export async function getUserCounts(userId: string): Promise<{
	resumeCount: number
	jobCount: number
	aiOpsCount: number
	downloadCount: number
	analysisCount: number
}> {
	const [resumeCount, jobCount, progress] = await Promise.all([
		prisma.builderResume.count({ where: { userId } }),
		prisma.job.count({ where: { ownerId: userId } }),
		prisma.gettingStartedProgress.findUnique({
			where: { ownerId: userId },
			select: {
				tailorCount: true,
				generateCount: true,
				downloadCount: true,
				analysisCount: true,
			},
		}),
	])

	return {
		resumeCount,
		jobCount,
		aiOpsCount: (progress?.tailorCount ?? 0) + (progress?.generateCount ?? 0),
		downloadCount: progress?.downloadCount ?? 0,
		analysisCount: progress?.analysisCount ?? 0,
	}
}
