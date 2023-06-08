import fs from 'fs'
import { faker } from '@faker-js/faker'
import { createPassword, createUser } from 'tests/db-utils.ts'
import { prisma } from '~/utils/db.server.ts'
import { deleteAllData } from 'tests/setup/utils.ts'
import { getPasswordHash } from '~/utils/auth.server.ts'

async function seed() {
	console.log('🌱 Seeding...')
	console.time(`🌱 Database has been seeded`)

	console.time('🧹 Cleaned up the database...')
	deleteAllData()
	console.timeEnd('🧹 Cleaned up the database...')

	console.time(`👑 Created admin role/permission...`)
	const adminRole = await prisma.role.create({
		data: {
			name: 'admin',
			permissions: {
				create: { name: 'admin' },
			},
		},
	})
	console.timeEnd(`👑 Created admin role/permission...`)
	// hosts with ships and reviews
	// renters with bookings and reviews
	// hosts who are renters also
	const totalUsers = 40
	console.time(`👤 Created ${totalUsers} users...`)
	const users = await Promise.all(
		Array.from({ length: totalUsers }, async (_, index) => {
			const userData = createUser()
			const user = await prisma.user.create({
				data: {
					...userData,
					password: {
						create: createPassword(userData.username),
					},
					image: {
						create: {
							contentType: 'image/jpeg',
							file: {
								create: {
									blob: await fs.promises.readFile(
										`./tests/fixtures/images/user/${index % 10}.jpg`,
									),
								},
							},
						},
					},
					jobs: {
						create: Array.from({
							length: faker.datatype.number({ min: 0, max: 10 }),
						}).map(() => ({
							title: faker.lorem.sentence(),
							content: faker.lorem.paragraphs(),
						})),
					},
				},
			})
			return user
		}),
	)
	console.timeEnd(`👤 Created ${totalUsers} users...`)

	console.time(
		`🐨 Created user "kody" with the password "kodylovesyou" and admin role`,
	)
	await prisma.user.create({
		data: {
			email: 'kody@kcd.dev',
			username: 'kody',
			name: 'Kody',
			roles: { connect: { id: adminRole.id } },
			image: {
				create: {
					contentType: 'image/png',
					file: {
						create: {
							blob: await fs.promises.readFile(
								'./tests/fixtures/images/user/kody.png',
							),
						},
					},
				},
			},
			password: {
				create: {
					hash: await getPasswordHash('kodylovesyou'),
				},
			},
			jobs: {
				create: [
					{
						title: 'Software Developer Engineer II, Amazon',
						content: `Software Development Engineer (SDE) experience is a unique one at Amazon. Teams are structured in small groups with a strong impetus to innovate, drive end to end ownership and meet critical business goals. Sr. SDEs get to rub shoulders with outstanding principal engineers and researchers with industry leading technical abilities, solving challenging engineering problems that affect millions of Amazon customers. Engineers also get to collaborate and work with teams across the globe, in the process being exposed to a range of technologies, best practices and solution patterns. Our brown bag sessions and Principal talks are among the most popular presentations with healthy debate and a cross pollination of ideas. All this contributes to the grooming of the ‘fungible’ Amazon engineer who has exemplary technical skills, sharp business acumen and a strong drive to get things done.

							The Amazon Subscribe and Save team has complete ownership of the software platform that powers the SnS program across all the locales in the world. Engineers in this team are engaged in solving hard engineering problems every day in order to offer the best subscribe and save experience to users. We are obsessed with delivering software that is highly optimized and meets very high quality and performance bars.
							
							
							As a Software Development Engineer, you will engage with an experienced cross-disciplinary staff to conceive, design and develop innovative consumer products. You must be responsive, flexible and able to succeed within an open collaborative peer environment.
							
							
							You will need to be able to work efficiently and effectively in a fun, fast-paced dynamic team environment. As a Software Development Engineer, you will develop, execute and maintain software products. You are expected to have industry-leading technical abilities.
							
							
							You should have a combination of solid in-depth knowledge, solid understanding of the operating system software, as well as knowledge of object oriented design principles. You should command the skill to communicate clearly and effectively. Candidates will need to define product requirements, design software, code software and develop tests
							
							
							BASIC QUALIFICATIONS
							3+ years of non-internship professional software development experience
							2+ years of non-internship design or architecture (design patterns, reliability and scaling) of new and existing systems experience
							Experience programming with at least one software programming language
							PREFERRED QUALIFICATIONS
							3+ years of full software development life cycle, including coding standards, code reviews, source control management, build processes, testing, and operations experience
							Bachelor's degree in computer science or equivalent
							
							
							Amazon is committed to a diverse and inclusive workplace. Amazon is an equal opportunity employer and does not discriminate on the basis of race, national origin, gender, gender identity, sexual orientation, protected veteran status, disability, age, or other legally protected status. For individuals with disabilities who would like to request an accommodation, please visit https://www.amazon.jobs/en/disability/us.
							
							
							Our compensation reflects the cost of labor across several US geographic markets. The base pay for this position ranges from $115,000/year in our lowest geographic market up to $223,600/year in our highest geographic market. Pay is based on a number of factors including market location and may vary depending on job-related knowledge, skills, and experience. Amazon is a total compensation company. Dependent on the position offered, equity, sign-on payments, and other forms of compensation may be provided as part of a total compensation package, in addition to a full range of medical, financial, and/or other benefits. For more information, please visit https://www.aboutamazon.com/workplace/employee-benefits. Applicants should apply via our internal or external career site.`,
					},
					{
						title: 'Software Engineer, Front End',
						content: `Meta Platforms, Inc. (Meta), formerly known as Facebook Inc., builds technologies that help people connect, find communities, and grow businesses. When Facebook launched in 2004, it changed the way people connect. Apps and services like Messenger, Instagram, WhatsApp, and Novi further empowered billions around the world. Now, Meta is moving beyond 2D screens toward immersive experiences like augmented and virtual reality to help build the next evolution in social technology. To apply, click “Apply to Job” online on this web page.`,
					},
					{
						title: 'Fullstack Software Engineer (L5) - Resilience Engineering',
						content: `It’s an amazing time to be joining Netflix as we continue to transform entertainment. We deliver billions of hours of movies and TV shows per month to more than 230 million members in over 190 countries. At Netflix, we want to entertain the world. To achieve this, we must be able to rapidly build and ship innovative experiences for our members and creators all around the globe.

							Who we are
							Resilience Engineering’s purpose is to help other teams at Netflix understand the outcome of a change before it reaches production, for example, a code change introduced to their application. Our platform and tools are leveraged by many of the most critical services at Netflix to confidently and safely deliver changes to those services to production.
							
							We enable teams to gain confidence in a change and understand whether that change is having the intended outcome and working as expected.  We also help them tell if that change is having unintended consequences that would negatively impact Netflix’s users (for example increasing error rates or latency).
							
							A major way we do so is by running a ‘canary’. A canary is an experiment where we compare operational metrics between two versions of a service to detect if a change would negatively impact customers. It can also help determine if a change had its intended effect. For example, if you expected a change to reduce latency, did it actually accomplish that?
							
							Our platform is also responsible for Chaos at Netflix. Chaos is leveraged by services to understand what happens in different failure scenarios. This enables services to answer questions like “what happens if latency or errors increase dramatically between a service and its dependency?”.
							
							You can learn a lot more about what we do from these presentations:
							- Evolution of Chaos
							- Infrastructure Experimentation
							- Sticky Canaries
							
							Where we work
							We are a distributed team. We have folks both near the office and who are remote. While some folks are near the office, we work as a remote team. We do get together in person about once a quarter.
							
							What you could work on
							A major focus of 2023 is to be able to confidently and safely deliver changes across the fleet of applications at Netflix.
							
							Some of the larger initiatives we will be focusing on are:
							- Building the system that validates changes across the Netflix fleet
							- Developing new approaches to more confidently assess whether a change causes negative impacts
							- Improving our existing validations so there are fewer false positives
							About you
							Full Stack – You would consider yourself a full stack developer and have several years experience both frontend and backend development with 4+ years of experience
							React – You are proficient in working with React
							Distributed Systems - You have experience working with high scale distributed systems and how to debug them/how they can fail
							You have worked on an internal infrastructure or platform team where other engineers at the company were your customers
							You enjoy collaborating with multiple teams and use your communication skills to influence product direction.
							You are curious and enjoy working on ambiguous problems where the solutions are not (yet) well defined
							Our culture is unique, and we tend to live by our values, allowing you to do your best work and grow. To learn more about Productivity Engineering, feel free to listen to this podcast.
							
							We are an equal-opportunity employer and celebrate diversity, recognizing that diversity of thought and background builds stronger teams. We approach diversity and inclusion seriously and thoughtfully. We do not discriminate based on race, religion, color, national origin, gender, sexual orientation, age, marital status, veteran status, or disability status.
							
							At Netflix, we carefully consider a wide range of compensation factors to determine your personal top of market. We rely on market indicators to determine compensation and consider your specific job family, background, skills, and experience to get it right. These considerations can cause your compensation to vary and will also be dependent on your location.
							
							The overall market range for roles in this area of Netflix is typically $100,000 - $700,000.
							
							This market range is based on total compensation (vs. only base salary), which is in line with our compensation philosophy. Netflix is a unique culture and environment. Learn more here.`,
					},
				],
			},
		},
	})
	console.timeEnd(
		`🐨 Created user "kody" with the password "kodylovesyou" and admin role`,
	)

	console.timeEnd(`🌱 Database has been seeded`)
}

seed()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

/*
eslint
	@typescript-eslint/no-unused-vars: "off",
*/
