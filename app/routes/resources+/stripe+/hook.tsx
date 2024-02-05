import { type DataFunctionArgs, json } from '@remix-run/node'
import type Stripe from 'stripe'
import { invariant } from '~/utils/misc.ts'
import {
	activateSubscription,
	deactivateSubscription,
} from '~/utils/subscription.server.ts'

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
	await activateSubscription(
		completedCheckout.metadata.subscriptionId,
		completedCheckout.subscription,
	)
}
async function handleCanceledSubscription(deletedSubscription: Stripe.Subscription) {
	invariant(
		deletedSubscription.id,
		'id must be present on the subscription deleted webhook',
	)
	await deactivateSubscription(deletedSubscription.id)
}
