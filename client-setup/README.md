# New Client Onboarding Kit

This folder is everything you need to spin up a fresh deployment of the EUS web app
for a brand-new cooperative society / client. It is intentionally written so that
**anyone — including a fresh AI session — can follow these steps without context
from earlier conversations**.

## What this app is

A member-managed cooperative-savings + product-EMI web app, originally built for
**Ekata Unnayan Sanstha (EUS)**. Each client gets a **completely separate**
deployment: their own Supabase project (data isolation), their own Vercel project
(custom domain/branding), but the **same shared codebase** on the same GitHub repo.

```
shared GitHub repo  →  Vercel project A  →  Supabase project A   (Client A)
                   →  Vercel project B  →  Supabase project B   (Client B)
                   →  Vercel project C  →  Supabase project C   (Client C)
```

Pushing to `main` redeploys every Vercel project automatically — so a single
codebase serves all clients, and each client only sees their own data.

## What you'll do for a new client (high-level)

1. **Create a new Supabase project** (data layer)
2. **Run the SQL files in this folder** in order on that project (creates tables,
   triggers, RPCs, storage, default settings, first admin user)
3. **Deploy 2 Edge Functions** to that Supabase project
4. **Create a new Vercel project** from the same GitHub repo
5. **Set env vars** in Vercel pointing at the new Supabase project + the
   client's branding overrides
6. **(Optional) customize landing page content** in code if the client wants their
   own founder names, contact numbers, Assamese text, etc.
7. **Hand over credentials** to the client admin

The first time this takes ~1.5 hours. After 2-3 clients it should drop to ~45 min.

## Files in this folder

| File | What it does | When to use |
|---|---|---|
| `README.md` (this file) | Master onboarding guide | Read first |
| `CHECKLIST.md` | One-page quick checklist | Use for repeat onboarding |
| `sql/01-schema.sql` | All tables, RPCs, triggers, RLS, indexes | Run once on a fresh DB |
| `sql/02-storage.sql` | `member-photos` bucket + RLS policies | Run once on a fresh DB |
| `sql/03-initial-data.sql` | Default settings + first admin user | Run once, **edit org-specific values first** |
| `edge-functions-deploy.md` | How to deploy the 3 Edge Functions | Run once |
| `branding-customization.md` | Per-client code customizations (env vars, landing page, colors) | Edit before deploy |

---

## Full step-by-step (first time)

### Phase 1 — Supabase project (~15 min)

1. Go to [supabase.com](https://supabase.com) → **New project**.
   - Name: `<client-short>-prod` (e.g. `abc-society-prod`)
   - Region: closest to client (e.g. `ap-south-1` for India)
   - **Save the database password** somewhere safe
2. Wait ~2 min for provisioning.
3. Project Settings → API → copy:
   - `Project URL` → you'll need this later as `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → needed for Edge Function env (do NOT put in frontend)

### Phase 2 — Database setup (~15 min)

In the new Supabase project, open **SQL Editor** and run these files **in order**:

1. **`sql/01-schema.sql`** — Creates every table, trigger, RPC, RLS policy used
   by the app. Idempotent (safe to re-run).

2. **`sql/02-storage.sql`** — Creates the `member-photos` storage bucket and its
   public-read + admin-write policies.

3. **Edit `sql/03-initial-data.sql`** first (top section has placeholders):
   - `member_code_prefix` — e.g. `'ABC'` if the client is "ABC Society"
   - `roi_*`, `penalty_percentage`, `monthly_due_day`, etc. — defaults are fine
     for most clients; change only if the client has different rules
4. Then run `sql/03-initial-data.sql`. It only inserts settings (no FK
   dependencies) so it'll succeed even before any user exists.

### Phase 3 — First admin user (~5 min)

The schema is now in place but there are no users yet. Create the first admin:

1. Supabase Dashboard → **Authentication → Users → Add user**
   - Email: client admin's real email
   - Password: a strong starter password (they'll change it)
   - **Auto Confirm User**: ✅ tick this
2. Copy the new user's UUID from the users list.
3. Open SQL Editor and run:
   ```sql
   INSERT INTO profiles (id, full_name, role)
   VALUES ('<paste-uuid-here>', 'Admin Name', 'admin')
   ON CONFLICT (id) DO UPDATE SET role='admin', full_name=EXCLUDED.full_name;
   ```

### Phase 4 — Edge Functions (~15 min)

See [`edge-functions-deploy.md`](./edge-functions-deploy.md). You'll deploy
3 functions via the Supabase Dashboard's Edge Functions UI:
- `admin-create-member`
- `admin-delete-member` (if used)
- `admin-reset-member-password`

### Phase 5 — Vercel deployment (~15 min)

1. Go to [vercel.com](https://vercel.com) → **New Project**.
2. Import from the same GitHub repo (`HITESHDAS-01/eus`).
3. **Framework Preset**: Vite (auto-detected).
4. **Environment Variables** — add these:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | new Supabase URL from Phase 1 |
   | `VITE_SUPABASE_ANON_KEY` | new Supabase anon key from Phase 1 |
   | `VITE_ORG_NAME` | full org name in English |
   | `VITE_ORG_SHORT` | 2-4 letter code (e.g. `ABC`) — must match `member_code_prefix` from Phase 2 |
   | `VITE_ORG_NAME_NATIVE` | name in native script (Assamese / Hindi / Bengali) |
   | `VITE_ORG_TAGLINE` | one-line tagline |
   | `VITE_ORG_CURRENCY` | usually `INR` |
   | `VITE_ORG_CURRENCY_LOCALE` | usually `en-IN` |

5. **Deploy**. Watch the build logs — first build takes ~2 min.
6. Once green, click the deployment URL — you should see the landing page.

### Phase 6 — Custom domain (optional, ~10 min)

In the new Vercel project → **Settings → Domains** → add the client's domain
(e.g. `app.client-name.com`). Follow Vercel's DNS instructions.

### Phase 7 — Landing page content (~30 min, only if needed)

The landing page at `src/components/LandingPage.tsx` has **hardcoded content**:
- Founders' names + phone numbers
- Office address
- Assamese text throughout
- Logo image URL (currently hosted on i.ibb.co)

For a new client this needs to be edited. See
[`branding-customization.md`](./branding-customization.md) for the exact
locations and what to change.

> **Recommendation:** make this a separate branch per client if the customization
> is large. Or keep the trunk generic and put client-specific content behind
> env-var-driven config (a small refactor for later).

### Phase 8 — Handover

- Send the client admin: login URL, email, starter password
- Tell them to **change the password immediately** (Settings → Profile)
- Quick 20-min training: add members, record installments, view reports

---

## Repeat onboarding (after the first time)

Use [`CHECKLIST.md`](./CHECKLIST.md). It's a one-page version of this guide.

## What ISN'T automated yet (future improvements)

- Bash/Node script that does Phase 1-4 in one command via Supabase CLI + Vercel CLI
- Branding moved fully into the `settings` table (currently env vars handle most of it, but landing page is still hardcoded)
- Multi-tenant rewrite (one DB, many orgs) — only consider this after 5+ clients

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login works but admin features 403 | Profile row missing or `role != 'admin'` |
| "Member with this email already registered" on create | Old auth user not cleaned up — the Edge Function handles this; check it was deployed |
| Photos don't load in profile | `member-photos` bucket not public or storage policy missing — re-run `sql/02-storage.sql` |
| Member code starts with `EUS/...` instead of client prefix | `app_text_settings.member_code_prefix` not set — re-run `sql/03-initial-data.sql` after editing |
| Vercel build fails | Check env vars are set, particularly `VITE_SUPABASE_URL` |

---

**You can fully understand what to do for a new client by reading just this file
+ the linked files in this folder. No prior conversation context required.**
