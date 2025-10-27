"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild, variant = "primary", disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60",
          variant === "primary" &&
            "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-500 hover:to-indigo-500",
          variant === "secondary" &&
            "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50",
          variant === "ghost" &&
            "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
          className
        )}
        disabled={disabled}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
