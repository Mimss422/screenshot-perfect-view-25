# Home Health — Version 1.0 Snapshot Report

- **Project Version:** 1.0.0 (tag name to use: `v1.0.0-home-health-stable`)
- **Project Name:** Home Health — Staff Payroll & Attendance
- **Snapshot Date:** 2026-08-15
- **Status:** Protected stable baseline. Do not overwrite; future work must be a new version/branch.

## 1. Current Features (implemented modules)

| Module | Route / File | What it does |
| --- | --- | --- |
| Landing page | `src/routes/index.tsx` | Public intro + role-based redirect (admin → `/admin`, staff → `/clock`) |
| Authentication | `src/routes/auth.tsx`, `src/hooks/useAuth.tsx` | Email/password sign in + sign up with role selection; session and role context |
| Staff clock in/out | `src/routes/clock.tsx` | Camera photo capture, GPS coordinates, daily notes, offline queue with sync |
| Admin shell | `src/routes/admin.tsx` | Admin-only layout, nav, access guard, sign out |
| Live monitoring | `src/routes/admin.index.tsx` | Today's attendance feed + Leaflet map of staff locations |
| Staff map | `src/components/StaffMap.tsx` | Leaflet map markers for punches |
| Staff management | `src/routes/admin.staff.tsx` | Create/edit staff, salary structures, Active/Archived tabs, restore, auto-generated passcodes |
| Staff profile | `src/routes/admin.staff_.$id.tsx` | Per-staff stats + weekly/monthly notes history |
| Payroll | `src/routes/admin.payroll.tsx` | Period payroll generation, split deductions, printable receipts |
| Expenses | `src/routes/admin.expenses.tsx` | Monthly payroll cost trends (Recharts) |
| Payroll engine | `src/lib/payroll.ts` | Gross pay by rate/visit, daily rate, fixed monthly; net = gross − cash advance − late deduction; late = clock-in at/after 08:00 |

## 2. User Roles

`app_role` enum: `admin`, `doctor`, `nurse`, `caregiver`.

- **admin** — full access to all admin routes, staff CRUD, payroll, deductions, all attendance data.
- **doctor / nurse / caregiver (staff)** — access to `/clock` only; can read their own employee row, insert and read their own attendance logs and notes, read their own deductions and payroll records.

Roles are stored in the separate `user_roles` table and checked through the security-definer function `has_role()` (never on the profile row).

## 3. Technology Stack

- TanStack Start v1 (React 19, TanStack Router file routes, TanStack Query)
- Vite 8, TypeScript 5.8
- Tailwind CSS v4 (`src/styles.css`, medical palette, Plus Jakarta Sans)
- shadcn/ui + Radix primitives, lucide-react icons, sonner toasts
- Lovable Cloud backend (Postgres + Auth + Storage) via `@supabase/supabase-js`
- Leaflet 1.9 (maps), Recharts 2 (charts), date-fns, zod, react-hook-form

## 4. Database Structure (baseline)

Enums: `app_role`, `punch_type` (IN/OUT), `salary_structure` (rate_per_visit / daily_rate / fixed_monthly).

| Table | Key fields |
| --- | --- |
| `profiles` | id → auth user, full_name, email, phone |
| `user_roles` | user_id, role (unique per pair) |
| `employees` | user_id, full_name, role, salary_structure, rate_per_visit, daily_rate, fixed_monthly, late_deduction, pay_periods, contact, active, archived_at, passcode_hash, passcode_set_at |
| `attendance_logs` | user_id, employee_id, type, logged_at, latitude, longitude, photo_url, note, sync_status, approved |
| `daily_notes` | user_id, employee_id, note_text |
| `deductions` | employee_id, kind (`cash_advance` / `late`), amount, note, effective_date |
| `payroll_records` | employee_id, period_start, period_end, days_worked, visits, lates, gross_pay, cash_advance, late_deduction, total_deductions, net_pay |

Functions: `handle_new_user()` (trigger on signup), `has_role()`, `set_staff_passcode()`, `verify_staff_passcode()` — all security definer.

Storage: private bucket `attendance` for verification photos.

RLS: enabled on every table; admins have full access via `has_role(auth.uid(),'admin')`, staff limited to their own rows.

Baseline migration files (do not edit — new changes go in new migrations):

- `supabase/migrations/20260812134416_9ac535c9-2c6c-44d9-9145-5f6058aad4dc.sql`
- `supabase/migrations/20260812134437_7aefddac-0a20-49d8-9d15-96e6542201ef.sql`
- `supabase/migrations/20260814082547_0475225a-f511-47a0-9eca-52b27a7a74b2.sql`

## 5. Environment Requirements

Managed automatically by Lovable Cloud in `.env` (do not hand-edit):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (+ server-side equivalents).
Local dev: Node 20+/Bun, `npm i`, `npm run dev` (port 8080). Browser needs camera + location permission for `/clock`.

## 6. API / Endpoints

There are **no custom HTTP API routes or edge functions** in v1.0. All data access is direct from the browser to Lovable Cloud through the generated client (`src/integrations/supabase/client.ts`) with RLS enforcement, plus RPC calls to `set_staff_passcode` / `verify_staff_passcode`. Auth middleware helpers exist (`auth-middleware.ts`, `auth-attacher.ts`, registered in `src/start.ts`) but no protected server functions are defined yet.

## 7. Authentication Flow

1. User signs up on `/auth` with name, role, email, password.
2. Signup trigger `handle_new_user()` creates a `profiles` row, a `user_roles` row, and an `employees` row.
3. `AuthProvider` (`src/hooks/useAuth.tsx`) listens to auth state, loads the role from `user_roles`.
4. `/admin` layout redirects non-admins to `/clock`; unauthenticated users go to `/auth`.
5. Sign out clears the session and returns to the public landing page.

## 8. Major Workflows

- **Clock in/out:** staff opens `/clock` → capture live photo → GPS captured → punch saved (queued locally and synced when offline) → appears in admin live feed and map.
- **Daily notes:** staff writes a note during a shift → stored in `daily_notes` → visible in the staff profile history grouped weekly/monthly.
- **Staff onboarding:** admin creates staff with salary structure → system generates a passcode shown once → passcode hash stored.
- **Payroll run:** admin picks a period → engine counts days/visits/lates → computes gross → subtracts cash advance and late deduction → saves `payroll_records` → printable receipt.
- **Expense review:** admin views monthly payroll cost trend charts.

## 9. Known Issues / Limitations (v1.0)

- Passcode verification is not yet wired into the staff clock-in flow (function exists, UI does not use it).
- Attendance logs are auto-approved; no manual review or edit/correction workflow.
- No password reset or email verification flow; anyone can self-register and pick the admin role at signup.
- No pagination on attendance/staff lists; large datasets may slow the dashboard.
- Offline queue is per-browser (localStorage); clearing site data loses unsynced punches.
- Photos are stored in a private bucket without automatic retention/cleanup.
- No native mobile app; `/clock` is a mobile-friendly web page only.
- No automated tests.

## 10. Backup / Restore Method

**A. Lovable version history (simplest, already active).**
Every change is snapshotted automatically. Open the version history panel in the editor, find the entry for this message ("Version 1.0 baseline"), and use *Restore* to return the whole project to this exact state. Bookmark/rename that entry as `v1.0.0-home-health-stable`.

**B. Git (recommended for a permanent tag).**
The project is a Git repository. Connect it to GitHub from the Lovable editor (GitHub → Connect), then in your local clone run:

```sh
git clone <your-repo-url> && cd <repo>
git tag -a v1.0.0-home-health-stable -m "Home Health stable web version 1.0"
git push origin v1.0.0-home-health-stable
# optional protected branch
git branch v1.0-stable && git push origin v1.0-stable
```

Restore later with `git checkout v1.0.0-home-health-stable` (or open a new branch from that tag).
Git commands are intentionally not executed from inside Lovable — repository state is managed by the platform, so create the tag from your own machine or from GitHub's Releases page.

**C. Manual file backup.**
Editor → GitHub/Download → export the project ZIP and store it as `home-health-v1.0.0.zip`. This is the beginner-friendly fallback: restoring means re-uploading that ZIP's contents.

**D. Database backup.**
The three migration files above fully recreate the v1.0 schema on an empty project. For data, export each table to CSV from the backend data view before any risky change. Never rewrite an applied migration — always add a new one.

## 11. What Must Not Be Changed in the Stable Version

- The three baseline migration files, and the shape of existing tables/enums/columns (add new migrations instead of altering v1.0 ones).
- The security-definer functions `has_role`, `set_staff_passcode`, `verify_staff_passcode`, `handle_new_user`, and the role-in-separate-table design.
- Existing RLS policies (tighten via new policies; do not delete the admin/own-row rules).
- Auto-generated files: `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`, `.env`, `supabase/config.toml`, `src/routeTree.gen.ts`.
- Route paths `/`, `/auth`, `/clock`, `/admin`, `/admin/staff`, `/admin/staff/$id`, `/admin/payroll`, `/admin/expenses` — renaming breaks bookmarks and guards.
- Payroll math in `src/lib/payroll.ts` (gross rules, late threshold 08:00, net = gross − cash advance − late deduction).
- The `attendance` storage bucket name and its private setting.

## 12. Version Record

| Field | Value |
| --- | --- |
| Version | 1.0.0 |
| Codename | Home Health Stable Web Version |
| Date | 2026-08-15 |
| Scope | Admin dashboard + staff web clock-in |
| Stack | TanStack Start / React 19 / Tailwind v4 / Lovable Cloud (Postgres) |
| Files in scope | `src/routes/*`, `src/components/StaffMap.tsx` + `src/components/ui/*`, `src/hooks/*`, `src/lib/payroll.ts`, `src/styles.css`, `supabase/migrations/*`, config files at repo root |
| Next version | Any new feature, redesign, or mobile app = v1.1+ on a separate branch |