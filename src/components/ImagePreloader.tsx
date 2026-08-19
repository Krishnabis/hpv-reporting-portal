import React, { useState, useEffect } from 'react';
import { Target } from 'lucide-react';

interface ImagePreloaderProps {
  images: string[];
  children: React.ReactNode;
}

export const ImagePreloader: React.FC<ImagePreloaderProps> = ({ images, children }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let loadedCount = 0;

    if (images.length === 0) {
      setIsLoaded(true);
      return;
    }

    images.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === images.length) {
          setIsLoaded(true);
        }
      };
      img.onerror = () => {
        // Even if one fails, we shouldn't block the app forever, just proceed.
        loadedCount++;
        if (loadedCount === images.length) {
          setIsLoaded(true);
        }
      };
    });
  }, [images]);

  if (!isLoaded) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center gap-4 animate-pulse">
          <Target className="w-12 h-12 text-hpv-pink animate-spin-slow" />
          <div className="text-sm font-bold text-slate-500 tracking-wide uppercase">Loading Assets...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
