import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// butoane în formă de capsulă, ca pe apple.com: acțiunea principală plină, restul pe fond gri
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium select-none " +
  "transition-[background-color,filter,transform] duration-150 active:scale-[0.98] " +
  "disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap [&_svg]:shrink-0";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:brightness-110 active:brightness-95",
  secondary: "bg-sunken text-ink hover:bg-line active:bg-line-strong",
  ghost: "text-ink hover:bg-sunken active:bg-line",
  danger: "bg-st-red text-white hover:brightness-110 active:brightness-95",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-sm [&_svg]:size-4",
  md: "h-11 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]",
  lg: "h-12 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; pending?: boolean; icon?: ReactNode };

export function Button({ variant = "primary", size = "md", pending, icon, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function LinkButton({ variant = "secondary", size = "md", icon, className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

/** Buton doar cu pictogramă; `label` este obligatoriu pentru cititoarele de ecran. */
export function IconButton({ label, className, children, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sunken active:bg-line disabled:opacity-40", className)}
      {...props}
    >
      {children}
    </button>
  );
}
