import React, { useState, useRef, useEffect } from 'react';

interface VolumeLauncerProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  color?: string;
}

export const VolumeLauncer: React.FC<VolumeLauncerProps> = ({ value, onChange, label, color = '#06b6d4' }) => {
  const [localValue, setLocalValue] = useState(value);
  const [velocity, setVelocity] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Calculate distance from center
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = clickX - centerX;
    const dy = clickY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    // Volume is based on distance from center (worst UX - clicking center = max, edge = min)
    const normalizedDistance = Math.min(1, distance / maxDistance);
    const newValue = normalizedDistance;
    
    // "Launch" animation
    setIsLaunching(true);
    setVelocity(newValue * 0.1);
    setLocalValue(newValue);
    onChange(newValue);
    
    setTimeout(() => setIsLaunching(false), 300);
  };

  // Animate the "launch" effect
  useEffect(() => {
    if (isLaunching && velocity > 0) {
      const animate = () => {
        setVelocity(prev => {
          const newVel = prev * 0.9;
          if (newVel < 0.01) {
            setIsLaunching(false);
            return 0;
          }
          animationRef.current = requestAnimationFrame(animate);
          return newVel;
        });
      };
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isLaunching, velocity]);

  // Calculate position for the "launcher" indicator based on value
  // Use value to determine angle and radius for consistent positioning
  const angle = localValue * Math.PI * 2; // Angle based on value
  const radius = localValue * 40;
  const indicatorX = 50 + Math.cos(angle) * radius;
  const indicatorY = 50 + Math.sin(angle) * radius;

  return (
    <div className="space-y-2" style={{ pointerEvents: 'auto' }}>
      <div className="flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono">{Math.round(localValue * 100)}%</span>
      </div>
      <div 
        ref={containerRef}
        className="relative w-full h-24 border-2 border-slate-600 rounded-lg bg-slate-800 cursor-crosshair overflow-hidden"
        style={{ pointerEvents: 'auto' }}
        onClick={handleClick}
      >
        {/* Circular grid pattern for "launcher" aesthetic */}
        <svg className="absolute inset-0 w-full h-full opacity-20" style={{ pointerEvents: 'none' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <circle
              key={i}
              cx="50%"
              cy="50%"
              r={`${20 + i * 15}%`}
              fill="none"
              stroke={color}
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * Math.PI * 2) / 8;
            const x1 = 50 + Math.cos(angle) * 20;
            const y1 = 50 + Math.sin(angle) * 20;
            const x2 = 50 + Math.cos(angle) * 50;
            const y2 = 50 + Math.sin(angle) * 50;
            return (
              <line
                key={i}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke={color}
                strokeWidth="1"
              />
            );
          })}
        </svg>
        
        {/* Center target */}
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
          style={{ 
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
            pointerEvents: 'none'
          }}
        />
        
        {/* Volume indicator (moves randomly) */}
        <div 
          className="absolute w-4 h-4 rounded-full border-2 border-white transition-all duration-300"
          style={{ 
            left: `${indicatorX}%`,
            top: `${indicatorY}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: color,
            boxShadow: `0 0 15px ${color}`,
            pointerEvents: 'none',
            transform: isLaunching ? `translate(-50%, -50%) scale(${1 + velocity * 2})` : 'translate(-50%, -50%)'
          }}
        />
        
        {/* Click hint */}
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] text-slate-500">
          Click anywhere
        </div>
      </div>
      <div className="text-[8px] text-slate-500 italic text-center">
        🚀 Click to "launch" volume (position is random)
      </div>
    </div>
  );
};
