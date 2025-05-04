import React from "react";

import frame from "../../thirdcomponent/assets/Frame.png";
import frame2 from "../../thirdcomponent/assets/Frame2.png";
import frame3 from "../../thirdcomponent/assets/Frame3.png";
import arc2 from "../../thirdcomponent/assets/Arc 2.png";
import arc3 from "../../thirdcomponent/assets/Arc 3.png";
// import copy from "../../thirdcomponent/assets/Frame copy.png";
import arrow from "../../thirdcomponent/assets/arw.svg";
import { Link } from "@remix-run/react";

function Section4() {
  return (
    <div className="h-auto font-poppins w-full bg-white text-black pt-10 pb-10  font-poppins text-[45px] px-4 sm:px-8 md:px-16">
      <h2 className="font-poppins font-semibold leading-12 text-[32px] sm:text-[45px] w-full sm:w-2/3 mx-auto text-center mt-[51px] mb-[30px]">
        Land Your Next Job Faster Using Our AI Resume Builder
      </h2>
      <h3 className="poppins-semibold text-[25px] sm:text-[30px] w-full sm:w-2/3 mx-auto text-center mt-[30px]">
        Process Steps:
      </h3>
      <p className="inter-400 text-[#757575] text-[20px] sm:text-[22px] w-full sm:w-2/3 mx-auto text-center mt-[10px]">
        Our AI knows what ATS bots and hiring managers want. All you have to do is
      </p>
      <div className="w-full sm:w-[75%] mx-auto grid grid-cols-1 sm:grid-cols-8 gap-6 mt-[70px]">
        {/* Step 1 */}
        <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center">
            <p className="inter-700 text-[30px] text-[#40BEA7]">01</p>
            <img src={frame} alt="Step 1" className="w-24 sm:w-auto" />
          </div>
          <p className="inter-700 text-[20px] sm:text-[25px] text-center mt-[20px]">
            Click to Build Your Resume
          </p>
        </div>

        {/* Arc between steps */}
        <div className="col-span-1 my-auto hidden sm:block">
          <img src={arc2} alt="Arc 2" className="w-16 sm:w-auto" />
        </div>

        {/* Step 2 */}
        <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center">
            <p className="inter-700 text-[30px] text-[#40BEA7]">02</p>
            <img src={frame2} alt="Step 2" className="w-24 sm:w-auto" />
          </div>
          <p className="inter-700 text-[20px] sm:text-[25px] text-center mt-[20px]">
            Paste a Job Description
          </p>
        </div>

        {/* Arc between steps */}
        <div className="col-span-1 my-auto hidden sm:block">
          <img src={arc3} alt="Arc 3" className="w-16 sm:w-auto" />
        </div>

        {/* Step 3 */}
        <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center">
            <p className="inter-700 text-[30px] text-[#40BEA7]">03</p>
            <img src={frame3} alt="Step 3" className="w-24 sm:w-auto" />
          </div>
          <p className="inter-700 text-[20px] sm:text-[25px] text-center mt-[20px]">
            Get in Front of Recruiters
          </p>
        </div>
      </div>

      <div className="w-full flex items-center justify-center text-white mt-[50px]">
        <Link to={"/builder"}>

        <button className="flex items-center gap-4 bg-[#40BEA7] px-5 py-4 rounded-md text-xl font-poppins text-white mt-2 mx-auto lg:mx-0">
                Build your AI Resume
                <img src={arrow} alt="arrow" className="w-6 h-6" />
              </button>

        </Link>
      
        {/* <button className="bg-[#40BEA7] flex items-center gap-2 poppins-semibold  text-[18px] sm:text-[22px] p-3 rounded-md">
          <span>Build Your AI Resume</span>
          <img src={copy} alt="Button Icon" className="w-5 sm:w-6" />
        </button> */}
      </div>
    </div>
  );
}

export default Section4;
