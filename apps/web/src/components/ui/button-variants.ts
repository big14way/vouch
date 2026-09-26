import { cva } from "class-variance-authority";

/** Button classes, importable from server components (for links that should look like buttons). */
export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-md)] font-medium outline-none transition-[background-color,border-color,color,opacity,transform] duration-150 ease-[var(--ease-out)] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.3)] hover:bg-[color-mix(in_oklab,var(--primary)_88%,white)]",
        secondary: "border border-border-strong bg-surface text-text hover:border-faint/60 hover:bg-overlay",
        ghost: "bg-transparent text-muted hover:bg-surface hover:text-text",
        danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15",
        link: "min-h-0 bg-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-[14px]", lg: "h-12 px-5 text-[15px]" },
      full: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
