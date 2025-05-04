import React from 'react'

import ats from "../../thirdcomponent/assets/ats.svg";
import ai from "../../thirdcomponent/assets/ai.svg";
import makeover from "../../thirdcomponent/assets/makeover.svg";

function Section5() {
  return (
    <div className="w-full flex flex-col gap-2 justify-center bg-[#F5F7FC] py-16 px-4">
      <h2 className="text-center font-semibold font-poppins text-black text-[45px] mb-10">
        Here What You Get
      </h2>

      <div className="flex flex-wrap justify-center gap-x-12 gap-y-10 max-w-[1441px] mx-auto">
        {/* Block 1 */}
        <div className="flex flex-col gap-4 w-[303px] items-center">
          <img src={ats} alt="ATS Icon" className="w-[89px] h-[89px] bg-white" />
          <p className="font-inter font-bold text-[27.9px] text-black text-center">
            ATS- Formatting
          </p>
          <p className="font-inter text-center leading-[28px] text-black text-[20px] opacity-45">
            Proven layouts that algorithms read perfectly
          </p>
        </div>

        {/* Block 2 */}
        <div className="flex flex-col gap-4 w-[303px] items-center">
          <img src={ai} alt="AI Icon" className="w-[89px] h-[89px] bg-white" />
          <p className="font-inter font-bold text-[27.9px] text-black text-center">
            AI Keyword Injection
          </p>
          <p className="font-inter text-center leading-[28px] text-black text-[20px] opacity-45">
            Auto-matches skills to job descriptions
          </p>
        </div>

        {/* Block 3 */}
        <div className="flex flex-col gap-4 w-[303px] items-center">
          <img src={makeover} alt="Makeover Icon" className="w-[89px] h-[89px] bg-white" />
          <p className="font-inter font-bold text-[27.9px] text-black text-center">
            60-Second
          </p>
          <p className="font-inter text-center leading-[28px] text-black text-[20px] opacity-45">
            Update old resumes for new roles instantly
          </p>
        </div>
      </div>
    </div>
  );
}

export default Section5;
