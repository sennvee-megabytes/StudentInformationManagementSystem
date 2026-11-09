# Student Information Management System (SIMS)

A centralized, role-based web application for managing student records, enrollment, courses/sections, and activity logs. Designed for **Cavite State University – Don Severino de las Alas Campus (CEIT)** as an Information Assurance and Security (IAS) project.

Full architectural and security documentation is located in [docs/SDD.md](docs/SDD.md).

---

## Key Features & Security Controls

| Module / Control | Implementation |
|---|---|
| **Roles (RBAC)** | **Student** (self-service), **Staff / Registrar**, and **Administrator** enforced in services via `requirePermission()` and `requirePageRole()`. |
| **Password Hashing (S1)** | `bcryptjs` (cost 12), 72-byte limit enforcement, timing-equalized verification against a dummy hash for unknown users, common-password & username-similarity checks. |
| **Authentication & Lockout (S2)** | Generic `401` responses, forced password change on first sign-in (`must_change_password`), automatic 15-minute lockout after 5 consecutive failed logins (`ACCOUNT_LOCKED`). |
| **Session Management (S7)** | 256-bit random token in `HttpOnly; Secure; SameSite=Lax` cookie (`__Host-sims_sid` in production); only SHA-256 hash stored in PostgreSQL; 20-minute sliding idle timeout + 8-hour absolute lifetime; token rotation on login; bulk revocation on password change or account deactivation; `SESSION_TIMEOUT` audit logging. |
| **Input & CSRF Protection (S5/S6)** | Parameterized Prisma queries, allow-listed sort columns, `.strict()` Zod schemas (rejecting mass-assignment attempts), `Origin`/`Host` verification on all mutating requests, and CSV formula-injection neutralization. |
| **Immutable Activity Logs (S8/S10)** | Append-only `audit_logs` table protected by PostgreSQL `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` triggers ([prisma/hardening.sql](prisma/hardening.sql)), with automatic sensitive-field redaction. |
| **Data Integrity (S10)** | Transactional student registration + account provisioning, optimistic concurrency locking (`version`), soft deletion (`deleted_at`), self-demotion and last-active-admin guards. |

---

## Local Development Setup

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database (local Docker Postgres or a [Neon](https://neon.tech) branch)

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `DIRECT_URL`, `SEED_ADMIN_USERNAME`, and `SEED_ADMIN_PASSWORD`.

### 3. Apply Schema, Hardening SQL & Seed First Admin

```bash
npm install
npx prisma migrate dev --name init
# Apply the CHECK constraints and append-only audit_logs trigger:
npx prisma db execute --file prisma/hardening.sql --schema prisma/schema.prisma
# Seed the initial Administrator account (and optional demo programs if SEED_DEMO_DATA="true"):
npm run db:seed
```

### 4. Start the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000/login` and sign in with your seeded administrator credentials. You will be prompted to set a new personal password on first sign-in.

---

## Verification & Testing

```bash
# TypeScript strict type checking
npm run typecheck

# Unit & service security test suite (Vitest)
npm test
```

---

## Deploying to Vercel (with Neon PostgreSQL)

1. Create a Neon project in `ap-southeast-1` (Singapore) and copy both the **pooled** connection string (`DATABASE_URL`) and **direct** connection string (`DIRECT_URL`).
2. Push this repository to GitHub and import it into Vercel.
3. Configure the environment variables from [.env.example](.env.example) in Vercel (`DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `CRON_SECRET`, `FEATURE_ACADEMIC_RECORDS`).
4. Set the Vercel Build Command to:
   ```bash
   prisma migrate deploy && next build
   ```
5. After the first deployment, apply `prisma/hardening.sql` and run `npm run db:seed` once against your production `DIRECT_URL`, then sign in and change the initial administrator password.
