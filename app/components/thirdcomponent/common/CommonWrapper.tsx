import React from "react";

const CommonWrapper = ({ children }:{ children:React.ReactNode }) => {
  return <div className="max-w-[1440px] mx-auto ">{children}</div>;
};

export default CommonWrapper;