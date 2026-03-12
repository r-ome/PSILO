import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStorage(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(2)} MB`;
}

export function convertUsdToPhp(usd: number, rate: number = 56): number {
  return usd * rate;
}

export function formatDate(
  value: string | Date | null | undefined,
  formatString: string = "MMM d, yyyy",
): string | null {
  if (!value) return null;

  const date =
    typeof value === "string" ? new Date(value).toLocaleString() : value;

  return format(date, formatString);
}
