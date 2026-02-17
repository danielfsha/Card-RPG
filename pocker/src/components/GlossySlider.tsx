
import React, { useRef, useEffect, useState } from 'react';

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

  const updateValue = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newValue = Math.round(min + percentage * (max - min));
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateValue(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValue(e.clientX);
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, value]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex items-center space-x-4 w-full select-none ${className}`}>
      {/* Back Button */}
      {showBackButton && (
        <button 
          onClick={onBackClick}
          className="w-12 h-12 rounded-lg flex items-center justify-center border-2 border-black/40 shadow-lg active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(to bottom, #444, #222)' }}
          aria-label="Back"
        >
          <div className="w-0 h-0 border-t-8 border-t-transparent border-r-12 border-r-white border-b-8 border-b-transparent" />
        </button>
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
            <span className="text-black text-lg leading-tight font-bold">{`${formatValue(value)} XLM`}</span>
            {/* Tooltip Tail */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black">
               <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white" />
            </div>
          </div>
        </div>
      </div>

      {/* OK Button */}
      {showOkButton && (
        <button 
          onClick={onOkClick}
          className="px-6 h-12 rounded-lg flex items-center justify-center border-2 border-black/40 shadow-lg active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(to bottom, #444, #222)' }}
        >
          <span className="text-white text-xl drop-shadow-[0_1px_1px_rgba(0,0,0,1)] font-bold">OK</span>
        </button>
      )}
    </div>
  );
};

export default GlossySlider;

