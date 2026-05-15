// ===========================================================================
// Org-specific branding & locale.
// ---------------------------------------------------------------------------
// Per-client customization lives here. Sensible defaults are baked in for the
// EUS deployment; any field can be overridden at build time via VITE_* env
// vars (see .env.example).
//
// Colors are intentionally NOT in this file — they are repeated across ~20
// components as Tailwind arbitrary values (`bg-[#1e5a48]`, etc.). For a new
// client, do a single repo-wide find/replace on the four brand hex codes:
//   #0b3b2f  — primary darkest (header bg)
//   #1e5a48  — primary main
//   #154033  — primary hover
//   #f7b05e  — accent (CTA buttons)
// ===========================================================================

const env = import.meta.env;

export const branding = {
  orgName: env.VITE_ORG_NAME ?? 'Ekata Unnayan Sanstha',
  orgShort: env.VITE_ORG_SHORT ?? 'EUS',
  // Native-script display name (shown in modal headers, sidebar, etc.).
  // Default is the Bengali/Assamese spelling for EUS.
  orgNameNative: env.VITE_ORG_NAME_NATIVE ?? 'একতা উন্নয়ন সংস্থা',
  tagline: env.VITE_ORG_TAGLINE ?? 'Member-owned cooperative savings',
} as const;

export const locale = {
  // Used by Intl.NumberFormat for currency rendering.
  currency: env.VITE_ORG_CURRENCY ?? 'INR',
  currencyLocale: env.VITE_ORG_CURRENCY_LOCALE ?? 'en-IN',
  // Currency symbol used in label text (₹100/mo, etc.). Intl handles the
  // actual amount formatting; this is just for static labels.
  currencySymbol: env.VITE_ORG_CURRENCY_SYMBOL ?? '₹',
} as const;

export const memberAuth = {
  // Synthetic email domain used to back member logins via Supabase auth.
  // Must match MEMBER_EMAIL_DOMAIN set on the admin-create-member Edge Function.
  emailDomain: env.VITE_MEMBER_EMAIL_DOMAIN ?? 'members.local',
} as const;
