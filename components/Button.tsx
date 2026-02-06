import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyles = "px-6 py-3 font-display font-bold uppercase tracking-wider transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-cyan-500 text-black border-2 border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.6)] hover:bg-cyan-400 hover:shadow-[0_0_25px_rgba(0,255,255,0.8)]",
    secondary: "bg-transparent text-fuchsia-500 border-2 border-fuchsia-500 shadow-[0_0_10px_rgba(255,0,255,0.3)] hover:bg-fuchsia-500/10 hover:shadow-[0_0_20px_rgba(255,0,255,0.5)]",
    danger: "bg-red-600 text-white border-2 border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.6)]"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};