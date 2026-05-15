# EUS — Cooperative Savings Web App

Member & admin portal for a cooperative savings society. React 19 + Vite +
Tailwind on the front-end, Supabase (Postgres + Auth + Storage + Edge
Functions) on the back-end.

This codebase is also designed to be **reusable across clients** — most
client-specific values live in [`src/config/branding.ts`](src/config/branding.ts)
and the `.env` file. See [Reskinning for a new client](#reskinning-for-a-new-client) below.

## Features

- Two-role login: **Admin** (email + password) and **Member** (member code + password)
- Members: passbook overview, savings/installments history, loan summaries
- Admins: member CRUD with Excel import, savings/loan management, audit log,
  org profile, system parameters, full DB backup export
- Row-level security on every table — admins can manage everything; members
  can only read their own rows
- Audit log triggers on members, savings, loans, and repayments

## Prerequisites

- **Node.js 20+**
- A **Supabase project** (free tier is fine)
- The **Supabase CLI** (`npm i -g supabase`) — only required for deploying
  the Edge Functions

## 1. Configure Supabase

### 1a. Run the migration

In the Supabase dashboard go to **SQL Editor → New Query** and paste the
contents of [`supabase/migrations/20240101000000_initial_schema.sql`](supabase/migrations/20240101000000_initial_schema.sql).
Run it. This creates all tables, RLS policies, triggers, helper functions,
and seeds the default settings.

### 1b. Create the storage bucket for member photos

Dashboard → **Storage → New bucket**:

- Name: `member-photos`
- Public: **Yes** (member avatars are displayed via public URL)

Add a storage policy that lets authenticated admins write to this bucket:

```sql
CREATE POLICY "Admins can write member-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'member-photos'
    AND public.is_admin(auth.uid())
);

CREATE POLICY "Anyone can read member-photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'member-photos');
```

### 1c. Deploy the Edge Functions

Three functions handle admin-only privileged operations (creating
auth.users, etc.) so the service-role key never lives in the browser.

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy admin-create-member
supabase functions deploy admin-create-subadmin
supabase functions deploy admin-delete-member
```

Each function automatically inherits `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY` from the project. If you want to override
the synthetic email domain used for member logins (default
`members.local`), set it on the create-member function:

```bash
supabase secrets set MEMBER_EMAIL_DOMAIN=members.yourdomain.com
```

### 1d. Bootstrap the first admin

1. Dashboard → **Authentication → Users → Add user**. Enter the admin's
   email and password. Set "Auto-confirm email" so they can log in
   immediately.
2. Dashboard → **SQL Editor**:

   ```sql
   SELECT public.promote_to_admin('first.admin@example.com');
   ```

That row is now an admin. Log in via the app's Admin tab.

To add more admins later, use the **Admin → Settings → Security & Accounts**
page — it calls the `admin-create-subadmin` Edge Function.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<your-anon-key>"
```

Both values come from Dashboard → **Project Settings → API**.

## 3. Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production bundle in dist/
npm run preview      # serves the production bundle locally
npm run lint         # tsc --noEmit
```

## Member login

When an admin creates a member through the UI they enter an **initial
password**. The system creates a Supabase auth user with a synthetic email
(`<sanitized_member_code>@members.local`) so RLS can identify the member
via `auth.uid()`. The member logs in with their **Member ID** and that
password. To rotate a member's password, admin can reset it via the
Supabase dashboard (Authentication → Users → "Send password reset").

## Reskinning for a new client

1. **`src/config/branding.ts`** — org name (English + native), short code,
   currency, locale. Most clients only need this file.
2. **`.env`** — override branding via `VITE_ORG_NAME`, `VITE_ORG_SHORT`,
   `VITE_ORG_CURRENCY`, etc. without touching source.
3. **Brand colors** — search/replace these four hex codes across `src/`:
   - `#0b3b2f` — primary darkest (modal header bg)
   - `#1e5a48` — primary main (buttons, links)
   - `#154033` — primary hover
   - `#f7b05e` — accent (CTA buttons)

   Use your IDE's project-wide find/replace. Roughly 200 occurrences across
   20 component files.
4. **Logo** — Admin → Settings → Organization Profile (no rebuild needed).
5. **Member code prefix** — default `EUS`. Change once via SQL:

   ```sql
   UPDATE app_text_settings SET value = 'ACME' WHERE key = 'member_code_prefix';
   ```

## Project structure

```
src/
  config/branding.ts        # org name, currency, locale (per-client overrides)
  lib/
    AuthContext.tsx         # Supabase auth wrapper, role lookup
    supabase.ts             # Supabase client init
    utils.ts                # cn(), formatCurrency, date helpers
    lang.ts                 # i18n (English + Assamese)
  components/
    LandingPage.tsx
    LoginModal.tsx          # Member + Admin login tabs
    admin/StatementModal.tsx
    ui/basic.tsx            # Button, Input, Label
  pages/
    AdminDashboard.tsx, AdminHome.tsx
    admin/                  # Members, Loans, Investments, Reports, Settings, ...
    MemberDashboard.tsx, MemberHome.tsx
    MemberLoans.tsx, MemberTransactions.tsx
supabase/
  migrations/               # Initial schema + RLS + triggers
  functions/
    admin-create-member/    # Edge Function: provision a new member
    admin-create-subadmin/  # Edge Function: provision a new admin
    admin-delete-member/    # Edge Function: cascade-delete a member
```

## Security notes

- All financial tables enforce RLS. Admin access is gated by the
  `public.is_admin(uid)` SQL function (SECURITY DEFINER to avoid RLS
  recursion).
- The service-role key is **only** used inside Edge Functions, never
  shipped in the browser bundle.
- Production builds strip `console.log/warn/info/debug` via esbuild's
  `pure` option (see `vite.config.ts`). `console.error` is preserved for
  genuine failures.
- Member passwords are stored hashed by Supabase auth (bcrypt). Synthetic
  emails are non-reachable, so password reset must currently be triggered
  by an admin via the Supabase dashboard.
