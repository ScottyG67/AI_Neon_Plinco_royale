import React, { useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ErrorToastProps {
  error: string;
  onClose: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ error, onClose }) => {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, onClose]);

  if (!error) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border-2 border-red-500 p-4 rounded-xl shadow-[0_0_20px_rgba(255,0,0,0.5)] flex items-center gap-3 max-w-md">
        <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
        <p className="text-red-400 font-bold text-sm flex-1">{error}</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
