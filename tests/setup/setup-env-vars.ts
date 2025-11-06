import {
	DATABASE_PATH,
	DATABASE_URL,
	CACHE_DATABASE_PATH,
} from './paths.ts'

process.env.DATABASE_PATH = DATABASE_PATH
process.env.DATABASE_URL = DATABASE_URL
process.env.CACHE_DATABASE_PATH = CACHE_DATABASE_PATH

// Required environment variables for app startup validation
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long'
process.env.INTERNAL_COMMAND_TOKEN = 'test-internal-command-token'
process.env.RECAPTCHA_SITE_KEY = 'test-recaptcha-site-key'
process.env.RECAPTCHA_SECRET_KEY = 'test-recaptcha-secret-key'
