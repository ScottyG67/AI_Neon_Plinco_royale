import React, { useState, useRef, useEffect } from 'react';

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  color?: string;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({ value, onChange, label, color = '#ec4899' }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateValue(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateValue(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateValue = (e: MouseEvent | React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e as MouseEvent).clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    // Invert the value for "worst" UX - dragging right decreases volume
    const invertedValue = 1 - percentage;
    setLocalValue(invertedValue);
    onChange(invertedValue);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Rotate the slider 90 degrees for vertical orientation (worst UX)
  const fillPercentage = localValue * 100;

  return (
    <div className="space-y-2" style={{ pointerEvents: 'auto' }}>
      <div className="flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono">{Math.round(localValue * 100)}%</span>
      </div>
      <div 
        ref={containerRef}
        className="relative w-full h-8 border-2 border-slate-600 rounded bg-slate-800 cursor-crosshair"
        style={{ 
          transform: 'scaleX(-1)',
          pointerEvents: 'auto'
        }}
        onMouseDown={handleMouseDown}
      >
        <div 
          className="absolute top-0 left-0 h-full rounded transition-all"
          style={{ 
            width: `${fillPercentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`,
            pointerEvents: 'none'
          }}
        />
        <div 
          className="absolute top-1/2 left-0 h-1 w-full bg-slate-700 transform -translate-y-1/2"
          style={{ pointerEvents: 'none' }}
        />
        <div 
          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all"
          style={{ 
            left: `${fillPercentage}%`,
            backgroundColor: color,
            marginLeft: '-8px',
            boxShadow: `0 0 15px ${color}`,
            pointerEvents: 'none',
            cursor: 'grab'
          }}
        />
      </div>
      <div className="text-[8px] text-slate-500 italic text-center">
        ⚠️ Dragging right decreases volume (by design)
      </div>
    </div>
  );
};
