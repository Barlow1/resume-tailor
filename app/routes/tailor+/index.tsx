import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { parseResumeWithOpenAI } from '~/utils/openai-resume-parser.server.ts';
import { prisma } from '~/utils/db.server.ts';
import { getUserId } from '~/utils/auth.server.ts';
import { useState } from 'react';

export async function action({ request }: ActionFunctionArgs) {
  console.log('📤 UPLOAD: Action called');

  // Check auth when user submits the form (clicks Continue)
  const userId = await getUserId(request);

  if (!userId) {
    // Redirect to login with return URL
    return redirect(`/login?redirectTo=${encodeURIComponent('/tailor')}`);
  }

  console.log('📤 UPLOAD: User ID:', userId);

  const formData = await request.formData();
  const file = formData.get('resume') as File;

  if (!file) {
    console.error('❌ UPLOAD: No file provided');
    return json({ error: 'Please upload a resume file' }, { status: 400 });
  }

  console.log('📤 UPLOAD: File received:', file.name, 'Size:', file.size, 'bytes');

  try {
    const parsed = await parseResumeWithOpenAI(file);
    console.log('📤 UPLOAD: Parse complete for:', parsed.personal_info.full_name);

    const record = await prisma.tailoredResume.create({
      data: {
        userId: userId || undefined,
        originalResume: JSON.stringify(parsed),
        jobDescription: '',
        tailoredResume: '',
        promptVersion: 'v1'
      }
    });

    console.log('✅ UPLOAD: Saved to database with ID:', record.id);

    return redirect(`/tailor/input/${record.id}`);

  } catch (error) {
    console.error('❌ UPLOAD: Error:', error);
    return json({
      error: error instanceof Error ? error.message : 'Failed to parse resume'
    }, { status: 500 });
  }
}

export default function TailorUpload() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isUploading = navigation.state === 'submitting';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const input = document.getElementById('resume-upload') as HTMLInputElement;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(files[0]);
        input.files = dataTransfer.files;
        setSelectedFile(files[0]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background pattern overlay */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <img
          src="/banner-left.svg"
          alt=""
          className="absolute left-[79px] top-[325px] w-[230px] h-[187px]"
        />
        <img
          src="/banner-right.svg"
          alt=""
          className="absolute right-[59px] top-[213px] w-[336px] h-[169px]"
        />
      </div>

      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-primary mb-2">
            Upload your resume,{' '}
            <span className="text-brand-500">we'll show you what's missing.</span>
          </h1>
        </div>

        {/* Upload Box */}
        <div className="max-w-[612px] mx-auto">
          <Form method="post" encType="multipart/form-data">
            <div
              className={`border-2 border-dashed ${
                isDragging ? 'border-brand-500 bg-accent/50' : 'border-brand-500'
              } rounded-2xl bg-accent backdrop-blur-sm p-12 transition-all duration-200`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center">
                {/* Upload Icon */}
                <div className="mb-6 text-brand-500">
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="12" y="8" width="40" height="48" rx="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <path d="M20 16h24M20 24h24M20 32h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="44" cy="44" r="12" fill="currentColor"/>
                    <path d="M44 38v12M38 44h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>

                {/* Text */}
                <div className="text-center mb-6">
                  <p className="text-lg text-foreground">Drag file or click</p>
                  <div className="flex items-center gap-3 justify-center">
                    <div className="h-px w-12 bg-muted-foreground" />
                    <span className="text-sm text-muted-foreground">OR</span>
                    <div className="h-px w-12 bg-muted-foreground" />
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  type="file"
                  id="resume-upload"
                  name="resume"
                  accept=".pdf,.docx"
                  required
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Button */}
                {!selectedFile ? (
                  <label
                    htmlFor="resume-upload"
                    className="bg-brand-500 text-primary-foreground px-8 py-3 rounded-lg font-medium cursor-pointer hover:bg-brand-800 transition-colors"
                  >
                    Choose File
                  </label>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Selected: <span className="font-medium">{selectedFile.name}</span>
                    </p>
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="bg-brand-500 text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? 'Parsing resume...' : 'Continue'}
                    </button>
                  </div>
                )}

                {/* Error Message */}
                {actionData?.error && (
                  <div className="mt-6 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                    {actionData.error}
                  </div>
                )}
              </div>
            </div>
          </Form>
        </div>

        {/* Subheading */}
        <div className="text-center mt-6 mb-6">
          <p className="text-2xl font-semibold text-primary">
            Then fix it in one click. 30 seconds.
          </p>
        </div>

        {/* Bottom Section */}
        <div className="max-w-[1000px] mx-auto mt-12 mb-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-primary mb-4">
              Your resume isn't broken.{' '}
              <span className="text-brand-500">It just wasn't written for this job.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Generic resumes get auto-rejected. Tailored ones get interviews.
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Generic Resume Card */}
            <div className="bg-background rounded-2xl p-8 shadow-lg border-2 border-destructive/30 ring-1 ring-destructive/20 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-10 h-10 rounded-full bg-destructive flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 5L5 15M5 5l10 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>

              <div className="flex items-start gap-3 mb-6">
                <div className="w-12 h-12 flex-shrink-0 text-destructive">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="6" width="32" height="36" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <path d="M14 14h6M14 20h10M14 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="18" cy="33" r="2" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-1">Generic Resume</h3>
                  <p className="text-muted-foreground font-medium">John Developer</p>
                  <p className="text-sm text-muted-foreground">Software Engineer</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-foreground mb-2">Experience</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Built API product</li>
                  <li>• Worked on features</li>
                  <li>• Collaborated with team</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-destructive/20">
                <div className="flex items-center gap-2 text-destructive">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="text-sm font-medium">Auto Rejected</span>
                </div>
              </div>
            </div>

            {/* Tailored Resume Card */}
            <div className="bg-background rounded-2xl p-8 shadow-lg border-2 border-brand-500/30 ring-1 ring-brand-500/20 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 6L7 15l-4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              <div className="flex items-start gap-3 mb-6">
                <div className="w-12 h-12 flex-shrink-0 text-brand-500">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="6" width="32" height="36" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <path d="M14 14h6M14 20h10M14 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="18" cy="33" r="2" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground mb-1">Tailored Resume</h3>
                  <p className="text-muted-foreground font-medium">John Developer</p>
                  <p className="text-sm text-muted-foreground">Software Backend Engineer</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-foreground mb-2">Experience</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Built rest API serving 50k requests/day with 99.9% uptime</li>
                  <li>• Shipped 3 major features reducing latency by 40%</li>
                  <li>• Led 5-person team in agile environment</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-accent">
                <div className="flex items-center gap-2 text-brand-500">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-sm font-medium">Interview in 3 days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}