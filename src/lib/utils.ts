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

/** ISO codes we render with a symbol of their own; anything else keeps its code. */
const ISO_CURRENCY_SYMBOLS: Record<string, string> = { TRY: "₺" }

/** Turns an ISO code coming from the API into what we print, e.g. `TRY` → `₺`. */
export function resolveCurrencySymbol(currency?: string | null) {
  const code = currency?.trim()
  if (!code) return undefined
  return ISO_CURRENCY_SYMBOLS[code.toUpperCase()] ?? code
}

export function formatCurrency(value: number | string | null | undefined, currencySymbol?: string | null) {
  const amount = Number(value ?? 0)
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const sign = safeAmount < 0 ? "-" : ""
  const symbol = currencySymbol?.trim() || "₺"
  // An unmapped ISO code reads as "USD 12,00", not "USD12,00".
  const separator = /^[A-Z]{3}$/.test(symbol) ? " " : ""

  return `${sign}${symbol}${separator}${Math.abs(safeAmount).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
