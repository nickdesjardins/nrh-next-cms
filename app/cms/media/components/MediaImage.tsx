// app/cms/media/components/MediaImage.tsx
"use client";

import React from 'react';

interface MediaImageProps {
  src: string;
  alt: string;
  className?: string;
}

const MediaImage: React.FC<MediaImageProps> = ({ src, alt, className }) => {
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    (e.target as HTMLImageElement).src = `https://placehold.co/300x300/eee/ccc?text=Error`;
    (e.target as HTMLImageElement).classList.add('p-4', 'object-contain');
  };

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
};

export default MediaImage;