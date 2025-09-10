import * as React from "react";

type FaqItem = { question: string; answer: string };

export const FAQ: React.FC = () => {
  // ---- SEO: include analyzer/outreach + ATS keywords, fix brand naming ----
  const faqData: FaqItem[] = [
    {
      question: "What is an AI resume analyzer and how does it help with ATS?",
      answer:
        "Resume Tailor’s AI resume analyzer scans your resume against the job description, highlights matched and missing keywords, surfaces responsibility alignment, and flags ATS formatting issues so you pass initial screening."
    },
    {
      question: "What does the match score mean?",
      answer:
        "The 0–100 match score reflects responsibilities coverage, skill coverage, and impact signals. Use it to benchmark improvements as you tailor your resume for each role."
    },
    {
      question: "Can you generate recruiter emails and LinkedIn outreach?",
      answer:
        "Yes. Our AI creates personalized recruiter emails, hiring-manager cold emails, and LinkedIn messages that reference the job description and your achievements, plus 1–2 polite follow-ups."
    },
    {
      question: "Do you send messages automatically?",
      answer:
        "No. We generate outreach copy you can send from your email or LinkedIn account. You keep full control of deliverability and timing."
    },
    {
      question: "How do I tailor my resume with Resume Tailor?",
      answer:
        "Upload your resume and paste a job description. The analyzer shows matched vs. missing skills, responsibilities alignment, and suggested metrics. Apply the updates in one click inside the builder."
    },
    {
      question: "Who should tailor their resume?",
      answer:
        "Anyone applying to competitive roles. Tailoring improves relevance, ATS keyword coverage, and recruiter engagement for both technical and non-technical jobs."
    },
    {
      question: "How is Resume Tailor different from keyword-only tools?",
      answer:
        "Beyond keywords, we score responsibilities alignment, extract measurable outcomes, and surface evidence from your experience—resulting in stronger, interview-worthy resumes."
    },
    {
      question: "How much does it cost?",
      answer:
        "You can start free. Pro plans unlock unlimited tailoring and advanced outreach templates. See current pricing on the Pricing page."
    }
  ];

  // ---- Accessibility & behavior: local state, single-open accordion ----
  const [openTab, setOpenTab] = React.useState<number | null>(null);
  const refs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [maxHeights, setMaxHeights] = React.useState<string[]>(
    Array(faqData.length).fill("0px")
  );

  React.useEffect(() => {
    const calc = () =>
      setMaxHeights(
        refs.current.map((el) => (el ? `${el.scrollHeight + 20}px` : "0px"))
      );
    calc();
    const id = setTimeout(calc, 100);
    window.addEventListener("resize", calc);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", calc);
    };
  }, [faqData.length]);

  const handleClick = (idx: number) => {
    setOpenTab((prev) => (prev === idx ? null : idx));
  };

  // ---- JSON-LD: keep in sync with visible FAQ for rich results ----
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };

  return (
    <div className="mx-auto mt-32 h-full max-w-5xl px-2 py-3 tracking-wide md:mt-44 md:px-4">
      <h2 className="flex justify-center text-3xl font-bold text-black dark:text-primary">
        Frequently Asked Questions
      </h2>

      {/* JSON-LD script for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="grid gap-3 py-8 text-lg leading-6 text-black dark:text-primary md:grid-cols-2 md:gap-8">
        {faqData.map((faq, i) => {
          const isOpen = openTab === i;
          const panelId = `faq-panel-${i}`;
          const buttonId = `faq-button-${i}`;
          return (
            <div key={i} className="space-y-3">
              <div className="relative rounded-xl border transition-all duration-700 hover:shadow-2xl">
                <button
                  id={buttonId}
                  aria-controls={panelId}
                  aria-expanded={isOpen}
                  onClick={() => handleClick(i)}
                  className="w-full cursor-pointer p-4 text-left focus:outline-none focus-visible:ring focus-visible:ring-brand-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="tracking-wide">{faq.question}</span>
                    <span
                      className={`transform transition-transform duration-500 ${
                        isOpen ? "-rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <svg
                        className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </span>
                  </div>
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  ref={(el) => (refs.current[i] = el)}
                  style={{
                    transition: "all 0.7s",
                    maxHeight: isOpen ? maxHeights[i] : "0px"
                  }}
                  className={`relative overflow-hidden transition-all duration-800 ${
                    isOpen ? "pb-2" : ""
                  }`}
                >
                  <div className="px-6 pb-4 text-gray-600">{faq.answer}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
