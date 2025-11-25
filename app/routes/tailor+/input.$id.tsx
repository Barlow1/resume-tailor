import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData, useNavigation, useActionData } from '@remix-run/react';
import { prisma } from '~/utils/db.server.ts';
import { tailorResume } from '~/utils/resume-tailor.server.ts';
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server.ts';

export async function loader({ params }: LoaderFunctionArgs) {
  console.log('📝 INPUT: Loading resume', params.id);

  const record = await prisma.tailoredResume.findUnique({
    where: { id: params.id }
  });

  if (!record) {
    throw new Response('Not found', { status: 404 });
  }

  const originalResume = JSON.parse(record.originalResume) as OpenAIResumeData;

  console.log('📝 INPUT: Resume loaded for:', originalResume.personal_info.full_name);

  // Count experiences and skills
  const experienceCount = originalResume.experiences?.length || 0;
  const skillCount = originalResume.skills?.length || 0;

  return json({
    id: record.id,
    resumeName: originalResume.personal_info.full_name,
    experienceCount,
    skillCount
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  console.log('📝 INPUT: Action called for', params.id);

  const formData = await request.formData();
  const jobDescription = formData.get('jobDescription') as string;
  const additionalContext = formData.get('additionalContext') as string;

  console.log('📝 INPUT: JD length:', jobDescription?.length || 0);
  console.log('📝 INPUT: Additional context:', additionalContext ? 'Yes' : 'No');

  if (!jobDescription || jobDescription.length < 50) {
    return json({
      error: 'Please paste a job description (at least 50 characters)'
    }, { status: 400 });
  }

  const record = await prisma.tailoredResume.findUnique({
    where: { id: params.id }
  });

  if (!record) {
    throw new Response('Not found', { status: 404 });
  }

  const originalResume = JSON.parse(record.originalResume) as OpenAIResumeData;

  console.log('📝 INPUT: Starting tailor process...');

  try {
    const tailored = await tailorResume({
      resume: originalResume,
      jobDescription,
      additionalContext: additionalContext || undefined
    });

    console.log('✅ INPUT: Tailor complete');

    await prisma.tailoredResume.update({
      where: { id: params.id },
      data: {
        jobDescription,
        tailoredResume: JSON.stringify(tailored)
      }
    });

    console.log('✅ INPUT: Saved to database, redirecting to results');

    return redirect(`/tailor/results/${params.id}`);

  } catch (error) {
    console.error('❌ INPUT: Error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to tailor resume'
    }, { status: 500 });
  }
}

export default function TailorInput() {
  const { experienceCount, skillCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isTailoring = navigation.state === 'submitting';

  return (
    <div className="min-h-screen relative">
      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-8 pt-[80px] pb-16 relative z-10">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-4">
            We found {experienceCount} experiences and {skillCount} skills
            <br />
            in your resume
          </h1>
          <p className="text-xl text-muted-foreground mt-6">
            What job are you targeting?
          </p>
        </div>

        {/* Form */}
        <Form method="post" className="mb-8">
          <div className="bg-accent rounded-2xl p-8 shadow-sm border-2 border-border mb-6">
            <label htmlFor="jobDescription" className="block mb-4">
              <span className="text-lg font-medium text-foreground">
                Paste the full job description here...
              </span>
            </label>
            <textarea
              id="jobDescription"
              name="jobDescription"
              rows={12}
              required
              placeholder="Example:&#10;Senior Product Manager – Stripe&#10;We're looking for a PM to lead our payments infrastructure...&#10;• 5+ years PM experience&#10;• Technical background with APIs&#10;• Experience with fintech preferred"
              className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none text-foreground placeholder-muted-foreground font-mono text-sm bg-card"
            />

            {/* Optional additional context - kept but styled cleaner */}
            <details className="mt-4">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium mb-3">
                + Add additional context (optional)
              </summary>
              <textarea
                name="additionalContext"
                rows={5}
                placeholder="Any additional information that would help tailor your resume..."
                className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none text-foreground placeholder-muted-foreground text-sm bg-card"
              />
            </details>
          </div>

          {actionData?.error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
              {actionData.error}
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isTailoring}
              className="bg-brand-500 text-primary-foreground px-12 py-4 rounded-lg font-medium text-lg hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTailoring ? 'Tailoring resume (20-30 seconds)...' : 'Tailor my resume'}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}
