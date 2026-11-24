# Student Accommodation Platform

Monorepo for the student residence platform: student app (Expo), landlord + super admin web (Next.js), and the API.

```
apps/api         Fastify + TypeScript REST API
apps/mobile      Expo (SDK 58, Expo Router) student app — "ResLife"
apps/web         Next.js 16 landlord dashboard (+ super admin placeholder)
packages/db      Prisma schema, migrations, seed
packages/shared  zod schemas + enums shared by every app
e2e              Playwright end-to-end tests across mobile (web build) + dashboard
```

## Run it locally

Needs Node 20+, pnpm 9 and Docker (on macOS without Docker Desktop: `colima start`).

```bash
pnpm install
pnpm first-run      # once: .env, Docker services, database + demo data
pnpm dev            # API http://localhost:4000 + landlord dashboard http://localhost:3000
pnpm mobile         # student app, in a second terminal: press w for the browser, or scan the QR with Expo Go
```

- OTP emails (student sign-in codes): http://localhost:8025 (Mailpit). The API terminal also logs them in dev.
- S3 console: http://localhost:9001 (minio / minio12345)
- **Real phone (Expo Go):** run `pnpm phone-env` so the app and uploads use your computer's Wi-Fi IP, then restart
  `pnpm dev` and `pnpm mobile`. Phone and computer must be on the same Wi-Fi. Re-run it if your IP changes;
  `pnpm phone-env --reset` goes back to localhost.

- **Changed `packages/shared` or the Prisma schema?** Rebuild it (`pnpm --filter @students/shared build`,
  `pnpm db:migrate`) and restart `pnpm dev`; the dashboard keeps the old copy until it restarts.

### Browser support
The dashboard (and the student app's web build) target current browsers: Chrome/Edge 111+, Firefox 128+,
Safari / iOS Safari 16.4+ — the Next.js 16 and Tailwind CSS 4 baselines.

### Seed accounts
| Role | Where | Login |
|---|---|---|
| Super admin | Dashboard | admin@resplatform.local / Password123! |
| Landlord (Campus Living Co.) | Dashboard | landlord@campusliving.local / Password123! |
| Student (UCT, NSFAS) | Mobile app | institution UCT, student no. `DLMSIP001`, email `sipho.student@myuct.ac.za` → OTP |

OTP requests are rate-limited to 5 per 15 minutes per IP, and one per minute per email.

## Tests

```bash
# API integration tests (real Postgres)
docker compose exec -T postgres psql -U students -c "CREATE DATABASE students_test;"   # once
pnpm --filter @students/db exec dotenv -v DATABASE_URL=postgresql://students:students@localhost:5432/students_test -- prisma migrate deploy
pnpm --filter @students/api test

# End-to-end (needs API, dashboard and `npx expo start --web` running; uses installed Google Chrome)
pnpm --filter @students/e2e test
```

The e2e test signs a new student up through the app, applies with documents, sends an offer from the dashboard
and accepts it in the app. Each run creates (then unpublishes) its own one-bed residence under the seeded landlord.

## How it fits together
- **Student identity:** student number + institution email domain + OTP. A student number can only ever be bound to one email.
- **Mobile app modes** (`apps/mobile/src/app/_layout.tsx`): signed out → sign-in; profile incomplete → profile setup;
  no accepted offer → *Discover* (residences, applications, account); accepted offer → the residence's branded space.
  `GET /me/residency` decides, and `src/app/index.tsx` redirects whenever that changes.
- **Discovery** shows only published residences from *verified* landlords linked to the student's institution.
- **Documents** upload straight to S3 with presigned URLs; landlords open them through short-lived links.
- **Dashboard auth:** httpOnly cookies; `src/proxy.ts` refreshes the access token before pages render and routes by role.
- **Tenant isolation:** landlord routes resolve the caller's organisation and return 404 for anything outside it.
- **Residence life:** landlords move residents in (pending lease → active), post announcements (optionally emailed),
  and work maintenance requests (assign, status, replies). Students report problems with photos once moved in, follow
  the thread and confirm fixes. Status changes notify the student in the app (`/me/notifications`).
- **Offer flow:** landlord accepts with a bed (row-locked, no overlapping leases) → student accepts → other open applications for that year are withdrawn.
- Money is integer cents (ZAR).
