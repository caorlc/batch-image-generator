"use client";

import { clsx } from "clsx";

interface RangeSliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  min: number;
  max: number;
  value: number;
  onValueChange: (value: number) => void;
}

export function RangeSlider({
  min,
  max,
  value,
  onValueChange,
  className,
  ...props
}: RangeSliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value))}
      className={clsx(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-blue-200 to-blue-500 accent-blue-600",
        className
      )}
      {...props}
    />
  );
}
