import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
