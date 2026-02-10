import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  color?: string;
}

const FRAME_RATE = 60;
const g = 0.2 / FRAME_RATE; // gravitational constant for physics simulation

export const VolumeSlider: React.FC<VolumeSliderProps> = ({ value, onChange, label, color = '#ec4899' }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  
  // Physics simulation state
  const centerXRef = useRef(0);
  const centerYRef = useRef(0);
  const angleOffsetRef = useRef(0);
  const angleRef = useRef(0);
  const uRef = useRef(0); // acceleration
  const vRef = useRef(0); // velocity
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const updateVolume = useCallback(() => {
    // Calculate acceleration based on current angle (gravity simulation)
    uRef.current = Math.sin(angleRef.current) * g;
    vRef.current += uRef.current;
    
    // Update volume based on velocity
    setLocalValue(prev => {
      let currentVolume = prev + vRef.current;
      
      // Clamp volume between 0 and 1
      if (currentVolume > 1 || currentVolume < 0) {
        if (currentVolume > 1) {
          currentVolume = 1;
        } else {
          currentVolume = 0;
        }
        vRef.current = 0; // Reset velocity when hitting bounds
      }
      
      onChange(currentVolume);
      return currentVolume;
    });
  }, [onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    const bounds = containerRef.current.getBoundingClientRect();
    centerXRef.current = (bounds.left + bounds.right) / 2;
    centerYRef.current = (bounds.top + bounds.bottom) / 2;
    
    // Calculate initial angle offset
    angleOffsetRef.current = Math.atan2(
      e.clientY - centerYRef.current,
      e.clientX - centerXRef.current
    );
    
    // Reset physics state
    uRef.current = 0;
    vRef.current = 0;
    angleRef.current = 0;
    
    // Start physics simulation timer
    timerRef.current = window.setInterval(updateVolume, 1000 / FRAME_RATE);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    // Calculate current angle relative to center
    angleRef.current = Math.atan2(
      e.clientY - centerYRef.current,
      e.clientX - centerXRef.current
    ) - angleOffsetRef.current;
    
    // Update visual rotation
    const rotationDegrees = (angleRef.current * 180) / Math.PI;
    setRotation(rotationDegrees);
    
    if (sliderContainerRef.current) {
      sliderContainerRef.current.style.transform = `rotate(${rotationDegrees}deg)`;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    // Stop physics simulation
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Reset physics state
    uRef.current = 0;
    vRef.current = 0;
    angleRef.current = 0;
    
    // Reset rotation
    setRotation(0);
    if (sliderContainerRef.current) {
      sliderContainerRef.current.style.transform = 'rotate(0deg)';
    }
  };

  const handleMouseLeave = () => {
    handleMouseUp();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="space-y-2" 
      style={{ pointerEvents: 'auto' }}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
    >
      <div className="flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono">{Math.round(localValue * 100)}%</span>
      </div>
      <div 
        ref={containerRef}
        className="relative w-full flex justify-center items-center py-4"
        style={{ pointerEvents: 'auto' }}
        onMouseMove={(e) => {
          if (isDragging) {
            handleMouseMove(e.nativeEvent);
          }
        }}
      >
        <div
          ref={sliderContainerRef}
          className={`bg-slate-800 border-2 border-slate-600 rounded-lg px-5 py-3 flex items-center cursor-grab ${!isDragging ? 'transition-transform duration-300 ease-out' : ''}`}
          style={{ 
            pointerEvents: 'auto',
            borderColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
          onMouseDown={handleMouseDown}
        >
          <input
            type="range"
            min="0"
            max="100"
            value={localValue * 100}
            disabled
            className="w-48 accent-fuchsia-500"
            style={{
              pointerEvents: 'none',
              cursor: 'grab'
            }}
          />
        </div>
      </div>
      <div className="text-[8px] text-slate-500 italic text-center">
        ⚠️ Drag to rotate - physics simulation affects volume
      </div>
    </div>
  );
};
