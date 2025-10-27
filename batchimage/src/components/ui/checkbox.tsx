"use client";

import { clsx } from "clsx";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  label,
  className,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  return (
    <label className={clsx("flex items-center gap-2 text-sm", className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border border-slate-300 accent-blue-600"
        onChange={(event) => {
          onCheckedChange?.(event.target.checked);
          props.onChange?.(event);
        }}
        {...props}
      />
      {label && <span className="text-slate-600">{label}</span>}
    </label>
  );
}
