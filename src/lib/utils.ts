import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes a numeric text-input value so negative values can't be entered.
 * Keeps empty string, and otherwise allows only non-negative decimals.
 * Returns the previous value when the new input is invalid (e.g. contains `-`).
 */
export function sanitizePositiveNumber(value: string, previous = ''): string {
  if (value === '') return ''
  // Allow only digits and a single decimal separator (no minus sign).
  if (!/^\d*\.?\d*$/.test(value)) return previous
  return value
}

export function formatCurrency(value: number | string | null | undefined, currencySymbol?: string | null) {
  const amount = Number(value ?? 0)
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const sign = safeAmount < 0 ? "-" : ""
  const symbol = currencySymbol?.trim() || "₺"

  return `${sign}${symbol}${Math.abs(safeAmount).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
