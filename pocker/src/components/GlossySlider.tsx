import React, { useRef, useEffect, useState, useCallback } from 'react';
import GlossyButton from './GlossyButton';

interface GlossySliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onBackClick?: () => void;
  onOkClick?: () => void;
  className?: string;
  showBackButton?: boolean;
  showOkButton?: boolean;
  formatValue?: (value: number) => string;
}

const GlossySlider: React.FC<GlossySliderProps> = ({ 
  value, 
  min, 
  max, 
  onChange,
  onBackClick,
  onOkClick,
  className = '',
  showBackButton = true,
  showOkButton = true,
  formatValue = (val) => `$${val}`
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const updateValue = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = rect.width === 0 ? 0 : x / rect.width;
    const raw = min + percentage * (max - min);
    const newValue = clamp(Math.round(raw));
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [min, max, onChange, value]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      setIsDragging(true);
      updateValue(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    if (!isDragging) {
      document.body.style.userSelect = '';
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      updateValue(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateValue(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, updateValue]);

  const safeValue = clamp(value);
  const percentage = max === min 
    ? 0 
    : ((safeValue - min) / (max - min)) * 100;

  return (
    <div className={`flex items-center space-x-4 w-full select-none ${className}`}>
      {/* Back Button */}
      {showBackButton && (
        <GlossyButton 
          onClick={onBackClick}
          aria-label="Back"
        >
          <div className="w-0 h-0 border-t-8 border-t-transparent border-r-12 border-r-white border-b-8 border-b-transparent" />
        </GlossyButton>
      )}

      {/* Main Track Area */}
      <div 
        ref={containerRef}
        className="relative grow h-6 rounded-sm cursor-pointer shadow-[0_2px_4px_rgba(0,0,0,0.5)] border-2 border-black overflow-visible"
        style={{
          background: '#8b0000',
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent 50%, rgba(0,0,0,0.2))'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Fill Track */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            width: `${percentage}%`,
            background: '#ff0000',
            backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.4), transparent 50%, rgba(0,0,0,0.3))'
          }}
        />

        {/* Thumb / Handle */}
        <div 
          className="absolute top-1/2 w-4 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black shadow-lg cursor-grab active:cursor-grabbing"
          style={{
            left: `${percentage}%`,
            background: 'linear-gradient(to bottom, #444, #111)',
          }}
        >
          {/* Tooltip Bubble */}
          <div 
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-md border border-black px-4 py-1 flex flex-col items-center justify-center shadow-xl min-w-[120px] pointer-events-none"
          >
            <span className="text-black text-lg leading-tight font-bold">
              {`${formatValue(safeValue)} XLM`}
            </span>
            {/* Tooltip Tail */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black">
              <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white" />
            </div>
          </div>
        </div>
      </div>

      {/* OK Button */}
      {showOkButton && (
        <GlossyButton 
          onClick={onOkClick}
        >
          <span className="text-white text-xl drop-shadow-[0_1px_1px_rgba(0,0,0,1)] font-bold">
            OK
          </span>
        </GlossyButton>
      )}
    </div>
  );
};

export default GlossySlider;
