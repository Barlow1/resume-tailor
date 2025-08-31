import { jobDescriptionSchema, resumeAnalysisSchema, jobFitSchema,
    getJobFit, 
    getAnalyzedResume, 
    getParsedJobDescription,
    getRecruiterMessage, 
    recruiterOutreachSchema} from "./openai.server.ts"
import { z } from 'zod'
import { type ResumeData } from "./builder-resume.server.ts"
import { type User } from '@prisma/client'

export type JD = z.infer<typeof jobDescriptionSchema>
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>
export type JobFit = z.infer<typeof jobFitSchema>
export type recruiterOutreach = z.infer<typeof recruiterOutreachSchema>

export function safeParse<T>(resp: any, schema: z.ZodType<T>): T | null {
  const msg = resp?.choices?.[0]?.message
  if (!msg) return null

  // Preferred: parsed payload provided by the SDK helper
  if (msg.parsed) {
    const r = schema.safeParse(msg.parsed)
    return r.success ? r.data : null
  }

  // Fallback: try to parse raw content
  if (typeof msg.content === 'string' && msg.content.trim()) {
    try {
      const obj = JSON.parse(msg.content)
      const r = schema.safeParse(obj)
      return r.success ? r.data : null
    } catch {
      return null
    }
  }
  return null
}

export async function analyzePostingAndResume({
  jobTitle,
  jobDescription,
  resume,
  user,
}: {
  jobTitle: string;
  jobDescription: string;
  resume: string | ResumeData; // accept either raw text or builder object
  user: Partial<User>;
}): Promise<{
  parsedJD: JD | null;
  structuredResume: ResumeAnalysis | null; // useful for UI (skills/score), not passed into fit
  jobFit: JobFit | null;
}> {
    try {
        const { response: jdResponse } = await getParsedJobDescription({
            jobTitle,
            jobDescription,
            user,
        })
        const parsedJD = safeParse<JD>(jdResponse, jobDescriptionSchema)
        
        const jdForFit: string = parsedJD
        ? JSON.stringify(parsedJD)
        : jobDescription

        let structuredResume: ResumeAnalysis | null = null
        if (typeof resume === 'string') {
            const { response: raResp } = await getAnalyzedResume({
                resume,
                user
            })
            structuredResume = safeParse<ResumeAnalysis>(raResp, resumeAnalysisSchema)
        }

        const { response: fitResp } = await getJobFit({
            jobTitle,
            jobDescription: jdForFit,
            resume,
            user,
        })
        const jobFit = safeParse<JobFit>(fitResp, jobFitSchema)

        return {
            parsedJD,
            structuredResume,
            jobFit
        }
    } catch (error) {
        console.error('Error in analyzePostingAndResume', error)

        return {
            parsedJD: null,
            structuredResume: null,
            jobFit: null
        }
    }
}

export async function writeRecruiterMessage({
  jobTitle,
  jobDescription,
  resume,
  recruiterName,
  user
}: {
  jobTitle: string
  jobDescription: string
  resume: string | ResumeData
  recruiterName: string
  user: Partial<User>
}): Promise <{
  jobFit: JobFit | null
  outreach: recruiterOutreach | null
}> {
  try {
    const { response: fitResp } = await getJobFit({
      jobTitle,
      jobDescription,
      resume,
      user,
    })
    const jobFit = safeParse<JobFit>(fitResp, jobFitSchema)
    if (!jobFit) {
      return {jobFit: null, outreach: null}
    }

    const fit = jobFit.skills?.matched ?? [];
    const wins = jobFit.metrics ?? []

    const {response: recResp } = await getRecruiterMessage({
      jobTitle,
      jobDescription,
      fit,
      wins,
      recruiterName,
      user,
    })
    const outreach = safeParse<recruiterOutreach>(recResp, recruiterOutreachSchema)

    return {
      jobFit,
      outreach: outreach ?? null,
    }
  } catch (error) {
    console.error("Error in writeRecruiterMessage", error)
    return { jobFit: null, outreach: null}
  }
}