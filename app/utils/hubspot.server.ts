import { Client } from '@hubspot/api-client'
const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_API_KEY })

export async function createHubspotContact({
	email,
	firstName,
	lastName,
}: {
	email: string
	firstName: string | undefined
	lastName: string | undefined
}) {
	const contact = await hubspotClient.crm.contacts.basicApi.create({
		properties: {
			email,
            firstname: firstName ?? '',
            lastname: lastName ?? '',
		},
		associations: [],
	})
	return contact
}
