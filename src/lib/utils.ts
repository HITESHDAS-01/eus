import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { locale } from '../config/branding';

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
  return new Intl.NumberFormat(locale.currencyLocale, {
    style: 'currency',
    currency: locale.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// EUS maturity / payout rules
// ---------------------------------------------------------------------------
// Category A (founders): NO ROI — they receive exactly what they put in.
//   This is by design — founders' return is via ownership/profit-share,
//   not a per-deposit ROI.
//
// Category B (one-time investors): ROI applied to initial_investment.
//
// Category C (public): ROI applied to running savings total — but ONLY if
//   the member reaches full maturity. Early-exit members forfeit ROI and
//   receive only principal.
//
// `status` controls the early-exit gate:
//   - 'active' or 'matured'  → ROI applies (if eligible)
//   - 'inactive' / 'withdrawn' / 'closed' → principal only, no ROI
// ---------------------------------------------------------------------------
type MaturityCategory = 'A' | 'B' | 'C' | string;
type MaturityStatus = 'active' | 'matured' | 'inactive' | 'withdrawn' | 'closed' | string;

export function calculateMaturityAmount(
  category: MaturityCategory,
  initialInvestment: number,
  totalSavings: number,
  roi: number,
  status: MaturityStatus = 'active',
) {
  const earlyExit = status === 'inactive' || status === 'withdrawn' || status === 'closed';

  if (category === 'A') {
    // Founders: no ROI ever, regardless of status.
    return totalSavings;
  }

  if (category === 'B') {
    // Early-exit Cat B forfeits ROI, returns only the original deposit.
    if (earlyExit) return initialInvestment;
    return initialInvestment * (1 + roi / 100);
  }

  if (category === 'C') {
    // Early-exit Cat C forfeits ROI, returns only what they actually paid.
    if (earlyExit) return totalSavings;
    return totalSavings * (1 + roi / 100);
  }

  return 0;
}
