# Per-Client Branding Customization

Most of the per-client branding (org name, currency, etc.) is **env-var driven**
via Vercel — no code edits needed. A few things are still hardcoded in source
files and require a code edit or a per-client branch.

## What's env-driven (set in Vercel, no code edit)

| Variable | Default | What it controls |
|---|---|---|
| `VITE_ORG_NAME` | `Ekata Unnayan Sanstha` | Full English name (used in modal headers) |
| `VITE_ORG_SHORT` | `EUS` | Short code (also used in PDF filenames) |
| `VITE_ORG_NAME_NATIVE` | `একতা উন্নয়ন সংস্থা` | Native-script display name |
| `VITE_ORG_TAGLINE` | `Member-owned cooperative savings` | One-line tagline |
| `VITE_ORG_CURRENCY` | `INR` | ISO-4217 currency code (used by Intl) |
| `VITE_ORG_CURRENCY_LOCALE` | `en-IN` | Locale for number formatting |
| `VITE_ORG_CURRENCY_SYMBOL` | `₹` | Symbol used in static text |
| `VITE_MEMBER_EMAIL_DOMAIN` | `members.local` | Synthetic email domain for member logins |

These are all consumed in `src/config/branding.ts`.

> **Important:** `VITE_ORG_SHORT` is **only** used in the frontend (e.g. PDF
> filenames). The member-code prefix in the **database** is a separate setting
> in `app_text_settings.member_code_prefix` — keep them in sync manually.

## What requires a code edit per client

### 1. Landing page content — `src/components/LandingPage.tsx`

This is the public-facing marketing page at the root URL. It has hardcoded:

- **Founders' names + phone numbers** (President, Secretary, Treasurer cards)
- **Office address** (Katpuha, Nalbari, Assam)
- **Year founded** (2026)
- **All Assamese / Bengali text** — the `as` (Assamese) translation object
  is the default; `en` (English) is the toggle
- **Logo image URL** (`https://i.ibb.co/xKRYj0f4/euslogo.png`)

For a client whose details differ, you have 3 options:

**Option A — Quick edit on a per-client branch** (easiest for 1-3 clients)
```bash
git checkout -b client-abc
# Edit LandingPage.tsx with the client's content
git commit -am "feat: ABC client landing page"
git push origin client-abc
# In Vercel project for ABC, set the production branch to client-abc
```

**Option B — Skip the landing page** (if the client only uses the admin/member portal)
- Keep `main` as-is
- Point the Vercel deployment at `/admin` or `/member` as the default route

**Option C — Move content into DB** (proper fix, ~2-3 hours work)
- Add `landing_page_content` rows to `app_text_settings`
- Refactor `LandingPage.tsx` to read from DB instead of hardcoded `content` object
- Build a simple admin UI to edit it
- **Recommended after 3+ clients**

### 2. Brand colors — Tailwind classes throughout

The four brand colors are repeated across ~20 components as Tailwind arbitrary
values:

| Hex | Where | Replace with |
|---|---|---|
| `#0b3b2f` | Primary darkest (header bg, modal headers) | Client's dark color |
| `#1e5a48` | Primary main (buttons, links, accents) | Client's main color |
| `#154033` | Primary hover (button hover state) | Client's hover color |
| `#f7b05e` | Accent (CTA buttons, highlights) | Client's accent color |

For a quick color swap on a per-client branch:

```bash
# In repo root, find/replace each hex code:
git ls-files | xargs sed -i 's/#0b3b2f/#YOUR_DARK/g'
git ls-files | xargs sed -i 's/#1e5a48/#YOUR_MAIN/g'
git ls-files | xargs sed -i 's/#154033/#YOUR_HOVER/g'
git ls-files | xargs sed -i 's/#f7b05e/#YOUR_ACCENT/g'
```

> Run `git diff --stat` after and double-check — you don't want the sed to
> have touched node_modules or unrelated files.

### 3. Favicon + page title — `index.html`

```html
<title>EUS — Cooperative Savings</title>
<link rel="icon" type="image/png" href="/favicon.png">
```

For a client, change the `<title>` and replace `public/favicon.png` with their
favicon.

### 4. Logo image

Currently `src/components/LandingPage.tsx` references an external URL:
```tsx
<img src="https://i.ibb.co/xKRYj0f4/euslogo.png" ... />
```

For a new client:
1. Either upload their logo to the Supabase Storage bucket and use that URL
2. Or put the logo in `public/logo.png` and reference it as `/logo.png`

## Workflow recommendation

For your **first 1-3 clients**, do this manually on per-client branches:

```
main                    (EUS — your default)
├── client-abc          (ABC Society — their fork)
├── client-xyz          (XYZ Sangha — their fork)
└── ...
```

Each client's Vercel project deploys from their own branch. When you fix bugs,
merge `main` → each client branch. Yes, this becomes painful around 5+ clients
— that's the point at which you should do the "Option C" refactor above.

For **anything more than 5 clients**, consider:
- Multi-tenant rewrite (one Supabase, one Vercel, `org_id` everywhere) — major work
- Or a CMS-driven landing page (Sanity / Notion as a backend for the marketing page)
