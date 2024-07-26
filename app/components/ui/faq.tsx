import React, { useEffect, useState } from 'react';
import { create } from 'zustand';

interface AccordionState {
  tab: number;
  setTab: (tab: number) => void;
}

const useAccordionStore = create<AccordionState>((set) => ({
  tab: 0,
  setTab: (tab: number) => set({ tab }),
}));

const FAQ: React.FC = () => {
  const { tab, setTab } = useAccordionStore();

  const faqData = [
    {
      question: 'How do I tailor my resume?',
      answer:
        "Use Horizon's Resume Tailor to customize your resume effortlessly. Simply upload the job posting, and our AI will optimize your resume with relevant skills, responsibilities, job titles, and qualifications."
    },
    {
      question: 'Who should tailor their resume?',
      answer:
        "Anyone looking for a new job or career change should tailor their resume to match the specific job they're applying for.",
    },
    {
      question: "What's the best resume tailoring tool?",
      answer:
        "Resume Tailor is the leading resume tailoring tool. It provides detailed feedback to help you perfectly align your resume with the job you're targeting, focusing on keywords, responsibilities, and qualifications.",
    },
    {
      question: 'How is Resume Tailor different from other resume tailoring tools?',
      answer:
        'Unlike other tools that only match keywords, Resume Tailor uses both semantic and keyword matching. This ensures your resume passes ATS and human screenings, increasing your chances of getting an interview.',
    },
    {
      question: 'How much does it cost to tailor my resume?',
      answer:
        "Horizon's Resume Tailor allows you to tailor 2 resumes with AI support. For unlimited resume tailoring and additional features, you can upgrade to Resume Tailor Pro for $2.99/month.",
    },
    {
      question: 'Why should I tailor my resume for every job I apply to?',
      answer:
        'Tailoring your resume for each job application increases your chances of getting noticed by recruiters. It shows the alignment between your experience and the role, helping you pass ATS scans and demonstrating your commitment to the job.',
    },
  ];

  const [refs, setRefs] = useState<React.RefObject<HTMLDivElement>[]>([]);
  const [maxHeights, setMaxHeights] = useState<string[]>(
    Array(faqData.length).fill('0px'),
  );

  useEffect(() => {
    setRefs((refs) =>
      Array(faqData.length)
        .fill(null)
        .map((_, i) => refs[i] || React.createRef()),
    );
  }, [faqData.length]);

  const updateMaxHeights = () => {
    const newMaxHeights = refs.map((ref) =>
      ref.current ? `${ref.current.scrollHeight + 20}px` : '0px',
    );
    setMaxHeights(newMaxHeights);
  };

  useEffect(() => {
    updateMaxHeights();

    setTimeout(updateMaxHeights, 100);

    window.addEventListener('resize', updateMaxHeights);
    return () => {
      window.removeEventListener('resize', updateMaxHeights);
    };
  }, [refs, tab]);

  const handleClick = (idx: number) => {
    setTab(tab === idx ? 0 : idx);
  };

  const handleRotate = (idx: number) => {
    return tab === idx ? '-rotate-180' : '';
  };

  const handleToggleClass = (idx: number) => {
    return tab === idx ? 'pb-2' : '';
  };

  const handleToggleHeight = (idx: number) => {
    return tab === idx ? maxHeights[idx] : '0px';
  };

  return (
    <div className="mx-auto mt-32 h-full max-w-5xl px-2 py-3 tracking-wide md:mt-44 md:px-4">
      <div className="flex justify-center text-3xl text-black dark:text-primary">
        Frequently Asked Questions
      </div>
      <div className="grid gap-3 py-8 text-lg leading-6 text-black dark:text-primary md:grid-cols-2 md:gap-8">
        {faqData.map((faq, idx) => (
          <div key={idx} className="space-y-3">
            <div
              className={`relative rounded-xl border transition-all duration-700 hover:shadow-2xl`}
            >
              <div
                onClick={() => handleClick(idx + 1)}
                className="w-full cursor-pointer p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="tracking-wide">{faq.question}</span>
                  <span
                    className={`transform fill-current transition-transform duration-500 ${handleRotate(
                      idx + 1,
                    )}`}
                  >
                    <svg
                      className="h-5 w-5 fill-current"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div
                ref={refs[idx]}
                style={{
                  transition: 'all 0.7s',
                  maxHeight: handleToggleHeight(idx + 1),
                }}
                className={`relative overflow-hidden transition-all duration-800 ${handleToggleClass(
                  idx + 1,
                )}`}
              >
                <div className="px-6 pb-4 text-gray-600">{faq.answer}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { FAQ };
