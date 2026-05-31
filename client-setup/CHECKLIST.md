# New Client Onboarding — Quick Checklist

One-page version of `README.md`. Use this for repeat onboarding once you've
done the full guide at least once.

Allow ~45–90 min total.

---

## Pre-flight

- [ ] Client name: ________________________________
- [ ] Short code (2-5 caps, e.g. `ABC`): ________________________________
- [ ] Admin email: ________________________________
- [ ] Admin starter password: ________________________________
- [ ] Custom domain (if any): ________________________________

---

## Phase 1 — Supabase (15 min)

- [ ] [supabase.com](https://supabase.com) → New project — name `<short>-prod`, India region
- [ ] Save DB password somewhere safe
- [ ] Settings → API → copy:
  - [ ] Project URL → `_______________________________________`
  - [ ] anon public key → `_______________________________________`
  - [ ] service_role key (don't put in frontend) → `_______________________________________`

## Phase 2 — Schema (10 min)

- [ ] SQL Editor → paste + run `client-setup/sql/01-schema.sql`
- [ ] SQL Editor → paste + run `client-setup/sql/02-storage.sql`
- [ ] **Edit `client-setup/sql/03-initial-data.sql`**:
  - [ ] Change `member_code_prefix` value to client short code
  - [ ] Leave default numeric settings as-is (unless client asked for different ROI/penalty rules)
- [ ] SQL Editor → paste + run the edited `03-initial-data.sql`

## Phase 3 — First admin user (5 min)

The schema is up but there are no users yet. Create the admin manually:

- [ ] Supabase Dashboard → Authentication → Users → Add user
  - Email: client admin's email
  - Password: starter password
  - ✅ Auto Confirm User
- [ ] Copy the new user's UUID from the users list
- [ ] SQL Editor → run (paste the UUID + name):
  ```sql
  INSERT INTO profiles (id, full_name, role)
  VALUES ('<paste-uuid>', '<admin-name>', 'admin')
  ON CONFLICT (id) DO UPDATE SET role='admin', full_name=EXCLUDED.full_name;
  ```

## Phase 4 — Edge Functions (10 min)

- [ ] Edge Functions → Create new function — `admin-create-member`
  - [ ] Paste `supabase/functions/admin-create-member/index.ts`
  - [ ] Deploy
- [ ] Edge Functions → Create new function — `admin-reset-member-password`
  - [ ] Paste `supabase/functions/admin-reset-member-password/index.ts`
  - [ ] Deploy

## Phase 5 — Vercel (15 min)

- [ ] [vercel.com](https://vercel.com) → New Project from `HITESHDAS-01/eus` repo
- [ ] Framework: Vite (auto-detected)
- [ ] Environment variables:
  - [ ] `VITE_SUPABASE_URL`           = `<from Phase 1>`
  - [ ] `VITE_SUPABASE_ANON_KEY`      = `<from Phase 1>`
  - [ ] `VITE_ORG_NAME`               = full English name
  - [ ] `VITE_ORG_SHORT`              = same as `member_code_prefix`
  - [ ] `VITE_ORG_NAME_NATIVE`        = native-script name (or same as English)
  - [ ] `VITE_ORG_TAGLINE`            = tagline
  - [ ] `VITE_ORG_CURRENCY`           = `INR` (usually)
  - [ ] `VITE_ORG_CURRENCY_LOCALE`    = `en-IN` (usually)
- [ ] Deploy → wait for green
- [ ] Click the deployment URL — should see landing page

## Phase 6 — Custom domain (optional, 10 min)

- [ ] Vercel → Settings → Domains → add client domain
- [ ] Update client's DNS as Vercel instructs
- [ ] Wait for SSL provisioning (~5 min)

## Phase 7 — Landing page content (optional, 30 min)

Only needed if the client wants their own founder names / address / Assamese
text / logo on the landing page.

- [ ] Create branch `client-<short>` from `main`
- [ ] Edit `src/components/LandingPage.tsx`:
  - [ ] Founder names + phone numbers (3 cards in Contact section)
  - [ ] Office address (English + Assamese strings)
  - [ ] Logo URL (2 places — header + hero)
  - [ ] `content.as` and `content.en` text as needed
- [ ] Commit + push to branch
- [ ] Vercel → Settings → Production branch → `client-<short>`
- [ ] Redeploy

## Phase 8 — Smoke test

Log in as the admin and verify:

- [ ] Dashboard loads
- [ ] Settings → Profile → change password works
- [ ] Members → Add New Member → save works (proves Edge Function deployed)
- [ ] Members → Edit → Reset Password → save works (proves reset Edge Function deployed)
- [ ] Member portal: log in as the test member → see correct branding
- [ ] Upload a profile photo for the test member → image displays (proves Storage bucket policies)

## Phase 9 — Handover

- [ ] Email admin: login URL + credentials + "change password immediately"
- [ ] 20-min training call: add members, record installments, view reports

---

## If something breaks

See **Troubleshooting** section in `README.md`. Common culprits:

| Issue | Fix |
|---|---|
| Photos not loading | Re-run `sql/02-storage.sql` |
| Member code starts with `EUS/` | `member_code_prefix` not set — re-run `sql/03-initial-data.sql` |
| "function not found" on member create | Edge Function not deployed |
| Admin can't see anything | `profiles.role` is not `'admin'` for that user |
