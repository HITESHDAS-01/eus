# Deploy Edge Functions

The app needs **3 Supabase Edge Functions** to work. They run server-side with
the service role key so the browser never has to.

| Function | Why it exists |
|---|---|
| `admin-create-member` | Browser can't create `auth.users` rows without signing the new user in (which would log the admin out). This function uses the service-role key to do it safely. |
| `admin-delete-member` | Same reason in reverse — clean removal of auth user + profile + member rows. **Optional**: the admin Members page falls back to direct DB delete if this function is missing, so you can skip it if you don't need the auth-user cleanup. |
| `admin-reset-member-password` | Admin needs to reset a member's password without knowing the old one. Browser can't call `auth.admin.updateUserById` — this function does it. |

## Where the source code lives

In this repo:

```
supabase/functions/
├── admin-create-member/
│   └── index.ts
└── admin-reset-member-password/
    └── index.ts
```

`admin-delete-member` is currently not in the repo — the Members page uses a
direct DB delete fallback. If you want the proper Edge Function version,
contact the original author.

## Deploy via Supabase Dashboard (recommended for non-CLI users)

For each function:

1. Supabase Dashboard → **Edge Functions** → **Create a new function**
2. Name: enter the exact name from the table above (must match `supabase/functions/<name>/`)
3. Copy the entire content of `supabase/functions/<name>/index.ts` from the repo
4. Paste into the Dashboard's code editor
5. Click **Deploy function**

Repeat for each function you need.

### Environment variables

The Edge Functions read these from the Supabase environment — they are set
automatically by Supabase, you don't need to add them manually:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optionally, if you want to override the synthetic-email domain for member logins
(default is `members.local`), set this **secret** in the function's settings:

- `MEMBER_EMAIL_DOMAIN` = e.g. `client-name.local`

> ⚠️ If you change this, also set `VITE_MEMBER_EMAIL_DOMAIN` in Vercel to the same
> value (used by `src/config/branding.ts`).

## Deploy via Supabase CLI (faster, scriptable)

If you have the Supabase CLI installed and linked to the client's project:

```bash
cd "<repo-root>"
supabase functions deploy admin-create-member         --project-ref <new-project-ref>
supabase functions deploy admin-reset-member-password --project-ref <new-project-ref>
```

## How to verify they work

1. Log in as the admin user (created via `sql/03-initial-data.sql`).
2. Go to **Members → Add New Member**.
3. Fill the form, click Create.
4. If you see "Member XYZ created" with credentials shown — `admin-create-member`
   works.
5. Edit that member, fill the "Reset Password" field, save.
6. If you see "Member updated. New password: ..." — `admin-reset-member-password`
   works.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "function not found (404)" when creating a member | `admin-create-member` not deployed yet |
| "Forbidden: admins only" | The logged-in user's `profiles.role` is not `'admin'` |
| "A user with this email address has already been registered" | An old auth user wasn't cleaned up during a previous delete. The Edge Function auto-detects and retries — make sure you deployed the latest version. |
| Password reset shows "function not found" | `admin-reset-member-password` not deployed yet |
