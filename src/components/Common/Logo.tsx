import React from 'react';
import { CONFIG } from '../../config/index';
const logo = new URL('./logo.png', import.meta.url).href;

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src={logo}
        alt={CONFIG.COMPANY.NAME}
        className="h-12 w-auto object-contain"
      />
    </div>
  );
};