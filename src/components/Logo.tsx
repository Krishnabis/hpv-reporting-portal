import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'dark' }) => {
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
    xl: 'h-16 text-xl'
  };

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const subTextColor = variant === 'light' ? 'text-hpv-teal-light font-medium' : 'text-hpv-purple font-semibold';

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Brand Icon SVG */}
      <div className={`relative flex items-center justify-center rounded-xl gradient-header p-2 text-white shadow-md shadow-hpv-purple/20 ${iconSizes[size]}`}>
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" className="text-hpv-teal-light fill-hpv-purple-dark/50" />
          <path d="M9 12l2 2 4-4" stroke="#EC4899" strokeWidth="2.5" />
        </svg>
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hpv-pink opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-hpv-pink"></span>
        </span>
      </div>

      <div className="flex flex-col">
        <span className={`font-bold tracking-tight leading-tight ${textColor} ${sizeClasses[size]}`}>
          HPV Vaccination
        </span>
        <span className={`text-xs tracking-wide uppercase ${subTextColor}`}>
          Due List Tracking
        </span>
      </div>
    </div>
  );
};
