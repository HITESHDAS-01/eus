import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormatDate(dateInput: string | Date | null | undefined, formatStr: string = 'dd MMM yyyy') {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, formatStr);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateMaturityAmount(
  category: string,
  initialInvestment: number,
  totalSavings: number,
  roi: number
) {
  if (category === 'A') {
    return totalSavings;
  } else if (category === 'B') {
    return initialInvestment * (1 + roi / 100);
  } else if (category === 'C') {
    return totalSavings * (1 + roi / 100);
  }
  return 0;
}
