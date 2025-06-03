"use client";

import React from 'react';

interface LoadNonCriticalCssProps {
  cssPath: string;
}

const LoadNonCriticalCss: React.FC<LoadNonCriticalCssProps> = ({ cssPath }) => {
  return (
    <>
      <link
        rel="preload"
        href={cssPath}
        as="style"
        onLoad={(e) => {
          e.currentTarget.onload = null;
          e.currentTarget.rel = 'stylesheet';
        }}
      />
      <noscript>
        <link rel="stylesheet" href={cssPath} />
      </noscript>
    </>
  );
};

export default LoadNonCriticalCss;