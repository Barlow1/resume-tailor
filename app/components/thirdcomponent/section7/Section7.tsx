import React from 'react'

import arrow from "../../thirdcomponent/assets/arw.svg";
import social from "../../thirdcomponent/assets/social.png";
import { Link } from '@remix-run/react';

function Section7() {
  return (
    <div className="w-full bg-[#F5F7FC] flex flex-col items-center justify-evenly py-14 px-12 ">
      <h2 className="text-[32px] md:text-[45px] font-semibold font-poppins text-black text-center mb-8">
        Trusted by Professionals
      </h2>

      <div className="flex flex-col gap-6  w-full px-6 mb-16 ">
        <p className="font-inter text-[18px] md:text-[22px] leading-[28px] md:leading-[30px] text-[#757575] text-center">
          Discover why our platform is recognized as the best AI resume builder for job seekers ready to transform their <br></br>career trajectory. Our advanced AI resume technology is designed to streamline the application process, ensuring <br></br>that every resume is optimized to pass ATS filters and catch the eye of recruiters.
        </p>
        <p className="font-inter text-[18px] md:text-[22px] leading-[28px] md:leading-[30px] text-[#757575] text-center">
          By leveraging cutting-edge algorithms and data-driven insights, we’ve built the best resume builder AI that not only <br></br> saves you time but also increases your chances of landing interviews and ultimately, your dream job. Whether <br></br> you're revamping an old resume or creating one from scratch, our solution is the ideal choice for a seamless and effective job search.
        </p>
      </div>

      <div className="mb-12 mt-3">
      <Link to={"/builder"} >
      <button className="flex items-center gap-2 bg-[#40BEA7] px-4 py-4 rounded-md text-xl  font-poppins text-white mt-2 mx-auto lg:mx-0">
                Build your AI Resume
                <img src={arrow} alt="arrow" className="w-6 h-6" />
              </button>
      </Link>
      </div>
        
      <div>
        <img
          src={social}
          alt="Social Proof Logos"
          className="w-full max-w-[907px] h-auto"
        />
      </div>
    </div>
  );
}

export default Section7;
