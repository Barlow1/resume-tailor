import { Container, Html, Tailwind, Text } from '@react-email/components'
import tailwindConfig from '../../../../tailwind.config.ts'

export function ForgotUsernameEmail({
	username,
}: {
	username: string
}) {
	return (
		<Tailwind config={tailwindConfig}>
			<Html lang="en" dir="ltr">
				<Container>
					<h1>
						<Text>Resume Tailor Username</Text>
					</h1>
					<p>
						<Text>
							Here's your username: <strong>{username}</strong>
						</Text>
					</p>
				</Container>
			</Html>
		</Tailwind>
	)
}
