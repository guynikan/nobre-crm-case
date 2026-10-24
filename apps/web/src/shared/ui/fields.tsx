import type { ComponentProps } from "react";
import { maskMoneyInput } from "@/shared/format";

export const inputClass =
  "rounded-md border border-line bg-white px-3 py-2 text-sm placeholder:text-muted/70 focus:border-nobre-500 focus:outline-none disabled:opacity-60";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants = {
    primary: "bg-nobre-700 text-white hover:bg-nobre-900",
    secondary: "border border-line bg-panel hover:border-nobre-500",
    danger: "bg-danger-600 text-white hover:bg-danger-600/90",
    ghost: "text-nobre-700 hover:bg-nobre-100",
  } as const;
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

type CurrencyInputProps = Omit<ComponentProps<"input">, "type" | "inputMode" | "onChange" | "value"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function CurrencyInput({ value, onValueChange, className = "", ...props }: CurrencyInputProps) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
        R$
      </span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onValueChange(maskMoneyInput(event.target.value))}
        className={`${inputClass} w-full pl-10 ${className}`}
      />
    </div>
  );
}
