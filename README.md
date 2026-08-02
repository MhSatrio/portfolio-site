# Muhammad Satrio — Portfolio

Static HTML/CSS/JS site (no framework, no build step for the pages themselves)
deployed on Vercel, plus a TypeScript visitor-analytics backend running as
Vercel Serverless Functions under `/api`, and a password-protected admin
dashboard at `/admin`.

Live: https://muhammadsatrio.vercel.app

## Run the static site locally

Open `index.html` directly in a browser, or serve it:

```
npx serve .
```

(`/api` functions and `/admin` need a real Vercel deploy or `vercel dev` — see below.)

## Deploy

```
npm install
npm run build:client   # compiles src/tracking.ts -> js/tracking.js and admin-src/dashboard.ts -> admin/dashboard.js
vercel --prod
```

**After every prod deploy, re-point the custom alias** — Vercel only
auto-updates its own generated `*-<hash>-muhammad-satrio.vercel.app` /
`portfolio-site-snowy-six.vercel.app` domains, not the custom
`muhammadsatrio.vercel.app` alias:

```
vercel alias set <new-deployment-url> muhammadsatrio.vercel.app
```

## Updating content

- Experience/project copy lives directly in `index.html`, grouped by company under `<section id="experience">`.
- Skill badges are in `<section id="skills">`.
- Swap the resume or marketing portfolio PDF by replacing the files in `assets/docs/` (keep the same filenames, or update the `href`s in `index.html`).
- The portrait is `assets/images/portrait.jpg`.

---

## Visitor Analytics

Architecture: browser → `src/tracking.ts` (compiled to `js/tracking.js`) →
`POST /api/track` → Google Sheets (via a service account) → `GET
/api/admin/data` → the dashboard at `/admin` (password-gated, reads live from
the sheet — no separate database).

```
api/track.ts                 Validates, rate-limits, geo/UA-enriches, computes
                              visitor state, appends a row, sends the one
                              per-session email.
api/admin/{login,logout,data}.ts   Password check + signed session cookie;
                              data.ts reads the sheet and returns aggregated
                              dashboard JSON.
services/googleSheets.ts     Sheets API client, header/append/read helpers,
                              returning-visitor + visit-count logic.
services/email.ts            Nodemailer/Gmail SMTP for the single
                              "new session" notification email.
services/validation.ts       zod schema + spreadsheet-formula-injection guard.
services/analytics.ts        Pure functions: sheet rows -> dashboard
                              aggregates (totals, time series, distributions).
services/adminAuth.ts        HMAC session cookie (keyed by ADMIN_PASSWORD,
                              no separate secret needed).
types/tracking.ts            Shared types + the sheet's column layout.
src/tracking.ts               Client tracker (visitor/session IDs, click
                              classification, duration, UTM capture).
admin-src/dashboard.ts        Admin dashboard client (Chart.js via CDN,
                              vanilla TS, no bundler).
scripts/setup-sheet.ts        One-off local script: verifies the service
                              account can reach a sheet you created and
                              shared with it, then writes the header row.
```

### Required environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Notes |
|---|---|
| `GOOGLE_PROJECT_ID` | From the service-account JSON key's `project_id`. |
| `GOOGLE_CLIENT_EMAIL` | From the key's `client_email`. |
| `GOOGLE_PRIVATE_KEY` | From the key's `private_key` — paste with real newlines or `\n` escapes, both are handled. |
| `GOOGLE_SHEET_ID` | The ID from the sheet's URL (`.../d/<THIS>/edit`). |
| `ADMIN_PASSWORD` | Password for `/admin`. Also used to key the session-cookie HMAC — changing it invalidates all logged-in sessions. |
| `EMAIL_PROVIDER` | `gmail`. |
| `EMAIL_USERNAME` | Gmail address to send from. **Optional** — see below. |
| `EMAIL_PASSWORD` | A Gmail **App Password**, not your real password. **Optional** — see below. |

`.env.example` documents the same list for local reference (never commit a
real `.env`).

### One-time Google Sheet setup

Service accounts on personal (non-Workspace) GCP projects have **zero Drive
storage quota** — they cannot create/own a new spreadsheet themselves. Create
it yourself instead, then hand it to the service account:

1. sheets.google.com → **Blank spreadsheet** → rename it however you like.
2. **Share** → add the service account's `client_email` (from the JSON key) as **Editor**.
3. **Important:** if the sheet was created via the newer "Blank spreadsheet"
   flow, Google may auto-convert it into a structured **Table** object with
   generic "Column 1..N" headers and ~200 pre-allocated empty rows. This
   breaks both the header check and the plain-grid `values.append` calls this
   backend relies on. If you see "Column 1" style headers, remove the table
   first (Right-click the table → Delete table, or via the API:
   `spreadsheets.batchUpdate` with a `deleteTable` request) and clear the
   sheet before continuing.
4. Copy the Sheet ID from the URL and set `GOOGLE_SHEET_ID`.
5. Run `npm run setup:sheet -- <SHEET_ID>` locally (reads the downloaded
   service-account JSON key from `~/Downloads/` by default — edit the
   `KEY_FILE` constant in `scripts/setup-sheet.ts` if yours lives elsewhere)
   to verify access and write the real header row.
6. Also enable the **Google Sheets API** and **Google Drive API** for the
   GCP project the service account belongs to (Cloud Console → APIs &
   Services) — a fresh service-account project has neither enabled by
   default, and the service account itself doesn't have permission to
   self-enable them.

### Enabling the notification email

Left unconfigured on purpose. Until `EMAIL_USERNAME`/`EMAIL_PASSWORD` are
set, every new-session row records `Email Status = "Not Configured"` and no
SMTP is attempted — this is expected, not an error. To turn it on:

1. Turn on 2-Step Verification on the sending Gmail account (required for App Passwords).
2. Google Account → Security → 2-Step Verification → **App passwords** → generate one for "Mail".
3. Set `EMAIL_USERNAME` (the Gmail address) and `EMAIL_PASSWORD` (the 16-character app password, no spaces) as Vercel env vars.
4. Redeploy (`vercel --prod`) — env var changes only take effect on a new deployment, not retroactively on the current one.

### Notes on the design

- **Rate limiting** on `/api/track` and `/api/admin/login` is a best-effort,
  in-memory, per-lambda-instance token bucket — it resets on cold start and
  isn't shared across concurrent instances. Adequate for a personal
  portfolio's traffic; not a substitute for a real edge rate limiter at
  scale.
- **Sheet reads scale linearly** — `getAllRows()` fetches the whole sheet on
  every `/api/track` call (to compute returning-visitor/visit-count) and
  every `/admin` refresh. Fine into the tens of thousands of rows; revisit
  with a smaller indexed read if this ever becomes a personal-scale project's
  bottleneck (unlikely).
- **No "Project" column** in the sheet schema (per the original spec) —
  `project_open` events store the project name in the `Button` column, same
  slot other click labels use.
- Data-project attribution for the Featured Projects cards comes from
  `data-project="..."` attributes on the cards in `index.html`; clicking
  anywhere on a card (or its links) fires a `project_open` event with that
  project's name.
