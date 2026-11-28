# cojam-admin

The Cojam Daily Prediction admin (`admin.cojam.app`, desktop only, English only). A port of the approved design in
`platform/design/admin/` wired to the admin API (`/admin/v1/*`, `platform/api`).

Stack: Vite, React 18, TypeScript, React Router, TanStack Query, `@privy-io/react-auth` (the separate admin Privy app,
email login only), viem for the owner wallet. `src/styles/admin.css` and `tokens.css` are the design files copied
unchanged; `src/lib/x.ts` and `src/lib/ui.ts` port `admin.js` line for line, and every screen in `src/screens/` ports
its `pages/*.js` so the markup and class names match.

## Run

```
npm install
cp .env.example .env.local        # VITE_API_URL, VITE_PRIVY_ADMIN_APP_ID
npm run dev                       # http://localhost:5190
npm run dev:mock                  # the design's mock data, every ?state= preset, /hub lists them
npm run build                     # tsc and vite build into dist/
```

Local work against a real API (`platform/api`, `AUTH_DEV_BYPASS=1`, `DEV_CHAIN=stub`, seeded with `npm run dev:seed`):

```
VITE_API_URL=http://localhost:8080 VITE_DEV_ADMIN=dev@cojam.app npm run dev
```

`VITE_DEV_ADMIN` sends `X-Dev-Admin` instead of a Privy token. `vite build` removes that code path, and the API refuses
the header when `NODE_ENV=production`. The API must list the admin origin in `ALLOWED_ORIGINS`.

## How it works

* **View models.** Each screen renders one object shaped like the design's `window.AD` (`data.js`). Mock mode passes the
  design data itself (`?state=`, `?env=kairos`, `?role=viewer|owner` work as in the prototype); live mode builds the
  same shape from the API (the `live*` function at the bottom of each screen). Live loading and errors use the design's
  own `loading` and `error` states.
* **Writes.** Every write opens the design's confirmation sheet with the required note (written to `audit_log` by the
  API). The red destructive button appears only inside confirmations. A failed write stays in the sheet with the error.
* **Owner actions** (reward proposal, apply, cancel, staking setters, reserve and rewards withdrawal, corrected outcome
  after the window): the API returns an unsigned transaction; `src/wallet/` finds the browser wallet through EIP-6963,
  checks the account is the contract owner and the chain id, sends it, waits for the receipt and records the hash with
  `POST /admin/v1/owner-tx`. No key is ever handled here.
* **Session.** Signed out after 30 minutes without activity. An email that is not on `admin_users` is refused after the
  code step and signed out again.

## Checks

`e2e/` (Playwright, Chromium preinstalled, captures in `captures/`, gitignored):

* `walk-mock.cjs`: every screen and state at 1440x900 and 1280x800, console errors and horizontal overflow, the phone
  message under 900 px, and app versus prototype captures; `sidebyside.py` joins them and prints the pixel difference.
* `walk-live.cjs`: drives every listed write through the UI against a local API and checks the audit log.
* `owner-flow.cjs`: the owner signing sheet with a stand in EIP-6963 wallet (wrong account refusal, propose, hash in the audit).
