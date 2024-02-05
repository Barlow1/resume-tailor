import { redirect } from '@remix-run/router'
import { DataFunctionArgs } from '@remix-run/server-runtime'
import {
	requireStripeSubscription,
	requireUserId,
} from '~/utils/auth.server.ts'
import StripeHelper from '~/utils/stripe.server.ts'

export async function action(args: DataFunctionArgs) {
	const redirectTo = new URL(args.request.url).searchParams.get('redirectTo')
	const baseUrl = new URL(args.request.url).origin
	const returnUrl = `${baseUrl}${redirectTo}`
	const userId = await requireUserId(args.request, { redirectTo })
	const subscription = await requireStripeSubscription(
		userId,
		returnUrl,
		returnUrl,
	)

	const stripe = new StripeHelper()

	const billingPortalUrl = await stripe.createBillingPortalSession({
		customerId: subscription.stripeCustomerId,
		returnUrl: returnUrl,
	})

	return redirect(billingPortalUrl)
}
