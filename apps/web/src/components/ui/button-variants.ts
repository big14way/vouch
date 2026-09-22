import { cva } from "class-variance-authority";

/** Button classes, importable from server components (for links that should look like buttons). */
export const buttonVariants = cva(
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
