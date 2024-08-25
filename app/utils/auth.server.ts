import { type Password, type User } from '@prisma/client'
import { redirect } from '@remix-run/node'
import bcrypt from 'bcryptjs'
import { Authenticator } from 'remix-auth'
import { FormStrategy } from 'remix-auth-form'
import { prisma } from '~/utils/db.server.ts'
import { invariant } from './misc.ts'
import { sessionStorage } from './session.server.ts'
import StripeHelper from './stripe.server.ts'
import { createSubscription } from './subscription.server.ts'
import { createHubspotContact } from './hubspot.server.ts'
import { env } from 'node:process'

export type { User }

export const authenticator = new Authenticator<string>(sessionStorage, {
	sessionKey: 'sessionId',
})

const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30

authenticator.use(
	new FormStrategy(async ({ form }) => {
		const username = form.get('username')
		const password = form.get('password')

		invariant(typeof username === 'string', 'username must be a string')
		invariant(username.length > 0, 'username must not be empty')

		invariant(typeof password === 'string', 'password must be a string')
		invariant(password.length > 0, 'password must not be empty')

		const user = await verifyUserPassword({ username }, password)
		if (!user) {
			throw new Error('Invalid username or password')
		}
		const session = await prisma.session.create({
			data: {
				expirationDate: new Date(Date.now() + SESSION_EXPIRATION_TIME),
				userId: user.id,
			},
			select: { id: true },
		})

		return session.id
	}),
	FormStrategy.name,
)

export async function requireUserId(
	request: Request,
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const requestUrl = new URL(request.url)
	redirectTo =
		redirectTo === null
			? null
			: redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
	const loginParams = redirectTo
		? new URLSearchParams([['redirectTo', redirectTo]])
		: null
	const failureRedirect = ['/login', loginParams?.toString()]
		.filter(Boolean)
		.join('?')
	const sessionId = await authenticator.isAuthenticated(request, {
		failureRedirect,
	})
	const session = await prisma.session.findFirst({
		where: { id: sessionId },
		select: { userId: true, expirationDate: true },
	})
	if (!session) {
		throw redirect(failureRedirect)
	}
	return session.userId
}

export async function requireStripeSubscription(
	userId: string,
	successUrl: string,
	cancelUrl: string
) {
	const subscription = await prisma.subscription.findFirst({
		where: {
			ownerId: userId,
			active: true,
		},
	})
	if (!subscription && env.NODE_ENV !== 'development') {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, name: true, id: true },
		})

		if (!user) {
			throw redirect('/login')
		}

		const stripe = new StripeHelper()

		// create a customer
		const customer = await stripe.createCustomer({
			userId: user.id,
			email: user.email,
			name: user.name ?? 'Anonymous User',
		})

		// create subscription
		const subscription = await createSubscription({
			userId,
			stripeCustomerId: customer,
			name: 'Resume Tailor Pro',
			stripeProductId: process.env.STRIPE_PRODUCT_ID as string,
			stripePriceId: process.env.STRIPE_PRICE_ID as string,
		})

		// create a checkout link
		const paymentLink = await stripe.createCheckoutSessionLink({
			priceId: process.env.STRIPE_PRICE_ID as string,
			customer: customer,
			successUrl:successUrl,
			subscriptionId: subscription.id,
			cancelUrl: cancelUrl,
		});

		throw redirect(paymentLink.url ?? '/login')
	}
	return subscription;
}

export async function getUserId(request: Request) {
	const sessionId = await authenticator.isAuthenticated(request)
	if (!sessionId) return null
	const session = await prisma.session.findUnique({
		where: { id: sessionId },
		select: { userId: true },
	})
	if (!session) {
		// Perhaps their session was deleted?
		await authenticator.logout(request, { redirectTo: '/' })
		return null
	}
	return session.userId
}

export async function requireAnonymous(request: Request) {
	await authenticator.isAuthenticated(request, {
		successRedirect: '/',
	})
}

export async function resetUserPassword({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const hashedPassword = await bcrypt.hash(password, 10)
	return prisma.user.update({
		where: { username },
		data: {
			password: {
				update: {
					hash: hashedPassword,
				},
			},
		},
	})
}

export async function signup({
	email,
	username,
	password,
	name,
}: {
	email: User['email']
	username: User['username']
	name: User['name']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)

	const session = await prisma.session.create({
		data: {
			expirationDate: new Date(Date.now() + SESSION_EXPIRATION_TIME),
			user: {
				create: {
					email: email.toLowerCase(),
					username: username.toLowerCase(),
					name,
					password: {
						create: {
							hash: hashedPassword,
						},
					},
				},
			},
		},
		select: { id: true, expirationDate: true },
	})

	let firstName = '';
	let lastName = '';
	if (name) {
		firstName = name.split(' ')[0];
		lastName = name.split(' ')[1];
	}

	await createHubspotContact({ email, firstName, lastName })
	return session
}

export async function getPasswordHash(password: string) {
	const hash = await bcrypt.hash(password, 10)
	return hash
}

export async function verifyUserPassword(
	where: Pick<User, 'username'> | Pick<User, 'id'>,
	password: Password['hash'],
) {
	const userWithPassword = await prisma.user.findUnique({
		where,
		select: { id: true, password: { select: { hash: true } } },
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		return null
	}

	return { id: userWithPassword.id }
}
