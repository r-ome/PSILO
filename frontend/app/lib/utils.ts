import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  value: string | Date | null | undefined,
  formatString: string = "MMM d, yyyy",
): string | null {
  if (!value) return null;

  const date = typeof value === "string" ? new Date(value) : value;

  if (isNaN(date.getTime())) return null;

  return format(date, formatString);
}
