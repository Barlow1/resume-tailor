import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { prisma } from '~/utils/db.server.ts';
import { useState } from 'react';
import { getUserId, getStripeSubscription } from '~/utils/auth.server.ts';
import { SubscribeModal } from '~/components/subscribe-modal.tsx';
import type { OpenAIResumeData } from '~/utils/openai-resume-parser.server.ts';
import type { TailoredResume } from '~/utils/resume-tailor.server.ts';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    throw new Response('Not Found', { status: 404 });
  }

  const record = await prisma.tailoredResume.findUnique({
    where: { id }
  });

  if (!record) {
    throw new Response('Not Found', { status: 404 });
  }

  const originalResume = JSON.parse(record.originalResume) as OpenAIResumeData;
  const tailoredResume = JSON.parse(record.tailoredResume) as TailoredResume;

  // Extract job title from job description if available
  const jobTitle = extractJobTitle(record.jobDescription);

  // Get user subscription and progress data
  const userId = await getUserId(request);
  const [subscription, gettingStartedProgress] = userId
    ? await Promise.all([
        getStripeSubscription(userId),
        prisma.gettingStartedProgress.findUnique({
          where: { ownerId: userId },
        }),
      ])
    : [null, null];

  return json({
    id: record.id,
    originalResume,
    tailoredResume,
    jobTitle,
    jobDescription: record.jobDescription,
    subscription,
    gettingStartedProgress,
  });
}

// Helper to extract job title from description
function extractJobTitle(jobDescription: string): string {
  const lines = jobDescription.split('\n').filter(line => line.trim());
  return lines[0] || 'this position';
}

export default function TailorResults() {
  const { id, originalResume, tailoredResume } = useLoaderData<typeof loader>();
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const handleDownloadClick = async (e: React.MouseEvent<HTMLButtonElement>, format: 'pdf' | 'docx') => {
    e.preventDefault();

    try {
      const endpoint = format === 'pdf' ? '/resources/download-pdf' : '/resources/download-docx';
      const response = await fetch(`${endpoint}?id=${id}`);

      if (response.status === 403) {
        // Hit download limit - show subscribe modal
        setShowSubscribeModal(true);
        return;
      }

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Download successful - trigger file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'pdf' ? `Resume.pdf` : `Resume.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(`Failed to download ${format.toUpperCase()}. Please try again.`);
    }
  };

  // Get preview data (first 10 lines worth of content)
  const resumePreview = getResumePreview(originalResume);
  const fullResume = getFullResumeText(originalResume);

  const analysisPreview = getAnalysisPreview(tailoredResume);
  const fullAnalysis = getFullAnalysis(tailoredResume);

  return (
    <div className="min-h-screen relative">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <img
          src="/background-pattern.svg"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-8 pt-[80px] pb-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-white">
            Here is your tailored resume
          </h1>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Left Column - Resume Preview */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            <div className="mb-4 pb-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-black mb-2">
                {originalResume.personal_info?.full_name || 'Your Resume'}
              </h2>
              <p className="text-gray-600 text-sm">
                {originalResume.personal_info?.email || ''}
              </p>
              <p className="text-gray-600 text-sm">
                {originalResume.personal_info?.location || ''}
              </p>
            </div>

            <div className="pt-2">
              <h3 className="font-semibold text-black mb-4 text-base">Experience</h3>
              <div className="text-sm text-gray-700 leading-relaxed">
                {showFullAnalysis ? (
                  <div className="whitespace-pre-line">{fullResume}</div>
                ) : (
                  <div className="whitespace-pre-line">{resumePreview}</div>
                )}
              </div>
            </div>

            {!showFullAnalysis && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowFullAnalysis(true)}
                  className="text-[#7957FE] hover:text-[#6847ED] font-medium text-sm"
                >
                  View full resume →
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Enhanced Bullets */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-black mb-6">
              Enhanced Bullets
            </h2>

            {showFullAnalysis ? (
              <div className="space-y-4">
                {fullAnalysis}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {analysisPreview}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowFullAnalysis(true)}
                    className="w-full bg-[#7957FE] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#6847ED] transition-colors"
                  >
                    View detailed analysis
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Additional Sections Below - Only show when expanded */}
        {showFullAnalysis && (
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Suggested Bullets Section */}
            {getSuggestedBullets(tailoredResume)}

            {/* Gap Analysis Section */}
            {getGapAnalysis(tailoredResume)}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <button
              onClick={(e) => handleDownloadClick(e, 'pdf')}
              className="bg-[#7957FE] text-white px-12 py-4 rounded-lg font-medium text-lg hover:bg-[#6847ED] transition-colors"
            >
              Download PDF
            </button>
            <button
              onClick={(e) => handleDownloadClick(e, 'docx')}
              className="bg-white text-[#7957FE] border-2 border-[#7957FE] px-12 py-4 rounded-lg font-medium text-lg hover:bg-[#F3F3F8] transition-colors"
            >
              Download DOCX
            </button>
          </div>

          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Your tailored resume is ready to send
          </p>

          <Link
            to="/tailor"
            className="bg-white text-[#7957FE] border-2 border-[#7957FE] px-12 py-4 rounded-lg font-medium text-lg hover:bg-[#F3F3F8] transition-colors mt-4"
          >
            Create another tailored resume
          </Link>
        </div>
      </main>

      {/* Subscribe Modal */}
      <SubscribeModal
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        successUrl="/welcome"
        cancelUrl={`/tailor/results/${id}`}
      />
    </div>
  );
}

// Helper functions to extract preview and full content
function getResumePreview(resume: any): string {
  const lines: string[] = [];

  // Try to get experiences from either the tailored resume or original structure
  const experiences = resume.experiences || resume.experience || [];

  if (experiences.length > 0) {
    const firstJob = experiences[0];
    lines.push(`${firstJob.title}, ${firstJob.company}`);
    lines.push(`${firstJob.date_start || ''} - ${firstJob.date_end || 'Present'}`);
    lines.push('');

    const bullets = firstJob.bullet_points || firstJob.accomplishments || firstJob.bullets || [];
    bullets.slice(0, 3).forEach((bullet: string) => {
      lines.push(`• ${bullet}`);
    });

    if (experiences.length > 1) {
      const secondJob = experiences[1];
      lines.push('');
      lines.push(`${secondJob.title}, ${secondJob.company}`);
      lines.push(`${secondJob.date_start || ''} - ${secondJob.date_end || 'Present'}`);
      lines.push('');

      const secondBullets = secondJob.bullet_points || secondJob.accomplishments || secondJob.bullets || [];
      secondBullets.slice(0, 2).forEach((bullet: string) => {
        lines.push(`• ${bullet}`);
      });
    }
  }

  return lines.join('\n');
}

function getFullResumeText(resume: any): string {
  const lines: string[] = [];

  const experiences = resume.experiences || resume.experience || [];

  if (experiences.length > 0) {
    experiences.forEach((job: any, index: number) => {
      if (index > 0) lines.push('');
      lines.push(`${job.title}, ${job.company}`);
      lines.push(`${job.date_start || ''} - ${job.date_end || 'Present'}`);
      lines.push('');

      const bullets = job.bullet_points || job.accomplishments || job.bullets || [];
      bullets.forEach((bullet: string) => {
        lines.push(`• ${bullet}`);
      });
    });
  }

  return lines.join('\n');
}

function getAnalysisPreview(resume: any): JSX.Element {
  // Show first 3 enhanced bullets
  const enhanced = resume.enhanced_bullets || [];

  return (
    <>
      {enhanced.slice(0, 3).map((item: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-lg p-4">
          <div className="mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Original:</span>
            <p className="text-sm text-gray-600 line-through mt-1">{item.original}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Enhanced:</span>
            <p className="text-sm text-gray-900 mt-1">{item.enhanced}</p>
          </div>
        </div>
      ))}
      {enhanced.length > 3 && (
        <p className="text-sm text-gray-500 text-center mt-4">
          +{enhanced.length - 3} more enhanced bullets
        </p>
      )}
    </>
  );
}

function getFullAnalysis(resume: any): JSX.Element {
  // Show all enhanced bullets
  const enhanced = resume.enhanced_bullets || [];

  return (
    <>
      {enhanced.map((item: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-lg p-4">
          <div className="mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Original:</span>
            <p className="text-sm text-gray-600 line-through mt-1">{item.original}</p>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Enhanced:</span>
            <p className="text-sm text-gray-900 mt-1">{item.enhanced}</p>
          </div>
        </div>
      ))}
    </>
  );
}

function getSuggestedBullets(resume: any): JSX.Element | null {
  const suggestions = resume.suggested_bullets || [];

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-black text-lg mb-3">Suggested Additional Bullets ({suggestions.length})</h3>
        <p className="text-sm text-gray-600 mb-4">These are AI-generated suggestions. Please verify and customize before using.</p>
        <div className="space-y-3">
          {suggestions.map((item: any, i: number) => (
            <div key={i} className="bg-white rounded p-3">
              <p className="text-sm text-gray-900 mb-2">• {item.bullet}</p>
              {item.evidence && (
                <details className="text-xs text-gray-600">
                  <summary className="cursor-pointer text-blue-600">Why we think this fits</summary>
                  <p className="mt-2">{item.evidence}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGapAnalysis(resume: any): JSX.Element | null {
  const gaps = resume.gaps || [];

  if (gaps.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h3 className="font-semibold text-black text-lg">Gap Analysis</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">Things to address in your application or cover letter:</p>
        <div className="space-y-3">
          {gaps.map((gap: any, i: number) => (
            <div key={i} className="bg-white rounded p-3">
              <p className="text-sm font-medium text-gray-900 mb-1">Missing: {gap.missing}</p>
              <p className="text-xs text-gray-600">Required by JD: "{gap.required_by_jd}"</p>
              {gap.suggestion && (
                <details className="text-xs text-gray-600 mt-2">
                  <summary className="cursor-pointer text-blue-600">Details & suggestions</summary>
                  <p className="mt-2">{gap.suggestion}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
