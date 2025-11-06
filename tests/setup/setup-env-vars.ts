import { DATABASE_PATH, DATABASE_URL } from './paths.ts'

process.env.DATABASE_PATH = DATABASE_PATH
process.env.DATABASE_URL = DATABASE_URL

// Required environment variables for app startup validation
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long'
process.env.INTERNAL_COMMAND_TOKEN = 'test-internal-command-token'
process.env.CACHE_DATABASE_PATH = './other/cache.db'
process.env.RECAPTCHA_SITE_KEY = 'test-recaptcha-site-key'
process.env.RECAPTCHA_SECRET_KEY = 'test-recaptcha-secret-key'
