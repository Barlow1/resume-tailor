import { createCookie } from "@remix-run/node";

export const resumeCookie = createCookie('resume-data', {
    maxAge: 604_800, // one week
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || 'resume-tailor-cookie-secret'],
  })
  