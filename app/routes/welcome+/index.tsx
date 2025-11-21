import { Link } from '@remix-run/react';

export default function Welcome() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <img
          src="/background-pattern.svg"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Main Content */}
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          You're all set!
        </h1>

        <p className="text-xl text-gray-600 mb-12">
          You now have unlimited tailoring. Let's create your next resume.
        </p>

        {/* CTA Button */}
        <Link
          to="/tailor"
          className="inline-block bg-[#7957FE] text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-[#6847ED] transition-colors shadow-lg"
        >
          Create my next tailored resume
        </Link>

        {/* Pro Tip */}
        <div className="mt-12 bg-purple-100/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/50">
          <div className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-purple-500">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Pro tip:</p>
              <p className="text-gray-700">Most users tailor for 3-5 different companies to maximize their job search</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-sm text-gray-500 mt-8">
          Your 3-day free trial has started. Cancel anytime from your account settings.
        </p>
      </div>
    </div>
  );
}
