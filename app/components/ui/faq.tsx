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
    { question: 'Lorem ipsum dolor sit amet?', answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    { question: 'Sed do eiusmod tempor?', answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    { question: 'Ut labore et dolore magna aliqua?', answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
    { question: 'Ut enim ad minim veniam?', answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  ];

  const [refs, setRefs] = useState<React.RefObject<HTMLDivElement>[]>([]);
  const [maxHeights, setMaxHeights] = useState<string[]>(Array(faqData.length).fill('0px'));

  useEffect(() => {
    setRefs((refs) => 
      Array(faqData.length).fill(null).map((_, i) => refs[i] || React.createRef())
    );
  }, [faqData.length]);

  useEffect(() => {
    const newMaxHeights = refs.map(ref => ref.current ? `${ref.current.scrollHeight}px` : '0px');
    setMaxHeights(newMaxHeights);
  }, [refs]);

  const handleClick = (idx: number) => {
    setTab(tab === idx ? 0 : idx);
  };

  const handleRotate = (idx: number) => {
    return tab === idx ? '-rotate-180' : '';
  };

  const handleToggle = (idx: number) => {
    return tab === idx ? maxHeights[idx] : '0px';
  };

  return (
    <div className="h-full max-w-5xl px-2 py-3 mx-auto mt-32 tracking-wide md:px-4 md:mt-44">
      <div className="flex justify-center text-3xl text-black dark:text-primary">Frequently Asked Questions</div>
      <div className="grid gap-3 py-8 text-lg leading-6 text-black dark:text-primary md:gap-8 md:grid-cols-2">
        {faqData.map((faq, idx) => (
          <div key={idx} className="space-y-3">
            <div className={`relative transition-all duration-700 border rounded-xl hover:shadow-2xl`}>
              <div
                onClick={() => handleClick(idx + 1)}
                className="w-full p-4 text-left cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="tracking-wide">{faq.question}</span>
                  <span className={`transition-transform duration-500 transform fill-current ${handleRotate(idx + 1)}`}>
                    <svg className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div
                ref={refs[idx]}
                style={{
                  transition: 'all 0.7s',
                  maxHeight: handleToggle(idx + 1),
                }}
                className="relative overflow-hidden transition-all duration-700"
              >
                <div className="px-6 pb-4 text-gray-600">
                  {faq.answer}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export { FAQ };
