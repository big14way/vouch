"use client";
import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants as button } from "./button-variants";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
