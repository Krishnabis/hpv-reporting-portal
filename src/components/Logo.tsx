import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'dark' }) => {
  const imageSizes = {
    sm: 'h-9 w-auto object-contain',
    md: 'h-12 w-auto object-contain',
    lg: 'h-16 w-auto object-contain',
    xl: 'h-20 w-auto object-contain'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const subTextColor = variant === 'light' ? 'text-hpv-teal-light' : 'text-hpv-purple';

  return (
    <a href="/" className="flex items-center gap-3 select-none cursor-pointer">
      <div className="bg-white rounded-full p-1 sm:p-1.5 flex items-center justify-center shadow-sm shrink-0">
        <img
          src="/logo.png"
          alt="HPV Vaccination Due List Tracking Logo"
          className={`${imageSizes[size]} drop-shadow-sm transition-transform hover:scale-105`}
        />
      </div>
      <div className="flex flex-col">
        <span className={`font-extrabold tracking-tight leading-tight ${textColor} ${textSizeClasses[size]}`}>
          HPV Vaccination
        </span>
        <span className={`text-[11px] sm:text-xs font-bold tracking-wider uppercase ${subTextColor}`}>
          Due List Tracking
        </span>
      </div>
    </a>
  );
};
