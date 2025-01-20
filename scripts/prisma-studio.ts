import { config } from 'dotenv'
import { execa } from 'execa'
import express from 'express'
import basicAuth from 'express-basic-auth'
import { createProxyMiddleware } from 'http-proxy-middleware'
import getPort from 'get-port'
import { ensurePrimary } from '~/utils/litefs.server.ts'
import rateLimit from 'express-rate-limit'

async function main() {
	// Load environment variables
	config()

	// Ensure we're on primary if using LiteFS
	await ensurePrimary()

	// Get random port for Prisma Studio
	const studioPort = await getPort()

	// Start Prisma Studio on random port
	const studio = execa('prisma', ['studio', '--port', studioPort.toString()], {
		stdio: 'inherit',
		env: {
			...process.env,
		},
	})

	// Create Express server with auth
	const app = express()

	// Add rate limiting
	app.use(
		rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // limit each IP to 100 requests per windowMs
		}),
	)

	// Add basic auth
	app.use(
		basicAuth({
			users: {
				[process.env.STUDIO_USERNAME!]: process.env.STUDIO_PASSWORD!,
			},
			challenge: true,
		}),
	)

	// Proxy requests to Prisma Studio
	app.use(
		'/',
		createProxyMiddleware({
			target: `http://localhost:${studioPort}`,
			ws: true,
			changeOrigin: true,
			onProxyReq: (proxyReq, req, res) => {
				if (req.url === '/logout') {
					res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
					res.set('Authorization', '')
					return res.sendStatus(401)
				}
			},
		}),
	)

	// Start auth server on port 5555 (default Prisma Studio port)
	const server = app.listen(5555, () => {
		console.log('🔒 Protected Prisma Studio running on http://localhost:5555')
	})

	// Handle shutdown
	process.on('SIGTERM', () => {
		server.close()
		studio.kill()
	})
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
