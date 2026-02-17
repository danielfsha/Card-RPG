
import React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95 select-none relative overflow-hidden group/button border-black border-[3px] shadow-[0_4px_4px_rgba(0,0,0,0.6)]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        glossy: "text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),inset_0_-1px_2px_rgba(0,0,0,0.6)]",
        dark: "text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),inset_0_-1px_2px_rgba(0,0,0,0.5)]",
      },
      size: {
        default: "h-16 px-8 py-4",
        sm: "h-10 px-4",
        lg: "h-20 px-12",
        xl: "h-24 px-16",
        icon: "size-16 rounded-[18px]", // Perfect square with chunky rounded corners
        "icon-lg": "size-20 rounded-[22px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const { className, variant, size, asChild = false, ...restProps } = props
    const Comp = asChild ? Slot : "button"
    
    // Style for the glossy look from the image
    const buttonStyle = React.useMemo(() => {
      if (variant === 'glossy') {
        return {
          background: 'linear-gradient(to bottom, #3a3a3a 0%, #1a1a1a 48%, #000 50%, #1a1a1a 100%)',
        };
      }
      if (variant === 'dark') {
        return {
          background: 'linear-gradient(to bottom, #5a5a5a 0%, #4a4a4a 48%, #3a3a3a 50%, #2a2a2a 100%)',
        };
      }
      return undefined;
    }, [variant]);

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={buttonStyle}
        {...restProps}
      >
        {/* Top Gloss Highlight Overlay */}
        <div className="absolute top-0 left-0 right-0 h-[50%] bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
        
        <span className={cn(
          "relative z-10 flex items-center gap-4", 
          variant === 'glossy' && "drop-shadow-[0_3px_3px_rgba(0,0,0,1)] font-slab text-4xl tracking-widest",
          variant === 'dark' && "drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]"
        )}>
          {restProps.children}
        </span>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
