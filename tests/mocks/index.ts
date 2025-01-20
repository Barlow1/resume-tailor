import { rest } from 'msw'
import { setupServer } from 'msw/node'
import closeWithGrace from 'close-with-grace'
import { requiredHeader, writeEmail } from './utils.ts'
import { faker } from '@faker-js/faker'

const handlers = [
	process.env.REMIX_DEV_HTTP_ORIGIN
		? rest.post(`${process.env.REMIX_DEV_HTTP_ORIGIN}ping`, req =>
				req.passthrough(),
		  )
		: null,

	// feel free to remove this conditional from the mock once you've set up resend
	process.env.RESEND_API_KEY
		? rest.post(`https://api.resend.com/emails`, async (req, res, ctx) => {
				requiredHeader(req.headers, 'Authorization')
				const body = await req.json()
				console.info('🔶 mocked email contents:', body)

				await writeEmail(body)

				return res(
					ctx.json({
						id: faker.string.uuid(),
						from: body.from,
						to: body.to,
						created_at: new Date().toISOString(),
					}),
				)
		  })
		: null,
		rest.post(`https://api.hubapi.com/crm/v3/objects/contacts`, async (req, res, ctx) => {
				requiredHeader(req.headers, 'Authorization')
				const body = await req.json()
				console.info('🔶 mocked hubapi contents:', body)

				return res(
					ctx.status(201),
					ctx.json({
						"createdAt": "2024-03-17T01:09:50.187Z",
						"archived": false,
						"archivedAt": "2024-03-17T01:09:50.187Z",
						"propertiesWithHistory": {
						  "additionalProp1": [
							{
							  "sourceId": "string",
							  "sourceType": "string",
							  "sourceLabel": "string",
							  "updatedByUserId": 0,
							  "value": "string",
							  "timestamp": "2024-03-17T01:09:50.187Z"
							}
						  ],
						  "additionalProp2": [
							{
							  "sourceId": "string",
							  "sourceType": "string",
							  "sourceLabel": "string",
							  "updatedByUserId": 0,
							  "value": "string",
							  "timestamp": "2024-03-17T01:09:50.187Z"
							}
						  ],
						  "additionalProp3": [
							{
							  "sourceId": "string",
							  "sourceType": "string",
							  "sourceLabel": "string",
							  "updatedByUserId": 0,
							  "value": "string",
							  "timestamp": "2024-03-17T01:09:50.187Z"
							}
						  ]
						},
						"id": "512",
						"properties": {
						  "property_date": "1572480000000",
						  "property_radio": "option_1",
						  "property_number": "17",
						  "property_string": "value",
						  "property_checkbox": "false",
						  "property_dropdown": "choice_b",
						  "property_multiple_checkboxes": "chocolate;strawberry"
						},
						"updatedAt": "2024-03-17T01:09:50.187Z"
					  }),
				)
		  }),
		// mock recaptcha token retrieval
		rest.get(
			`https://www.google.com/recaptcha/api2/reload?k=${process.env.RECAPTCHA_SITE_KEY}`,
			(req, res, ctx) => {
				console.log('🔶 mocked recaptcha token retrieval')
				return res(ctx.json({ token: '1234567890' }))
			},
		),
		// mock recaptcha score retrieval
		rest.post(
			`https://www.google.com/recaptcha/api/siteverify`,
			(req, res, ctx) => {
				console.log('🔶 mocked recaptcha score retrieval')
				return res(ctx.json({ success: true, score: 0.9 }))
			},
		),
].filter(Boolean)

const server = setupServer(...handlers)

server.listen({ onUnhandledRequest: 'warn' })
console.info('🔶 Mock server installed')

closeWithGrace(() => {
	server.close()
})
