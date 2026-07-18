# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"OSI Logistics" — a full-stack shipment tracking/dispatch platform with three user roles (admin,
dispatcher, driver), live GPS map tracking, load offers, a walkie-talkie radio feature, commission
billing, and driver/dispatcher onboarding+verification workflows. Monorepo: `backend/` (Express + TS +
Socket.io + libSQL/Turso) and `frontend/` (React + Vite + Tailwind + Leaflet + react-map-gl). Two
standalone embeddable widget files also live at the repo root (`announcement-bar.html`, `chat-widget.html`)
for pasting into a separate marketing site — `Project 2.0` holds a diverged copy of these two files.

## Commands

```bash
npm run install:all   # installs root, backend, and frontend deps
npm run dev            # concurrently runs backend (tsx watch, :3001) + frontend (vite, :5173)
npm run build           # delegates to `cd frontend && npm run build`

# backend/ (run from that dir, or via the root dev script)
npm run dev    # tsx watch src/index.ts
npm start       # tsx src/index.ts (no compiled build step — ships TS directly via tsx, even in prod Docker)

# frontend/
npm run dev
npm run build   # tsc && vite build
npm run preview
```

`start.bat` / `start.ps1` at the repo root are local convenience launchers (open two terminals + browser).
No test suite/framework exists in either package.

## Deployment — know which config is actually live

Three-plus deploy configs exist; **only two are wired up and live**:
- **Backend → Render** (`render.yaml`, root): Docker runtime, `rootDir: backend`, health check
  `/api/health`. Confirmed live by: `backend/src/index.ts`'s hardcoded keep-alive self-ping URL
  (`https://osi-logistics-backend.onrender.com`, a Render free-tier "prevent cold sleep" hack, pings
  every 14 min), and the frontend's hardcoded `PROD_BACKEND` URL in `services/api.ts`/`socket.ts`.
- **Frontend → Vercel** (`vercel.json` at root + in `frontend/`), live at `https://osi-logistics.vercel.app`.
  `deploy.bat` is the one-shot deploy script: commits+pushes, then `cd frontend && vercel --prod --yes`.
- `backend/fly.toml`, `backend/railway.toml`, `backend/nixpacks.toml` are **unused leftover/exploratory
  configs** — no deploy script references them. Don't assume they're current; ask before "fixing" them.

## Architecture

### Backend (`backend/src/`) — no ORM, raw SQL via libSQL

Entry point `index.ts` wires: Express + Socket.io sharing one HTTP server, a hardcoded CORS allow-list
(`localhost:*`, `osilogistics.com`, plus any `*.vercel.app` origin via regex) `/api/auth` and `/api/chat`
public, everything else (`orders`, `drivers`, `trucks`, `tracking`, `analytics`, `notifications`, `admin`,
`billing`) behind the `authenticate` middleware, and `/api/push` deliberately unauthenticated.

- **Data layer** (`database.ts`): `getDb()` uses Turso (remote libSQL, `TURSO_URL`/`TURSO_AUTH_TOKEN`) with
  3x retry, falling back to local `file:./osi_logistics.db` on auth failure or after 3 attempts (fallback
  mode loses data on redeploy). Schema is defined inline as `CREATE TABLE IF NOT EXISTS` plus an
  `addColumnIfMissing()` helper called repeatedly on every boot — **there is no migration file system**;
  schema changes are made by adding another `addColumnIfMissing()` call in `database.ts`, not a new
  migration file. `initDatabase()` also seeds demo trucks/drivers/orders/users on first run — this is
  sales-demo seed data, not test fixtures.
- **Auth**: custom bearer-token sessions (not JWT). `scryptSync` password hashing + `timingSafeEqual`,
  random 32-byte hex tokens in a `sessions` table with 7-day expiry, checked by `middleware/auth.ts`'s
  `authenticate()`. `requireRole('admin')` gates the whole `admin.ts` router. New users register with
  `approval_status='pending', active=0` — an admin must approve via `PUT /api/admin/users/:id/approve`
  before they can log in.
- **Built-in GPS simulation engine** (in `index.ts`): moves any driver whose email ends in
  `@osilogistics.com` (the demo drivers) along 5 hardcoded Miami polylines every 3s, writing to
  `drivers.current_lat/lng` + `tracking`, and has a small random chance per tick of auto-completing an
  `in_transit` order — this is what makes the live map/demo move without a real driver app. Real drivers
  update position via `POST /api/drivers/:id/location`.
- **Realtime**: one global `io` instance; routes emit into a shared `EventEmitter` (`events.ts`'s
  `appEvents`) which `index.ts` bridges into `io.to(room).emit(...)`. Rooms: `tracking`, `orders`,
  `dispatchers`, `driver:<id>`, `osi_radio`. Key events: `location_update`, `driver_status_changed`,
  `order_updated`, `driver:offer`/`driver:notification` (targeted per-driver), `radio:msg`/`radio:voice`
  (walkie-talkie, base64 audio capped at 2MB/60s). Gameplay/business logic never goes through Socket.io
  directly from a client mutation — clients call REST, the server emits the resulting event.
- **Commission billing**: on an order's status flipping to `delivered` (`routes/orders.ts`), a
  `commissions` row is auto-created — driver is charged 8% of order price, dispatcher is paid 5%, OSI nets
  the difference. Settled via `PUT /api/billing/:id/settle`.
- **Third-party integrations** (know the actual trigger, not just the dependency):
  - **Resend** (email) — `email.ts`, 5 templates each tied to a specific route (activation on admin
    approval, offer email on `POST /orders/:id/offer`, offer-accepted back to dispatcher, delivery email
    to both parties on `delivered`, verification codes).
  - **Textbelt** (SMS, *not* Twilio) — `sms.ts`, used for phone verification codes; falls back to email if
    SMS send fails. **`twilio` is a dependency in `package.json` but is never imported anywhere in
    `src/`** — dead dependency, don't assume SMS goes through it.
  - **Firebase Admin** — only used for one thing: verifying a client-side Firebase phone-OTP ID token
    against the user's profile phone (`POST /auth/confirm-phone-verified`). Not used for general auth.
  - **web-push** — `routes/push.ts` has a **hardcoded VAPID keypair in source** (not env-loaded) and an
    in-memory (non-persistent) subscriber list; triggered when a driver's status becomes `available`.
  - **Anthropic** (`routes/chat.ts`, model `claude-haiku-4-5-20251001`) — powers the "Sofia Reyes, Dispatch
    Specialist" persona backing `chat-widget.html`'s `/api/chat` endpoint.
- **Root-level scratch files, not config**: `backend/login.json` / `backend/tok.txt` / `backend/records.json`
  are leftover captured output from manual curl/Postman testing (a saved login response, its raw session
  token, and a stale 404 error page) — gitignored, safe to ignore or delete, not something the app reads.

### Frontend (`frontend/src/`)

No Redux/Zustand/React-Query — plain Context (`AuthContext`, `ThemeContext`) + local state + polling +
Socket.io push. `localStorage` holds `osi_token`/`osi_user`. Routing (react-router-dom) branches into three
guarded areas: `DriverGuard` → `/driver` renders `DriverPortal.tsx` (a large tabbed single-page app, not
further routed), `DispatcherGuard` → shared `Layout.tsx` wrapping `dashboard/orders/tracking/drivers/
fleet/reports/billing/commissions/hub/profile/settings`, and `AdminGuard`-wrapped `users/dispatchers/
verifications` nested inside that same layout.

`services/api.ts` is the single axios instance. **Its prod backend URL is hardcoded**
(`https://osi-logistics-backend.onrender.com/api`) — the declared `VITE_API_URL` env var is dead/unused,
don't expect changing it to have any effect. Dev mode proxies `/api` via Vite. `services/socket.ts` is
likewise a hardcoded-URL singleton.

**Maps — two libraries, both actively used, not redundant**: `react-leaflet`/`leaflet` powers the
dispatcher/admin flat 2D fleet map (`Tracking.tsx`) and a decorative world map (`WorldMapView.tsx`, polls
every 5s, not sockets). `react-map-gl`/`maplibre-gl` powers exactly one component, `Map3D.tsx` (pitched 3D
map with extruded buildings, free `openfreemap.org` tiles, no API key), used only inside `DriverPortal.tsx`
for the driver's own in-cab navigation view. Keep this split when touching either — don't consolidate onto
one library without asking, they serve genuinely different UI roles.

### Design tokens (`frontend/tailwind.config.js`)

Primary brand color is orange (`brand` scale, base `#f97316`) — in practice components mix this with
Tailwind's stock `orange-*` classes interchangeably (they're numerically near-identical), so match
`#f97316`-family orange for anything dispatcher/admin-facing. Admin-only chrome uses an inline purple
accent (`#a855f7`, not in the Tailwind config, hardcoded per-component) to visually distinguish it from
dispatcher views. Dark mode is class-based (`dark:` variants), with Tailwind's stock `slate` palette as the
dark-mode neutral convention. Font: Inter.

## The two root-level widget files are separate, unrelated to the app

`announcement-bar.html` and `chat-widget.html` are standalone, framework-free HTML/CSS/JS snippets meant
to be pasted into a *different* marketing/storefront site (not this app's own frontend) — `deploy.bat`
never touches them, they're not imported by `frontend/`. `chat-widget.html` does call the live backend's
`POST /api/chat`; `announcement-bar.html` is fully self-contained (client-side countdown timer only, no
backend calls). `Project 2.0` has a diverged copy of both — check there before assuming this copy is the
only/latest version.
