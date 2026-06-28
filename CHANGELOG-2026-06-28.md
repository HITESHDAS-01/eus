# Changelog — 28 Jun 2026

## Dashboard
- **Export Report button** — wired to download CSV with summary stats, recent transactions, overdue members, and maturity alerts
- **Dashboard cards** — added soft pastel background colors per card (teal, blue, purple, green, orange, teal, red, amber)
- **Mobile layout** — changed from 1 card/row to 2 cards/row on small screens with smaller padding/icons/text
- **Header wrap** — "Dashboard Overview" + "Export Report" stack vertically on mobile

## Expenses Module (New)
- Created `Expenses` page between Reports and Settings in sidebar
- Added `expenses` table migration (`20240108000000_expenses_table.sql`)
- Features: add expense form (category, description, amount, date), category filter buttons, expenses table with delete, summary cards (this month + all time), Export CSV
- Mobile: 2-column summary cards

## Member Login Fix
- **Root cause:** Edge Function created auth users with temp UUID emails, then tried to update to synthetic emails (`eus_MMYYYY_C_NNN@members.local`). Orphan auth users held those synthetic emails, causing silent update failures. Members were stuck with UUID emails.
- **Fix applied:** Deleted 511 orphan auth users, updated 63 members' emails and passwords
- **Edge Function hardened:** `admin-create-member` now auto-detects and deletes orphan auth users when email update fails due to duplicate
- **Redeployed** Edge Function to Supabase

## Files Changed
- `src/pages/AdminHome.tsx` — Export Report, card colors, mobile layout, header wrap
- `src/pages/admin/Expenses.tsx` — new file
- `src/pages/AdminDashboard.tsx` — Expenses nav item + route
- `supabase/migrations/20240108000000_expenses_table.sql` — new file
- `supabase/functions/admin-create-member/index.ts` — orphan cleanup on email conflict
