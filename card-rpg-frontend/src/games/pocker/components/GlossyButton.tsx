
import React from 'react';

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: 'play' | 'plus';
}

const GlossyButton = React.forwardRef<HTMLButtonElement, GlossyButtonProps>(
  ({ children, icon, className, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`group relative flex items-center justify-center px-4 py-3 rounded-sm transition-all active:scale-95 select-none uppercase ${className || ''}`}
        style={{
          background: 'linear-gradient(to bottom, #333 0%, #111 45%, #000 50%, #111 100%)',
          border: '3px solid #000',
          boxShadow: `
            0 4px 6px -1px rgba(0, 0, 0, 0.5),
            0 10px 15px -3px rgba(0, 0, 0, 0.4),
            inset 0 1px 1px rgba(255, 255, 255, 0.3),
            inset 0 -1px 1px rgba(0, 0, 0, 0.5)
          `,
          ...style
        }}
        {...props}
      >

        <div className="flex items-center space-x-3 z-10">
          <span className="text-white text-sm tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,1)] font-bold">
            {children}
          </span>
        </div>
      </button>
    );
  }
);

GlossyButton.displayName = 'GlossyButton';

export default GlossyButton;

