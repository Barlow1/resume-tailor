import { createCookie } from "@remix-run/node";

export const resumeCookie = createCookie('resume-data', {
    maxAge: 604_800, // one week
  })
  