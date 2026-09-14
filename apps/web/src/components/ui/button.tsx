"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-md)] font-medium transition-[background-color,color,transform,opacity] duration-[120ms] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] min-h-11 px-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:brightness-95",
        secondary: "bg-surface text-text border border-border hover:bg-border/60",
        ghost: "bg-transparent text-text hover:bg-surface",
        danger: "bg-danger text-white hover:brightness-95",
        link: "bg-transparent text-primary underline-offset-4 hover:underline px-0 min-h-0",
      },
      size: { sm: "min-h-9 px-3 text-[13px]", md: "text-[15px]", lg: "min-h-12 px-5 text-[17px]" },
      full: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, full, loading, children, disabled, ...props }, ref) => (
  <button ref={ref} className={cn(button({ variant, size, full }), className)} disabled={disabled || loading} aria-busy={loading} {...props}>
    {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
    {children}
  </button>
));
Button.displayName = "Button";
