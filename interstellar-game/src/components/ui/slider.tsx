
"use client"

import React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "../../lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showTooltip?: boolean;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>((props, ref) => {
  const { className, showTooltip = true, ...restProps } = props;
  const value = restProps.value || restProps.defaultValue || [0];
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-4",
        className
      )}
      {...restProps}
    >
      {/* Red Track Background */}
      <SliderPrimitive.Track
        className="relative h-4 w-full grow overflow-hidden border-2 border-black shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
        style={{
          background: '#800000', // Solid deep red as seen in the image
        }}
      >
        {/* Fill Range - matches the background if no highlight is needed, or can be a brighter red */}
        <SliderPrimitive.Range 
          className="absolute h-full"
          style={{
            background: '#a00000',
          }}
        />
      </SliderPrimitive.Track>

      {/* Pill Shaped Thumb */}
      <SliderPrimitive.Thumb
        className="block h-9 w-4 rounded-[6px] border-2 border-black shadow-[0_2px_4px_rgba(0,0,0,0.5)] focus-visible:outline-none disabled:pointer-events-none cursor-grab active:cursor-grabbing"
        style={{
          background: 'linear-gradient(to bottom, #444, #222)',
        }}
      >
        {showTooltip && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-[8px] border-2 border-black px-4 py-1 flex flex-col items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.3)] min-w-[80px] pointer-events-none">
            <span className="text-black font-slab font-bold text-2xl leading-tight">${value[0]}</span>
            
            {/* Tooltip Tail - Precise triangular pointer */}
            <div className="absolute top-[calc(100%+2px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-black">
              <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-white" />
            </div>
          </div>
        )}
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
