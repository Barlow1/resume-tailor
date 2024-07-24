import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { create } from 'zustand';

interface AccordionState {
  tab: number;
  setTab: (tab: number) => void;
}

const useAccordionStore = create<AccordionState>((set) => ({
  tab: 0,
  setTab: (tab: number) => set({ tab }),
}));

interface FAQData {
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const { tab, setTab } = useAccordionStore();

  const [faqData, setFaqData] = useState<FAQData[]>([]);
  const [refs, setRefs] = useState<React.RefObject<HTMLDivElement>[]>([]);
  const [maxHeights, setMaxHeights] = useState<string[]>(
    Array(faqData.length).fill('0px')
  );

  const fetchFAQData = async () => {
    try {
      const response = await axios.get('/faq/faqs.json');
      setFaqData(response.data);
    } catch (error) {
      console.error('Failed to fetch FAQ data:', error);
    }
  };

  useEffect(() => {
    fetchFAQData();
  }, []);

  useEffect(() => {
    setRefs((refs) =>
      Array(faqData.length)
        .fill(null)
        .map((_, i) => refs[i] || React.createRef())
    );
  }, [faqData.length]);

  const updateMaxHeights = () => {
    const newMaxHeights = refs.map((ref) =>
      ref.current ? `${ref.current.scrollHeight + 20}px` : '0px'
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
  }, [refs, tab, faqData]);

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
                      idx + 1
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
                  idx + 1
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
