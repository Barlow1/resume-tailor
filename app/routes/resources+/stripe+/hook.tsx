import { type DataFunctionArgs, json } from '@remix-run/node'
import type Stripe from 'stripe'
import { invariant } from '~/utils/misc.ts'
import {
	activateSubscription,
	deactivateSubscription,
} from '~/utils/subscription.server.ts'
import { PrismaClient } from '@prisma/client'
import { trackTrialStarted, trackSubscriptionCreated } from '~/lib/analytics.server.ts'

interface StripeEvent {
	type: string
	data: {
		object: unknown;
	}
}

export async function action(args: DataFunctionArgs) {
	const event = (await args.request.json()) as StripeEvent
	invariant(event, 'event is required for this endpoint')

	switch (event.type) {
		case 'checkout.session.completed': {
			const completedCheckout: Stripe.Checkout.Session = event.data.object as Stripe.Checkout.Session;
			// Then define and call a method to handle the successful checkout completed.
			await handleCheckoutSessionCompleted(completedCheckout)
			break
		}
		case 'customer.subscription.deleted': {
			const deletedSubscription: Stripe.Subscription = event.data.object as  Stripe.Subscription;
			await handleCanceledSubscription(deletedSubscription)
			break;
		}
		case 'invoice.payment_succeeded': {
			const invoice: Stripe.Invoice = event.data.object as Stripe.Invoice;
			await handleInvoicePaymentSucceeded(invoice)
			break;
		}
		default:
			// Unexpected event type
			console.log(`Unhandled event type ${event.type}.`)
	}
	return json({ success: true })
}

async function handleCheckoutSessionCompleted(
	completedCheckout: Stripe.Checkout.Session,
) {
	invariant(
		completedCheckout.metadata?.subscriptionId,
		'subscriptionId must be present on the checkout complete webhook',
	)
	invariant(
		typeof completedCheckout.subscription === 'string',
		'subscription string must be present on checkout complete webhook',
	)
	const subscription = await activateSubscription(
		completedCheckout.metadata.subscriptionId,
		completedCheckout.subscription,
	)

	// Create conversion event for subscription_started tracking
	if (!subscription.ownerId) {
		console.error(`Subscription ${subscription.id} has no ownerId - cannot track conversion`)
		return
	}

	const prisma = new PrismaClient()
	try {
		await prisma.$connect()

		const isWeekly = subscription.stripePriceId === process.env.STRIPE_PRICE_ID_WEEKLY
		const planTier = isWeekly ? 'weekly' : 'monthly'

		await prisma.conversionEvent.create({
			data: {
				userId: subscription.ownerId,
				subscriptionId: subscription.id,
				planTier,
				priceUsd: 0,
				eventType: 'subscription_started',
			},
		})

		// Track trial started in PostHog
		trackTrialStarted(subscription.ownerId, planTier as 'weekly' | 'monthly')

		console.log(`Created subscription_started conversion event for user ${subscription.ownerId}`)
	} catch (e) {
		console.error('Error creating subscription_started conversion event', e)
		throw e
	} finally {
		await prisma.$disconnect()
	}
}
async function handleCanceledSubscription(deletedSubscription: Stripe.Subscription) {
	invariant(
		deletedSubscription.id,
		'id must be present on the subscription deleted webhook',
	)
	await deactivateSubscription(deletedSubscription.id)
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
	// Only track subscription_cycle invoices (actual charges after trial)
	// Skip subscription_create which is the initial $0 invoice
	if (invoice.billing_reason !== 'subscription_cycle') {
		console.log(`Skipping invoice with billing_reason: ${invoice.billing_reason}`)
		return
	}

	invariant(
		typeof invoice.subscription === 'string',
		'subscription must be present on invoice.payment_succeeded webhook',
	)

	const prisma = new PrismaClient()
	try {
		await prisma.$connect()

		// Find the subscription by Stripe subscription ID
		const subscription = await prisma.subscription.findUnique({
			where: {
				stripeSubscriptionId: invoice.subscription,
			},
			select: {
				id: true,
				ownerId: true,
				stripePriceId: true,
			},
		})

		if (!subscription || !subscription.ownerId) {
			console.error(`Subscription not found for invoice: ${invoice.id}`)
			return
		}

		// Determine plan tier and price from stripePriceId
		const isWeekly = subscription.stripePriceId === process.env.STRIPE_PRICE_ID_WEEKLY
		const planTier = isWeekly ? 'weekly' : 'monthly'
		const priceUsd = isWeekly ? 4.99 : 15.0

		// Create conversion event (tracked: false by default)
		await prisma.conversionEvent.create({
			data: {
				userId: subscription.ownerId,
				subscriptionId: subscription.id,
				planTier,
				priceUsd,
				eventType: 'purchase_completed',
				tracked: false,
			},
		})

		// Track subscription created in PostHog
		trackSubscriptionCreated(
			subscription.ownerId,
			planTier as 'weekly' | 'monthly',
			priceUsd,
			'USD',
		)

		console.log(`Created conversion event for user ${subscription.ownerId}`)
	} catch (e) {
		console.error('Error handling invoice.payment_succeeded', e)
		throw e
	} finally {
		await prisma.$disconnect()
	}
}
