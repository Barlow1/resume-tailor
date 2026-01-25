/**
 * User Activation Tracking Service
 *
 * Implements the activation metric:
 * ACTIVATED = User who has:
 * 1. Created or uploaded a resume (resume_created OR resume_uploaded)
 * 2. AND completed at least one AI operation (ai_tailor_completed OR ai_generate_completed)
 *
 * Time to Value = signup_completed → user_activated
 * - Healthy: < 10 minutes
 * - Warning: > 30 minutes
 */

import { prisma } from '~/utils/db.server.ts'
import { trackUserActivated } from './analytics.server.ts'

interface ActivationCheckResult {
	isActivated: boolean
	hasResume: boolean
	hasAiAction: boolean
	activatedAt?: Date
	timeToValueSeconds?: number
}

/**
 * Check if a user meets activation criteria
 */
export async function checkUserActivation(userId: string): Promise<ActivationCheckResult> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			createdAt: true,
			activatedAt: true,
		},
	})

	if (!user) {
		return { isActivated: false, hasResume: false, hasAiAction: false }
	}

	// Already activated
	if (user.activatedAt) {
		const timeToValueSeconds = Math.floor(
			(user.activatedAt.getTime() - user.createdAt.getTime()) / 1000
		)
		return {
			isActivated: true,
			hasResume: true,
			hasAiAction: true,
			activatedAt: user.activatedAt,
			timeToValueSeconds,
		}
	}

	// Check for resume
	const resume = await prisma.builderResume.findFirst({
		where: { userId },
		select: { id: true },
	})
	const hasResume = !!resume

	// Check for AI action (tailor or generate count > 0)
	const progress = await prisma.gettingStartedProgress.findUnique({
		where: { ownerId: userId },
		select: {
			tailorCount: true,
			generateCount: true,
			hasTailoredResume: true,
			hasGeneratedResume: true,
		},
	})

	const hasAiAction = !!(
		progress &&
		((progress.tailorCount ?? 0) > 0 ||
			(progress.generateCount ?? 0) > 0 ||
			progress.hasTailoredResume ||
			progress.hasGeneratedResume)
	)

	return {
		isActivated: hasResume && hasAiAction,
		hasResume,
		hasAiAction,
	}
}

/**
 * Attempt to activate a user if they meet criteria
 * Call this after resume creation or AI action completion
 */
export async function tryActivateUser(
	userId: string,
	triggerAction: 'resume_created' | 'ai_tailor_completed' | 'ai_generate_completed',
	request?: Request,
): Promise<boolean> {
	const activation = await checkUserActivation(userId)

	// Already activated or not meeting criteria
	if (!activation.isActivated) {
		return false
	}

	// User just became activated - check if already marked
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { activatedAt: true, createdAt: true },
	})

	if (user?.activatedAt) {
		// Already marked as activated
		return true
	}

	// Mark as activated
	const now = new Date()
	await prisma.user.update({
		where: { id: userId },
		data: { activatedAt: now },
	})

	// Calculate time to value
	const timeToValueSeconds = user
		? Math.floor((now.getTime() - user.createdAt.getTime()) / 1000)
		: 0

	// Determine activation path from getting started progress
	const progress = await prisma.gettingStartedProgress.findUnique({
		where: { ownerId: userId },
		select: {
			hasTailoredResume: true,
			hasGeneratedResume: true,
		},
	})

	// Determine resume method
	const resumeMethod: 'upload' | 'scratch' | 'clone' = 'upload' // Default assumption

	// Determine first AI action
	const firstAiAction: 'tailor' | 'generate' =
		triggerAction === 'ai_tailor_completed' ? 'tailor' : 'generate'

	// Determine activation path
	let activationPath: 'tailor' | 'generate' | 'scratch' | 'upload-generate' | 'unknown' = 'unknown'
	if (progress?.hasTailoredResume) {
		activationPath = 'tailor'
	} else if (progress?.hasGeneratedResume) {
		activationPath = 'generate'
	}

	// Track activation event in PostHog
	trackUserActivated(
		userId,
		timeToValueSeconds,
		activationPath,
		resumeMethod,
		firstAiAction,
		request,
	)

	console.log(`[Activation] User ${userId} activated in ${timeToValueSeconds}s via ${triggerAction}`)

	return true
}

/**
 * Get activation metrics for a user
 */
export async function getActivationMetrics(userId: string): Promise<{
	isActivated: boolean
	timeToValueSeconds?: number
	activationHealth: 'healthy' | 'warning' | 'critical' | 'not_activated'
}> {
	const activation = await checkUserActivation(userId)

	if (!activation.isActivated || !activation.timeToValueSeconds) {
		return {
			isActivated: false,
			activationHealth: 'not_activated',
		}
	}

	const minutes = activation.timeToValueSeconds / 60

	let activationHealth: 'healthy' | 'warning' | 'critical' | 'not_activated'
	if (minutes < 10) {
		activationHealth = 'healthy'
	} else if (minutes < 30) {
		activationHealth = 'warning'
	} else {
		activationHealth = 'critical'
	}

	return {
		isActivated: true,
		timeToValueSeconds: activation.timeToValueSeconds,
		activationHealth,
	}
}
