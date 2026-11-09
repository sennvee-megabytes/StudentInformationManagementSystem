# Software Design Document (SDD)

## Student Information Management System (SIMS)

| | |
|---|---|
| **Institution** | Cavite State University – Don Severino de las Alas Campus, Indang, Cavite |
| **College** | College of Engineering and Information Technology |
| **Course context** | Information Assurance and Security (IAS) project |
| **Document version** | 1.0 (Draft for review) |
| **Date** | November 9, 2026 |
| **Prepared by** | _[Team member names]_ |
| **Source specification** | *Student Information Management System* project brief (Sections A–G) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Architectural Design](#3-architectural-design)
4. [Data Design](#4-data-design)
5. [Component and Module Design](#5-component-and-module-design)
6. [API Design](#6-api-design)
7. [User Interface Design](#7-user-interface-design)
8. [Security Design](#8-security-design)
9. [Key Workflows](#9-key-workflows)
10. [Deployment Design (Vercel)](#10-deployment-design-vercel)
11. [Testing Strategy](#11-testing-strategy)
12. [Traceability Matrix](#12-traceability-matrix)
13. [Risks, Limitations, and Future Work](#13-risks-limitations-and-future-work)
14. [Implementation Plan](#14-implementation-plan)
- [Appendix A – Prisma Schema](#appendix-a--prisma-schema)
- [Appendix B – SQL Hardening Migration](#appendix-b--sql-hardening-migration)
- [Appendix C – Environment Variables](#appendix-c--environment-variables)
- [Appendix D – Reference Code for Security-Critical Modules](#appendix-d--reference-code-for-security-critical-modules)
- [Appendix E – Configuration Files](#appendix-e--configuration-files)

---

## 1. Introduction

### 1.1 Purpose

This document describes the software design of the **Student Information Management System (SIMS)**, a web-based application that lets a school manage student records in a centralized, secured database. It translates the project brief into a concrete, implementable design: architecture, database schema, module and API design, security controls, and a deployment plan targeting **Vercel** with a **managed PostgreSQL** database.

Intended readers: the development team, the course adviser/panel, and anyone who will deploy, test, or maintain the system.

### 1.2 Scope

**In scope**

- Centralized student record management (registration, update, soft deletion, search, filtering).
- Management of programs (courses), year levels, and sections.
- Enrollment information and student placement into program / year level / section.
- Three role-based modules: **Student**, **Staff / Registrar**, and **Administrator**.
- Account management (create, activate, deactivate, reset password, role assignment).
- Report generation (student lists and student information reports).
- Security controls required by the brief: password hashing, authentication, RBAC, confidentiality, SQL-injection prevention, input validation, session management, activity logs, account management, data integrity.
- Production deployment on Vercel with a real, persistent PostgreSQL database.

**Out of scope (for this version)**

- Online payment, grade computation engines, class scheduling, LMS integration.
- Native mobile applications (the web UI is responsive instead).
- Email/SMS delivery (password resets are performed by an administrator in v1.0).
- Multi-campus / multi-tenant operation.

### 1.3 Definitions and Acronyms

| Term | Meaning |
|---|---|
| SIMS | Student Information Management System |
| SDD | Software Design Document |
| RBAC | Role-Based Access Control |
| IDOR | Insecure Direct Object Reference (accessing another user's record by changing an ID) |
| CSRF | Cross-Site Request Forgery |
| XSS | Cross-Site Scripting |
| ORM | Object-Relational Mapper (Prisma) |
| DAL | Data Access Layer: the only code allowed to talk to the database |
| PII | Personally Identifiable Information |
| PITR | Point-in-Time Recovery |
| Registrar / Staff | School personnel who register students and manage enrollment |
| Soft delete | Marking a record as deleted (`deleted_at`) instead of physically removing it |

### 1.4 References

1. *Student Information Management System* project brief, Cavite State University CEIT (the attached PDF).
2. OWASP Top 10 and OWASP ASVS (Application Security Verification Standard).
3. OWASP Cheat Sheet Series: Password Storage, Session Management, SQL Injection Prevention, CSRF Prevention, Authorization.
4. Next.js (App Router), Prisma, PostgreSQL, Vercel, and Neon official documentation.
5. Republic Act No. 10173 (Data Privacy Act of 2012). Referenced as a design consideration for handling student PII; this SDD is not legal advice.

### 1.5 Assumptions and Design Decisions on the Source Brief

The brief contains a few ambiguous or inconsistent items. These are the interpretations used in this design. Please confirm them with your adviser.

| ID | Observation in the brief | Design decision |
|---|---|---|
| A1 | Student module lists **"Record visitor time-out."** This reads like a leftover from a visitor-log template. | Interpreted as **recording session time-out / logout events**. Every logout and idle/absolute session expiry is written to the activity log (`LOGOUT`, `SESSION_TIMEOUT`). If your adviser meant a physical visitor log, that would be a separate `visit_logs` table (see §13.3). |
| A2 | Section numbering skips from **E to G** (no Section F). | Treated as a numbering slip. No content is assumed missing. |
| A3 | "View academic information, **if included in the project scope**." | Included as an **optional module** (`academic_records` table) controlled by the feature flag `FEATURE_ACADEMIC_RECORDS`. Default: `true`. |
| A4 | Workflow step 6: "The student **receives or is assigned** an account." | When staff register a student, the system **auto-provisions** a student account with a one-time temporary password (shown once, `must_change_password = true`). Ongoing account management (reset, activate/deactivate) stays **Administrator-only**, matching the role table. |
| A5 | Role table: Student → Edit student records = **limited**. | Students may edit only: contact number, address, personal email, guardian name, guardian contact. Name, student number, program, year level, section, and status are read-only to them. |
| A6 | Role table: Staff → Manage courses and sections = **limited**. | Staff can **read** programs/sections and **assign** students to them. Only administrators can create, edit, or deactivate programs and sections. |
| A7 | Role table: Delete student records = Administrator only. | Deletion is a **soft delete** by default (recoverable, auditable). A hard purge is not exposed in the UI. |
| A8 | Role table shows Administrator = "yes" for staff functions. | The Administrator role is a **superset** of Staff permissions. |
| A9 | The brief does not specify how users log in. | Login identifier is a unique **username**. For students it equals the **student number**; staff and admin usernames are chosen by the administrator. No email infrastructure is required. |

---

## 2. System Overview

### 2.1 Product Perspective

SIMS is a standalone, server-rendered web application. Users access it through a browser over HTTPS. All data is stored in a managed PostgreSQL database; the application tier is stateless and runs as serverless functions on Vercel.

### 2.2 Objectives

| ID | Objective (from brief, Section B) |
|---|---|
| O1 | Develop a centralized web-based system for managing student information. |
| O2 | Allow authorized personnel to register and maintain student records. |
| O3 | Provide students with access to their personal information. |
| O4 | Organize academic information such as courses, sections, and year levels. |
| O5 | Reduce manual record keeping and improve information retrieval. |
| O6 | Implement security measures to protect confidential student information. |
| O7 | Prevent unauthorized access and modification of student records. |
| O8 | Maintain accurate records of important system activities. |

### 2.3 User Classes

| Role | Description | Typical tasks |
|---|---|---|
| **Student** | Enrolled learner with a provisioned account. | View own profile, enrollment, course/year/section, academic info; update permitted contact fields; change password. |
| **Staff / Registrar** | School personnel responsible for records. | Register students, update profiles, manage enrollment, assign program/section, search, generate lists. |
| **Administrator** | System owner. | Everything staff can do, plus manage accounts, programs, sections, roles, view activity logs, delete (soft) records. |

### 2.4 Operating Environment and Constraints

- **Client**: any modern evergreen browser (Chrome, Edge, Firefox, Safari), desktop or mobile.
- **Server**: Vercel serverless (Node.js runtime). No persistent local filesystem; no long-lived processes.
- **Database**: managed PostgreSQL (Neon recommended; Supabase is an acceptable alternative).
- **Constraints**: HTTPS only; all secrets in environment variables; database access only through the server (the database is never exposed to the browser).

### 2.5 Functional Requirements

**Authentication and session (all roles)**

| ID | Requirement | Brief ref. |
|---|---|---|
| FR-AUTH-01 | Users log in with username and password; unauthenticated users can access nothing except the login page. | E.3 |
| FR-AUTH-02 | Users can log out; logout invalidates the server-side session. | C |
| FR-AUTH-03 | Users can change their own password; first login with a temporary password forces a change. | C |
| FR-AUTH-04 | After repeated failed logins an account is temporarily locked. | E.8 |
| FR-AUTH-05 | Sessions expire after inactivity and after an absolute lifetime; expiry is recorded. | E.8, A1 |

**Student module**

| ID | Requirement |
|---|---|
| FR-STU-01 | View personal profile. |
| FR-STU-02 | View student number and enrollment information. |
| FR-STU-03 | View course (program) and year level. |
| FR-STU-04 | View assigned section. |
| FR-STU-05 | View academic information (optional module, A3). |
| FR-STU-06 | Session time-out/logout is recorded (A1). |
| FR-STU-07 | Update permitted personal information (A5). |
| FR-STU-08 | Change account password. |

**Staff / Registrar module**

| ID | Requirement |
|---|---|
| FR-REG-01 | Register new students (auto-provisions account, A4). |
| FR-REG-02 | Update student profiles. |
| FR-REG-03 | Manage enrollment information (per school year and semester). |
| FR-REG-04 | Assign students to courses and sections. |
| FR-REG-05 | Search student records (name, student number, program, year, section, status). |
| FR-REG-06 | Generate student lists (CSV and printable). |
| FR-REG-07 | View and update authorized student information. |

**Administrator module**

| ID | Requirement |
|---|---|
| FR-ADM-01 | Admin login. |
| FR-ADM-02 | Dashboard showing total number of registered students (plus breakdowns). |
| FR-ADM-03 | Add, edit, view, and manage student records. |
| FR-ADM-04 | Create and manage student accounts (reset password, activate/deactivate). |
| FR-ADM-05 | Manage courses and programs. |
| FR-ADM-06 | Manage year levels and sections. |
| FR-ADM-07 | Search and filter student records. |
| FR-ADM-08 | Generate student information reports. |
| FR-ADM-09 | View system activity logs (filter by user, action, date). |
| FR-ADM-10 | Manage staff accounts and permissions (role assignment). |
| FR-ADM-11 | Soft-delete and restore student records. |

### 2.6 Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | All ten security requirements in Brief §E implemented and verifiable (see §8). |
| Performance | Typical page ≤ 1.5 s and typical API call ≤ 500 ms (p95) with up to ~10,000 student records; all list endpoints paginated. |
| Scalability | Stateless functions scale horizontally; DB access through a pooled connection string. |
| Availability | Inherits Vercel and database provider availability; no single in-app point of failure. |
| Data durability | Managed PostgreSQL with automated backups / point-in-time recovery (retention depends on the chosen plan). |
| Usability | Responsive layout, keyboard accessible, target WCAG 2.1 AA for core flows. |
| Maintainability | TypeScript strict mode, ESLint, automated tests, schema migrations under version control. |
| Auditability | Every security-relevant action produces an immutable audit record. |
| Privacy | Data minimization and purpose limitation consistent with RA 10173 principles; PII never written to application logs. |

---

## 3. Architectural Design

### 3.1 Architectural Style

A **modular monolith** built with Next.js (App Router). Pages render on the server (React Server Components); mutations go through Route Handlers. Code is organized in layers so that validation, authorization, business rules, and persistence each have one home.

### 3.2 Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15** (App Router, TypeScript strict) | First-class Vercel support; server rendering keeps data access server-side. |
| UI | React 19, **Tailwind CSS**, shadcn/ui-style components | Fast, consistent, accessible UI. |
| Validation | **Zod** | One schema per input; shared by client forms and server handlers. |
| ORM / DB access | **Prisma 6** | Parameterized queries by default (SQL-injection prevention), typed schema, migrations. |
| Database | **PostgreSQL** (Neon, pooled connection) | Real relational DB; constraints, transactions, triggers, JSONB for audit metadata. |
| Password hashing | **bcryptjs** (cost 12) | Pure JS, works on Vercel without native build issues. Argon2id is a valid alternative if a native build is acceptable. |
| Sessions | Opaque random token in an `HttpOnly` cookie; SHA-256 of the token stored in DB | Server-side revocation, no secrets in the browser. |
| Reports | CSV (streamed) and print-optimized HTML (browser "Save as PDF") | No heavy PDF dependency on serverless. |
| Testing | Vitest, Playwright | Unit/integration and end-to-end tests. |
| CI/CD | GitHub + Vercel Git integration, GitHub Actions for lint/test | Automatic preview and production deployments. |
| Hosting | **Vercel** (region `sin1`, Singapore) | Low latency for users in the Philippines. |

### 3.3 Logical Architecture

```mermaid
flowchart LR
  B["Browser"] -->|HTTPS| E["Vercel Edge Network"]
  E --> M["Middleware: security headers, CSP nonce, cookie gate"]
  M --> P["Pages (React Server Components)"]
  M --> A["Route Handlers /api/*"]
  P --> S["Service Layer (business rules)"]
  A --> S
  S --> Z["Authorization: RBAC + ownership checks"]
  S --> V["Zod input validation"]
  S --> R["Prisma ORM (parameterized queries)"]
  S --> L["Audit logger"]
  R --> D[("PostgreSQL (pooled)")]
  L --> R
```

**Layer responsibilities**

| Layer | Responsibility | Rule |
|---|---|---|
| Middleware | Security headers, CSP nonce, early redirect when no session cookie is present. | **Never** the only access control (see §8.4). |
| Route Handler / Page | Parse request, call service, shape response. | No business logic, no direct DB access. |
| Validation (Zod) | Reject malformed or unexpected input (`.strict()` schemas). | Runs before any service logic. |
| Authorization | `requirePermission()` plus object-level ownership checks. | Runs inside the service entry point, every time. |
| Service | Business rules, transactions, audit calls. | The only caller of repositories. |
| Data access (Prisma) | All SQL. | Raw SQL only via tagged-template `$queryRaw`, never string concatenation. |
| Audit logger | Append-only writes to `audit_logs`. | Failure to log a security event fails the operation for sensitive actions. |

### 3.4 Deployment Architecture

```mermaid
flowchart TB
  Dev["Developer"] -->|git push| GH["GitHub repository"]
  GH -->|"CI: lint, typecheck, tests"| GA["GitHub Actions"]
  GH -->|"webhook"| V["Vercel build"]
  V -->|"prisma migrate deploy + next build"| Prod["Production deployment (sin1)"]
  V --> Prev["Preview deployments (per pull request)"]
  Prod -->|"pooled DATABASE_URL"| NeonMain[("Neon: main branch")]
  Prev -->|"pooled DATABASE_URL"| NeonPrev[("Neon: preview branch, no real data")]
  Cron["Vercel Cron (daily)"] -->|"Bearer CRON_SECRET"| Prod
```

### 3.5 Serverless Design Considerations

| Concern | Design response |
|---|---|---|
| Many short-lived function instances exhaust DB connections | Use Neon's **pooled** connection string (`-pooler` host) for runtime; `connection_limit=1` style settings; Prisma client reused via a global singleton. |
| Migrations need a direct connection | Separate `DIRECT_URL` used only by `prisma migrate`. |
| No persistent filesystem | No uploads to local disk; v1.0 stores no files. Reports are generated in-memory/streamed. |
| Edge middleware cannot run Prisma | Middleware does not query the DB; real authorization happens in Node.js route/service code. |
| Cold starts | bcrypt cost fixed at 12 (~250–400 ms); no heavy modules loaded at import time. |
| Function time limits | Paginate lists; stream CSV; cap exports (default 5,000 rows per request, configurable). |
| Stale sessions accumulate | Daily Vercel Cron purges expired/revoked sessions. |

### 3.6 Project Structure

```text
sims/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/                 # includes the SQL hardening migration (Appendix B)
│  └─ seed.ts                     # creates the first admin from env vars
├─ src/
│  ├─ middleware.ts               # headers, CSP nonce, cookie gate
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (auth)/change-password/page.tsx
│  │  ├─ (student)/student/...    # dashboard, profile, academic, settings
│  │  ├─ (staff)/staff/...        # dashboard, students, enrollments, reports
│  │  ├─ (admin)/admin/...        # dashboard, students, accounts, programs, sections, staff, reports, logs
│  │  ├─ api/
│  │  │  ├─ auth/{login,logout,password}/route.ts
│  │  │  ├─ me/route.ts
│  │  │  ├─ students/route.ts, students/[id]/route.ts, students/[id]/account/route.ts
│  │  │  ├─ programs/..., sections/..., enrollments/...
│  │  │  ├─ users/route.ts, users/[id]/route.ts
│  │  │  ├─ reports/students/route.ts
│  │  │  ├─ audit-logs/route.ts
│  │  │  └─ cron/purge-sessions/route.ts
│  │  └─ layout.tsx
│  ├─ components/                 # forms, tables, layout shells
│  ├─ lib/                        # db.ts, env.ts, session.ts, password.ts, authz.ts, audit.ts, http.ts
│  ├─ server/services/            # auth, students, accounts, programs, sections, enrollments, reports
│  └─ validation/                 # Zod schemas
├─ tests/                         # unit, integration, e2e
├─ vercel.json
├─ next.config.ts
├─ .env.example
└─ package.json
```

---

## 4. Data Design

### 4.1 Entity-Relationship Diagram

```mermaid
erDiagram
  USERS ||--o| STUDENTS : "has profile"
  USERS ||--o{ SESSIONS : "owns"
  USERS ||--o{ AUDIT_LOGS : "performs"
  PROGRAMS ||--o{ SECTIONS : "offers"
  PROGRAMS ||--o{ STUDENTS : "current program"
  SECTIONS ||--o{ STUDENTS : "current section"
  STUDENTS ||--o{ ENROLLMENTS : "enrollment history"
  PROGRAMS ||--o{ ENROLLMENTS : "enrolled program"
  SECTIONS ||--o{ ENROLLMENTS : "enrolled section"
  STUDENTS ||--o{ ACADEMIC_RECORDS : "has"
```

### 4.2 Data Dictionary

**`users`**: authentication identity for every role.

| Column | Type | Constraints / notes |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| username | text | UNIQUE, NOT NULL, stored lowercase (CHECK `username = lower(username)`) |
| email | text | UNIQUE, nullable (optional contact) |
| password_hash | text | NOT NULL, bcrypt hash; never selected by default queries |
| role | enum `Role` | `STUDENT` \| `STAFF` \| `ADMIN` |
| status | enum `AccountStatus` | `ACTIVE` \| `INACTIVE` \| `LOCKED`; default `ACTIVE` |
| must_change_password | boolean | default `true` |
| failed_login_count | int | default 0 |
| locked_until | timestamptz | nullable |
| last_login_at | timestamptz | nullable |
| password_changed_at | timestamptz | nullable |
| created_by_id | uuid | nullable, who created the account |
| created_at / updated_at | timestamptz | defaults |

**`sessions`**: server-side session registry.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users, ON DELETE CASCADE |
| token_hash | text | UNIQUE; SHA-256 of the cookie token |
| ip, user_agent | text | informational, truncated |
| created_at, last_seen_at | timestamptz | idle-timeout tracking |
| expires_at | timestamptz | absolute lifetime |
| revoked_at | timestamptz | nullable |

**`programs`**: courses.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| code | text | UNIQUE (e.g. `BSIT`) |
| name | text | NOT NULL |
| description | text | nullable |
| is_active | boolean | default true |

**`sections`**

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| program_id | uuid | FK → programs, ON DELETE RESTRICT |
| year_level | smallint | CHECK 1–6 |
| name | text | e.g. `A`, `1` |
| school_year | text | e.g. `2026-2027` |
| capacity | int | nullable, CHECK > 0 |
| is_active | boolean | default true |
| | | UNIQUE (program_id, year_level, name, school_year) |

**`students`**: the core record.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | UNIQUE FK → users, nullable until account exists |
| student_number | text | UNIQUE, NOT NULL, validated format |
| first_name, middle_name, last_name, suffix | text | names; first/last NOT NULL |
| sex | enum | `MALE` \| `FEMALE` |
| birth_date | date | NOT NULL, CHECK in the past |
| contact_number, address, personal_email | text | student-editable |
| guardian_name, guardian_contact | text | student-editable |
| program_id | uuid | FK → programs (current course) |
| year_level | smallint | CHECK 1–6 (current) |
| section_id | uuid | FK → sections, nullable |
| enrollment_status | enum | `ENROLLED` \| `NOT_ENROLLED` \| `ON_LEAVE` \| `GRADUATED` \| `DROPPED` |
| date_enrolled | date | nullable |
| version | int | optimistic concurrency, default 1 |
| deleted_at | timestamptz | soft delete marker |
| created_by_id, updated_by_id | uuid | FK → users |
| created_at, updated_at | timestamptz | defaults |

**`enrollments`**: history per term (the `students` row stores the *current* placement).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| student_id | uuid | FK → students, ON DELETE RESTRICT |
| program_id, section_id | uuid | FKs |
| school_year | text | `2026-2027` |
| semester | enum | `FIRST` \| `SECOND` \| `MIDYEAR` |
| year_level | smallint | CHECK 1–6 |
| status | enum | `EnrollmentStatus` |
| enrolled_by_id | uuid | FK → users |
| created_at | timestamptz | |
| | | UNIQUE (student_id, school_year, semester) |

**`academic_records`** (optional, A3)

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| student_id | uuid | FK → students |
| school_year, semester | text / enum | |
| subject_code, subject_title | text | NOT NULL |
| units | numeric(3,1) | CHECK ≥ 0 |
| grade | text | nullable |
| remarks | text | nullable |
| encoded_by_id | uuid | FK → users |

**`audit_logs`**: append-only activity log.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| actor_id | uuid | nullable (failed login for unknown user) |
| actor_role | enum | nullable |
| action | text | e.g. `LOGIN_FAILURE`, `STUDENT_UPDATED` |
| entity_type, entity_id | text | target of the action |
| outcome | enum | `SUCCESS` \| `FAILURE` |
| metadata | jsonb | **redacted**: changed field names, not values of sensitive fields |
| ip, user_agent | text | |
| created_at | timestamptz | indexed |

### 4.3 Indexing Strategy

| Table | Index | Purpose |
|---|---|---|
| users | UNIQUE(username), (role, status) | login lookup, admin filters |
| sessions | UNIQUE(token_hash), (user_id), (expires_at) | session lookup, bulk revoke, purge |
| students | UNIQUE(student_number), (last_name, first_name), (program_id, year_level, section_id), (enrollment_status), (deleted_at) | search and filters |
| enrollments | UNIQUE(student_id, school_year, semester), (section_id) | history, section rosters |
| audit_logs | (created_at), (actor_id, created_at), (action, created_at), (entity_type, entity_id) | log viewer filters |

For "contains" name search, use a `pg_trgm` GIN index on a generated `full_name` expression if search latency becomes an issue (§13.3).

### 4.4 Data Integrity Mechanisms (Brief §E.11)

| Mechanism | Description |
|---|---|
| Foreign keys with `RESTRICT` | Programs/sections in use cannot be deleted; deactivate instead. |
| CHECK constraints | Year level 1–6, capacity > 0, lowercase usernames, birth date in the past. |
| Soft delete | Student deletion sets `deleted_at`; default queries filter `deleted_at IS NULL`; only Admin can delete/restore. |
| Optimistic concurrency | `students.version` incremented on every update; conflicting concurrent edits return `409 Conflict`. |
| Transactions | Student registration (user + student + enrollment + audit) is one atomic transaction. |
| Immutable audit log | DB trigger rejects `UPDATE`, `DELETE`, and `TRUNCATE` on `audit_logs` (Appendix B). |
| Least-privilege fields | Student self-service uses a dedicated update schema that can only touch the five permitted columns (prevents mass assignment). |

### 4.5 Migration and Seeding

- Schema changes are made only through `prisma migrate dev` locally and applied in production with `prisma migrate deploy`.
- The hardening SQL (triggers, CHECK constraints) is committed as a **custom migration** so it is applied on every environment.
- `prisma/seed.ts` creates the **first administrator** from `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`. No default credentials exist in source code. The seed refuses to run if an admin already exists.
- Optional demo data (sample programs/sections) is seeded only when `SEED_DEMO_DATA=true`, and never in production.

---

## 5. Component and Module Design

### 5.1 Module Overview

| Module | Services | Main data |
|---|---|---|
| **Auth** | `authService` (login, logout, change password, lockout, session) | users, sessions, audit_logs |
| **Student (self-service)** | `profileService` | students, enrollments, academic_records |
| **Registrar / Staff** | `studentService`, `enrollmentService`, `reportService` | students, enrollments, programs, sections |
| **Administration** | `accountService`, `programService`, `sectionService`, `auditService`, `dashboardService` | users, programs, sections, audit_logs |

### 5.2 Role-Based Access Control Design

Permissions are defined once in code and checked inside services. Roles map to permission sets; the role table in the brief (Section D) is reproduced below with the exact permission each row maps to.

| Function (Brief §D) | Permission key | Student | Staff / Registrar | Administrator |
|---|---|:---:|:---:|:---:|
| Log in and log out | `auth:session` | yes | yes | yes |
| View personal profile | `profile:read:self` | yes | yes | yes |
| Register students | `student:create` | no | yes | yes |
| Edit student records | `student:update` / `profile:update:self` | limited (own, 5 fields) | yes | yes |
| Delete student records | `student:delete`, `student:restore` | no | no | yes |
| Manage student accounts | `account:manage` | no | no | yes |
| Manage courses and sections | `program:manage`, `section:manage` | no | limited (`program:read`, `section:read`, `section:assign`) | yes |
| Generate reports | `report:generate` | no | yes | yes |
| Manage user roles | `user:manage` | no | no | yes |
| View activity logs | `audit:read` | no | no | yes |

Additional permissions: `student:read` (staff, admin), `enrollment:manage` (staff, admin), `academic:read:self` (student), `academic:manage` (staff, admin), `dashboard:read` (admin; staff get a reduced dashboard).

**Object-level rules (IDOR prevention)**

- A `STUDENT` never passes an ID to read their data. Endpoints under `/api/me/*` resolve the record from `session.user.id` (`WHERE user_id = :sessionUser`).
- Any endpoint that accepts a `:id` for a student requires `student:read` / `student:update`, which students do not hold.
- Admins cannot deactivate or demote **themselves**, and the last remaining active admin cannot be deactivated or demoted.

### 5.3 Authentication Module

**Login**

1. Validate `{ username, password }` (Zod, trimmed, length-limited).
2. Verify same-origin request.
3. Look up user by lowercase username (parameterized).
4. **Always** run one bcrypt comparison (against a dummy hash if the user does not exist) to equalize timing.
5. If the account is `INACTIVE`, or `locked_until > now()`, or the password is wrong: increment `failed_login_count` (when applicable), write `LOGIN_FAILURE`, return the **same generic** `401` message ("Invalid username or password").
6. After **5 consecutive failures**: set `status = LOCKED`-equivalent via `locked_until = now() + 15 min`, write `ACCOUNT_LOCKED`.
7. On success: reset the failure counter, **create a new session** (token rotation), set cookie, write `LOGIN_SUCCESS`, update `last_login_at`.
8. If `must_change_password` is true, the only reachable routes are `/change-password` and `/api/auth/*` until the password is changed.

**Session policy**

| Parameter | Value |
|---|---|
| Token | 32 random bytes (`crypto.randomBytes`), base64url |
| Storage | Browser: cookie only. Server: SHA-256 hash of token in `sessions` |
| Cookie | `HttpOnly; Secure; SameSite=Lax; Path=/`, name `__Host-sims_sid` in production |
| Idle timeout | 20 minutes (sliding; `last_seen_at` refreshed at most once per minute) |
| Absolute lifetime | 8 hours |
| Rotation | New session on login; all other sessions revoked on password change |
| Revocation | Logout, deactivation, password reset, role change, admin "sign out everywhere" |
| Expiry logging | First request after expiry writes `SESSION_TIMEOUT` (A1) |

**Password policy**

- Minimum 10 characters; **maximum 72 bytes** (bcrypt truncates silently beyond that, so it is rejected explicitly).
- Must not equal or contain the username; rejected if found in a bundled common-password list.
- Temporary passwords: 12 characters from `crypto.randomInt`, displayed **once**, never stored in plaintext or logged.
- Reset by admin sets `must_change_password = true` and revokes all sessions.

### 5.4 Student Module (Self-Service)

| Screen | Data source | Notes |
|---|---|---|
| Dashboard | `students` + current section/program | Summary card: student number, program, year, section, status |
| Profile | `students` | Read-only fields vs. editable fields clearly separated |
| Enrollment | `enrollments` | History by school year and semester |
| Academic information | `academic_records` | Hidden if `FEATURE_ACADEMIC_RECORDS=false` |
| Edit contact info | `PATCH /api/me/profile` | Only 5 fields accepted (`.strict()` Zod schema); audit `STUDENT_SELF_UPDATED` |
| Change password | `PATCH /api/auth/password` | Requires current password |

### 5.5 Staff / Registrar Module

| Capability | Behavior |
|---|---|
| Register student | Single transaction: create `users` row (role `STUDENT`, username = student number, temp password hash), `students` row, initial `enrollments` row, audit `STUDENT_CREATED` + `ACCOUNT_CREATED`. Response returns the temporary password **once**. |
| Update profile | Full editable set (names, birth date, contact, guardian, etc.), optimistic locking via `version`. |
| Manage enrollment | Create/update term enrollment; updates the student's *current* program/year/section snapshot in the same transaction. |
| Assign section | Validates section belongs to the student's program and year level, is active, and has capacity. |
| Search / filter | Query by name, student number; filter by program, year level, section, status; paginated and sortable. |
| Generate lists | Class list per section, list per program/year, enrollment status list; CSV and print view. |

### 5.6 Administrator Module

| Capability | Behavior |
|---|---|
| Dashboard | Total registered students (non-deleted), counts by program / year level / status, active vs. inactive accounts, latest 10 audit events. |
| Student management | Everything staff can do, plus soft delete and restore. |
| Account management | Create staff/admin accounts, reset passwords (new temp password), activate/deactivate, unlock, force sign-out. |
| Programs | Create, edit, activate/deactivate. Cannot hard-delete a program with students or sections. |
| Year levels and sections | Create, edit capacity/name, activate/deactivate sections per school year. |
| Staff and permissions | Change role (`STAFF` ↔ `ADMIN`), guarded by the self-demotion and last-admin rules. |
| Activity logs | Filter by actor, action, entity, date range, outcome; export CSV. Read-only. |
| Reports | Student information reports across all programs. |

### 5.7 Reports

| Report | Audience | Format |
|---|---|---|
| Student list (by program / year level / section / status) | Staff, Admin | CSV, print view |
| Class roster per section and term | Staff, Admin | CSV, print view |
| Student information report (full profile summary) | Staff, Admin | print view |
| Enrollment summary (counts by program/year/status) | Staff, Admin | on-screen, CSV |
| Activity log export | Admin | CSV |

CSV exports **neutralize formula injection**: any cell beginning with `=`, `+`, `-`, `@`, tab, or carriage return is prefixed with a single quote. Every report generation is itself audited (`REPORT_GENERATED` with filters, not data).

---

## 6. API Design

### 6.1 Conventions

- Base path `/api`, JSON only, UTF-8, `Content-Type: application/json` required on bodies.
- All mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) require a **same-origin** `Origin` header (CSRF defense in depth together with `SameSite=Lax`).
- Success: `{ "data": ... }`, with `{ "meta": { page, pageSize, total } }` for lists.
- Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fieldErrors": { "field": ["..."] } } }`. No stack traces, no SQL text, no internal IDs of unrelated records.
- Pagination: `?page=1&pageSize=25` (max 100). Sorting: `?sort=lastName:asc` from an allow-list.

| Status | Meaning |
|---|---|
| 200 / 201 / 204 | Success / created / no content |
| 400 | Malformed request |
| 401 | Not authenticated or session expired |
| 403 | Authenticated but lacking permission (also written to the audit log as `ACCESS_DENIED`) |
| 404 | Not found (also returned when a record exists but the caller may not know it exists) |
| 409 | Version conflict or uniqueness violation |
| 422 | Validation failed |
| 423 | Account locked |
| 429 | Too many requests |

### 6.2 Endpoint Catalog

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/auth/login` | public | Login; sets session cookie |
| POST | `/api/auth/logout` | session | Revoke current session; audit `LOGOUT` |
| PATCH | `/api/auth/password` | session | Change own password (current + new) |
| GET | `/api/me` | session | Current user summary (id, username, role) |
| GET | `/api/me/profile` | `profile:read:self` | Own student profile |
| PATCH | `/api/me/profile` | `profile:update:self` | Update the 5 permitted fields |
| GET | `/api/me/enrollments` | `profile:read:self` | Own enrollment history |
| GET | `/api/me/academic` | `academic:read:self` | Own academic records |
| GET | `/api/students` | `student:read` | Search/filter/paginate |
| POST | `/api/students` | `student:create` | Register student (+ account), returns one-time temp password |
| GET | `/api/students/:id` | `student:read` | Student detail |
| PATCH | `/api/students/:id` | `student:update` | Update profile (requires `version`) |
| DELETE | `/api/students/:id` | `student:delete` | Soft delete |
| POST | `/api/students/:id/restore` | `student:restore` | Restore soft-deleted student |
| POST | `/api/students/:id/enrollments` | `enrollment:manage` | Create/update term enrollment and placement |
| POST | `/api/students/:id/account/reset` | `account:manage` | New temp password, revoke sessions |
| PATCH | `/api/students/:id/account` | `account:manage` | `{ status: "ACTIVE" \| "INACTIVE" }` |
| GET | `/api/programs` | `program:read` | List programs |
| POST / PATCH | `/api/programs`, `/api/programs/:id` | `program:manage` | Create / edit / activate |
| GET | `/api/sections` | `section:read` | List sections (filter by program, year, school year) |
| POST / PATCH | `/api/sections`, `/api/sections/:id` | `section:manage` | Create / edit / activate |
| GET | `/api/users` | `user:manage` | List staff/admin accounts |
| POST | `/api/users` | `user:manage` | Create staff/admin account |
| PATCH | `/api/users/:id` | `user:manage` | Role / status changes (guarded) |
| GET | `/api/reports/students` | `report:generate` | CSV export with filters |
| GET | `/api/audit-logs` | `audit:read` | Filtered, paginated log |
| GET | `/api/admin/stats` | `dashboard:read` | Dashboard figures |
| GET | `/api/cron/purge-sessions` | `Authorization: Bearer CRON_SECRET` | Delete expired/revoked sessions |

### 6.3 Example Contracts

**POST `/api/auth/login`**

```json
// Request
{ "username": "202612345", "password": "••••••••••" }

// 200
{ "data": { "id": "7c1e…", "username": "202612345", "role": "STUDENT", "mustChangePassword": true } }

// 401 (identical for unknown user, wrong password, inactive, or locked)
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid username or password." } }
```

**POST `/api/students`**

```json
// Request (strict schema: unknown keys are rejected)
{
  "studentNumber": "202612345",
  "firstName": "Juan", "middleName": "Santos", "lastName": "Dela Cruz", "suffix": null,
  "sex": "MALE", "birthDate": "2006-03-14",
  "contactNumber": "09171234567", "address": "Indang, Cavite", "personalEmail": null,
  "guardianName": "Maria Dela Cruz", "guardianContact": "09181234567",
  "programId": "b3a0…", "yearLevel": 1, "sectionId": "9f21…",
  "schoolYear": "2026-2027", "semester": "FIRST"
}

// 201
{ "data": { "id": "d2f4…", "studentNumber": "202612345", "account": { "username": "202612345", "temporaryPassword": "k7Qm-…", "shownOnce": true } } }
```

**PATCH `/api/me/profile`** (student self-service)

```json
// Request: only these five keys are accepted
{ "contactNumber": "09171234567", "address": "…", "personalEmail": "a@b.ph", "guardianName": "…", "guardianContact": "…" }

// A request containing e.g. "programId" or "role" returns 422 (unknown key), never silently ignored.
```

### 6.4 Input Validation Rules (Zod)

| Field | Rule |
|---|---|
| `username` | 3–32 chars, `[a-z0-9._-]`, lowercased |
| `studentNumber` | 6–20 chars, `[A-Za-z0-9-]`; format pattern configurable |
| Names | 1–60 chars, Unicode letters, spaces, `'`, `-`, `.` |
| `birthDate` | ISO date, not in the future, age plausibility check |
| `contactNumber` | PH mobile pattern `^(09\|\+639)\d{9}$` |
| `personalEmail` | RFC-compliant email, max 254 |
| `address` | max 255, control characters stripped |
| `yearLevel` | integer 1–6 |
| `schoolYear` | `^\d{4}-\d{4}$` with second year = first + 1 |
| IDs | valid UUID v4 |
| Search `q` | max 64 chars, trimmed; used only as a **bound parameter** |

Validation errors are returned field-by-field; the same schemas power client-side form checks. **Client-side validation is a convenience, never a control.**

---

## 7. User Interface Design

### 7.1 Principles

- Role-specific shells: each role sees only its own navigation (hidden menu items are a usability aid; the server still enforces access).
- Responsive (mobile-first), keyboard navigable, visible focus states, sufficient contrast, labelled form controls, error text tied to inputs.
- Destructive actions (delete, deactivate, reset password) require an explicit confirmation dialog.
- Sensitive values (temporary passwords) are shown once with a copy button and a warning.
- All user-supplied text is rendered through React's escaping; **no** `dangerouslySetInnerHTML`.

### 7.2 Site Map

| Role | Pages |
|---|---|
| Public | `/login` |
| All (authenticated) | `/change-password` |
| Student | `/student`, `/student/profile`, `/student/enrollment`, `/student/academic`, `/student/settings` |
| Staff | `/staff`, `/staff/students`, `/staff/students/new`, `/staff/students/[id]`, `/staff/enrollments`, `/staff/reports` |
| Admin | `/admin`, `/admin/students`, `/admin/students/[id]`, `/admin/accounts`, `/admin/staff`, `/admin/programs`, `/admin/sections`, `/admin/reports`, `/admin/logs` |

### 7.3 Wireframes (Low Fidelity)

**Login**

```text
┌────────────────────────────────────────────┐
│          [CvSU logo]                       │
│    Student Information Management System   │
│                                            │
│   Username   [______________________]      │
│   Password   [______________________] 👁   │
│                                            │
│   [            Sign in               ]     │
│   (generic error area, aria-live)          │
└────────────────────────────────────────────┘
```

**Admin dashboard**

```text
┌───────────────┬────────────────────────────────────────────────┐
│ SIMS          │  Dashboard                          [Admin ▾]  │
│ ───────────── │ ┌──────────┐┌──────────┐┌──────────┐┌────────┐ │
│ Dashboard     │ │ Total    ││ Enrolled ││ Active   ││ Locked │ │
│ Students      │ │ Students ││          ││ Accounts ││ Accts  │ │
│ Accounts      │ │  1,248   ││  1,102   ││  1,230   ││   3    │ │
│ Programs      │ └──────────┘└──────────┘└──────────┘└────────┘ │
│ Sections      │  Students by program        Recent activity    │
│ Staff         │  [bar chart]                • 10:42 LOGIN_...  │
│ Reports       │                             • 10:40 STUDENT_...│
│ Activity Logs │                             • 10:31 ACCOUNT_...│
└───────────────┴────────────────────────────────────────────────┘
```

**Student profile (self-service)**

```text
┌────────────────────────────────────────────────────────────┐
│ My Profile                                                 │
│ Student No.  202612345        Program   BSIT               │
│ Name         Juan S. Dela Cruz  Year     1st Year          │
│ Status       ENROLLED          Section   BSIT 1-A          │
│ ────────────────────────────────────────────────────────── │
│ Contact info (editable)                  [Edit]            │
│ Mobile 0917…   Address …   Guardian …                      │
└────────────────────────────────────────────────────────────┘
```

### 7.4 Key Screen Behaviors

| Screen | Behavior |
|---|---|
| Student list (staff/admin) | Server-side pagination, debounced search, filter chips (program, year, section, status), sortable columns, row action menu. |
| Student form | Sectioned form (Personal, Contact, Guardian, Academic placement); section dropdown filtered by selected program/year; optimistic-lock conflict banner with "reload latest". |
| Account created dialog | Shows temporary password once; requires "I have recorded this" checkbox to close. |
| Activity logs | Filter bar (date range, actor, action, outcome); read-only table; CSV export. |
| Session expiry | On `401`, the UI shows "Your session expired" and redirects to `/login` preserving a safe, same-origin `next` path only. |

---

## 8. Security Design

### 8.1 Mapping to the Brief's Security Requirements (Section E)

| # | Requirement | Design implementation | Verification |
|---|---|---|---|
| S1 | **Password hashing** | bcrypt (cost 12) via `bcryptjs`; unique salt per hash (built in); 72-byte limit enforced; plaintext never stored or logged; dummy-hash comparison for unknown users. | Unit test: hash ≠ plaintext, verify works, DB dump shows only `$2a$12$…` hashes. |
| S2 | **Authentication** | All routes except `/login` require a valid server-side session; middleware gate + authoritative check in every page/handler; forced password change on first login; lockout after 5 failures. | E2E: unauthenticated access redirects/401; lockout test. |
| S3 | **Role-Based Access Control** | Central `PERMISSIONS` map; `requirePermission()` in every service entry; object-level ownership checks for students; last-admin and self-demotion guards. | RBAC matrix test (every role × every endpoint); IDOR tests. |
| S4 | **Data confidentiality** | TLS only (HSTS); database reachable only from the server; encryption at rest by the DB provider; `select` only required columns (DTOs); `password_hash` never returned; PII excluded from logs; strict CSP; `Cache-Control: no-store` on authenticated responses; separate non-production database (no real data in previews). | Header scan; response-shape tests; log review. |
| S5 | **SQL injection prevention** | Prisma parameterized queries everywhere; raw SQL only with `$queryRaw` tagged templates (parameter binding); sort columns from an allow-list; search input bound as parameter; DB role with least privilege (no DDL at runtime if the provider allows a restricted role). | Automated payload tests (`' OR 1=1--`, `'; DROP TABLE…`) against search and login. |
| S6 | **Input validation** | Zod `.strict()` schemas on every endpoint (body, query, params); length/format limits; output escaping by React; CSV formula neutralization. | Fuzz/negative tests; XSS payload test in all text fields. |
| S7 | **Session management** | Opaque 256-bit token, hashed at rest; `HttpOnly; Secure; SameSite=Lax`; idle (20 min) + absolute (8 h) expiry; rotation on login; revocation on logout / password change / deactivation. | Session fixation, expiry, and revocation tests. |
| S8 | **Activity logs** | `audit_logs` table written by a single `audit()` helper; immutable via DB trigger; logs auth events, CRUD on students/accounts/programs/sections/enrollments, role changes, report generation, access denials. | Trigger test (UPDATE/DELETE rejected); coverage checklist per action. |
| S9 | **Account management** | Admin creates, resets, activates/deactivates, unlocks accounts; deactivation immediately revokes all sessions and is re-checked on every request. | E2E: deactivated user's existing session stops working. |
| S10 | **Data integrity** | FKs, CHECKs, transactions, optimistic locking, soft delete, admin-only deletion, immutable audit trail. | Constraint tests; concurrent-edit test. |

### 8.2 Threat Model (STRIDE Summary)

| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Credential stuffing / brute force | Lockout, generic errors, bcrypt cost, optional IP-based rate limit (§8.5) |
| Tampering | Student alters their program/section via API | Strict schemas, field allow-list, server-side RBAC |
| Repudiation | "I never changed that record" | Immutable audit log with actor, IP, user agent, timestamp |
| Information disclosure | IDOR, verbose errors, PII in logs | Ownership checks, generic errors, log redaction, no-store caching |
| Denial of service | Login flooding, expensive exports | Rate limiting, pagination, export caps, serverless autoscaling |
| Elevation of privilege | Student calls staff endpoint; middleware bypass | Authorization inside services (not middleware only), RBAC matrix tests |

### 8.3 Transport and Browser Security

| Control | Value |
|---|---|
| HTTPS | Enforced by Vercel; `Strict-Transport-Security: max-age=63072000; includeSubDomains` |
| CSP | Nonce-based `script-src 'self' 'nonce-…' 'strict-dynamic'`; `frame-ancestors 'none'`; `form-action 'self'`; `base-uri 'self'` |
| Other headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation disabled), `Cross-Origin-Opener-Policy: same-origin` |
| CORS | No CORS headers (same-origin app); no wildcard origins |
| Caching | Authenticated pages and API: `Cache-Control: no-store` |
| Cookies | See §5.3 |

### 8.4 Defense in Depth for Authorization

Middleware runs at the edge and cannot query the database, so it only performs a cheap **cookie-presence redirect** and sets headers. Every page and API route independently calls `getSession()` / `requirePermission()` server-side. A bypass of middleware therefore still results in `401/403` from the application code. Keep Next.js patched to the latest stable release.

### 8.5 Abuse and Rate Limiting

- Per-account lockout is built in (5 failures → 15 minutes).
- Optional per-IP throttling on `/api/auth/login` using a lightweight DB counter or Upstash Redis (Vercel Marketplace). Not required for the academic scope; recommended for production use.

### 8.6 Secrets, Dependencies, and Environments

- Secrets exist only as Vercel environment variables (scoped per environment); `.env*` is git-ignored.
- `.env.example` documents variables without values.
- Dependabot/`npm audit` in CI; lockfile committed; exact Node version pinned.
- Production, Preview, and Development use **separate databases** (Neon branches); previews never receive production data.
- Errors are logged server-side with a correlation ID; responses expose only the ID.

### 8.7 Privacy Considerations (RA 10173)

| Principle | Design response |
|---|---|
| Transparency | Login page and profile include a short data-privacy notice (what is collected and why). |
| Legitimate purpose | Only fields needed for student record management are stored. |
| Proportionality | Role-limited visibility; students see only their own data; reports exclude sensitive columns unless needed. |
| Security | Controls in §8.1–§8.6. |
| Retention | Soft-deleted records can be purged by a documented administrative procedure after the school's retention period. |

---

## 9. Key Workflows

### 9.1 End-to-End System Workflow (Brief §G)

```mermaid
sequenceDiagram
  actor Admin
  actor Registrar
  actor Student
  participant SIMS as SIMS (Next.js on Vercel)
  participant DB as PostgreSQL
  Admin->>SIMS: Log in and create staff account(s), configure programs and sections
  SIMS->>DB: INSERT users, programs, sections, audit_logs
  Registrar->>SIMS: Log in (forced password change on first login)
  Registrar->>SIMS: Register new student with personal and academic information
  SIMS->>SIMS: Validate input, check permission student:create
  SIMS->>DB: BEGIN, INSERT user, student, enrollment, audit_logs, COMMIT
  SIMS-->>Registrar: Student saved, one-time temporary password shown
  Registrar-->>Student: Hands over username and temporary password
  Student->>SIMS: Log in, change password
  Student->>SIMS: View personal and academic information
  SIMS->>DB: SELECT own record (user_id from session)
  Admin->>SIMS: Monitor student records and activity logs
  SIMS->>DB: SELECT audit_logs with filters
```

### 9.2 Login Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant R as POST /api/auth/login
  participant DB as PostgreSQL
  U->>R: username and password
  R->>R: Zod validation and Origin check
  R->>DB: SELECT user WHERE username = $1
  alt user missing, inactive, or locked
    R->>R: bcrypt compare against dummy hash
    R->>DB: INSERT audit LOGIN_FAILURE
    R-->>U: 401 generic message
  else user found and active
    R->>R: bcrypt compare with stored hash
    alt password wrong
      R->>DB: failed_login_count + 1, lock at 5, INSERT audit
      R-->>U: 401 generic message
    else password correct
      R->>DB: reset counters, INSERT session (token hash), INSERT audit LOGIN_SUCCESS
      R-->>U: 200 and Set-Cookie (HttpOnly, Secure, SameSite=Lax)
    end
  end
```

### 9.3 Student Registration (Transactional)

1. Authorize `student:create`; validate payload (strict).
2. Check uniqueness of `student_number` / `username`; verify program, section (belongs to program and year, active, capacity available).
3. Generate temporary password; hash it.
4. **Transaction**: insert `users` → insert `students` (linked) → insert `enrollments` → insert `audit_logs` (`STUDENT_CREATED`, `ACCOUNT_CREATED`).
5. Return the student DTO plus the one-time temporary password. Nothing about the password is logged.

### 9.4 Account Deactivation

1. Admin calls `PATCH /api/students/:id/account { status: "INACTIVE" }` (`account:manage`).
2. Transaction: set `users.status = INACTIVE`, set `revoked_at` on all of the user's sessions, write `ACCOUNT_DEACTIVATED`.
3. The user's next request fails the status check in `getSession()` even if the cookie still exists.

---

## 10. Deployment Design (Vercel)

### 10.1 Target Environment

| Item | Choice |
|---|---|
| Hosting | Vercel project connected to the GitHub repository |
| Runtime | Node.js (current LTS) serverless functions; middleware on the Edge runtime |
| Function region | `sin1` (Singapore), same region as the database |
| Database | Neon PostgreSQL, region AWS `ap-southeast-1` (Singapore); pooled endpoint for runtime, direct endpoint for migrations. Available via the Vercel Marketplace integration, or create it directly at neon.tech. Supabase Postgres works the same way. |
| Domains | `*.vercel.app` by default; custom domain optional (HTTPS automatic) |

### 10.2 Environments

| Environment | Branch | Database | Notes |
|---|---|---|---|
| Production | `main` | Neon `main` branch | Real data; seeded admin only |
| Preview | pull requests | Neon preview branch | Disposable, no real data, `SEED_DEMO_DATA=true` allowed |
| Development | local | Local PostgreSQL (Docker) or a personal Neon branch | `.env.local` |

### 10.3 Build and Release Pipeline

1. Developer opens a pull request → GitHub Actions run `lint`, `typecheck`, `test`.
2. Vercel builds a **preview deployment** automatically.
3. Merge to `main` → Vercel production build:
   - `npm ci` → `postinstall` runs `prisma generate`
   - build command: `prisma migrate deploy && next build`
4. After a successful build the new deployment is promoted atomically. A failed migration fails the build, so the previous deployment keeps serving.
5. Rollback: promote the previous deployment in Vercel. Database migrations must be **backward compatible** for one release (expand → migrate → contract) so a rollback never meets an incompatible schema.

### 10.4 Step-by-Step Deployment Procedure

1. **Create the database**: new Neon project in Singapore; copy the **pooled** connection string (`DATABASE_URL`) and the **direct** string (`DIRECT_URL`). Append `?sslmode=require`.
2. **Push the code** to a GitHub repository (no `.env` files committed).
3. **Import the repository** in Vercel (framework preset: Next.js).
4. **Set environment variables** for Production (and separate values for Preview), see Appendix C.
5. **Set the build command** to `prisma migrate deploy && next build` (Project Settings → Build & Development).
6. **Deploy.** Vercel builds, applies migrations, and publishes the site.
7. **Create the first admin once**, from your machine, pointing at the *direct* URL:
   `DIRECT_URL=... DATABASE_URL=... SEED_ADMIN_USERNAME=... SEED_ADMIN_PASSWORD=... npm run db:seed`
   Then rotate that password at first login (forced) and remove the seed variables from Vercel.
8. **Smoke test** (checklist in §10.6).
9. Enable **Deployment Protection** on previews and keep production public (or add Vercel Authentication if the app should be invite-only during demos).

### 10.5 Operations

| Topic | Approach |
|---|---|
| Backups | Provider automated backups / PITR; before each major release take a manual branch/snapshot. Document the restore procedure. |
| Monitoring | Vercel logs and Analytics; alert on 5xx rate; review `LOGIN_FAILURE` / `ACCESS_DENIED` spikes in the activity log. |
| Session cleanup | Vercel Cron → `/api/cron/purge-sessions` daily (secured with `CRON_SECRET`). |
| Secret rotation | Rotate `CRON_SECRET` and DB credentials per term; rotate admin password at hand-over. |
| Dependency updates | Dependabot weekly; run the test suite before merging. |

### 10.6 Production Readiness Checklist

- [ ] HTTPS only; HSTS header present; CSP present with nonce.
- [ ] `DATABASE_URL` uses the pooled host; `DIRECT_URL` used only by migrations.
- [ ] No default or demo credentials in production; seed variables removed.
- [ ] Cookies are `HttpOnly; Secure; SameSite=Lax`.
- [ ] `audit_logs` trigger present (try an `UPDATE` in a SQL console: it must fail).
- [ ] Login lockout works; generic error messages verified.
- [ ] RBAC test suite green (every role × every endpoint).
- [ ] Preview environment points at a non-production database.
- [ ] Backup/restore procedure documented and tested once.
- [ ] `npm audit` shows no high/critical issues; Next.js and Prisma on latest stable patch versions.

---

## 11. Testing Strategy

### 11.1 Levels

| Level | Tooling | Scope |
|---|---|---|
| Unit | Vitest | Password hashing, validators, permission map, CSV neutralization, session expiry math |
| Integration | Vitest + test database (Neon branch or Docker Postgres) | Services with real DB: registration transaction, optimistic locking, soft delete, audit trigger |
| End-to-end | Playwright | Role journeys (login → task → logout), session expiry, forced password change |
| Security | Playwright/API scripts + manual review | Table in §11.3 |
| Non-functional | Seeded dataset (e.g. 10,000 students) | List/search latency, export time |

### 11.2 Representative Functional Test Cases

| ID | Scenario | Expected |
|---|---|---|
| TC-01 | Admin creates a staff account | Account exists, `must_change_password = true`, audit `ACCOUNT_CREATED` |
| TC-02 | Registrar registers a student | One transaction creates user, student, enrollment; temp password shown once |
| TC-03 | Student logs in and views profile | Only own data returned |
| TC-04 | Student edits address | Saved; audit `STUDENT_SELF_UPDATED`; `version` unchanged for protected fields |
| TC-05 | Two staff edit the same student concurrently | Second save gets `409` with a reload prompt |
| TC-06 | Admin soft-deletes then restores a student | Hidden from lists, then visible again; both audited |
| TC-07 | Section assignment exceeds capacity | Rejected with a clear message |
| TC-08 | Admin deactivates a signed-in student | Student's next request returns `401` |
| TC-09 | Dashboard total | Equals `COUNT(*)` of non-deleted students |
| TC-10 | CSV export of a section | Correct rows; formula-looking cells neutralized; `REPORT_GENERATED` logged |

### 11.3 Security Test Cases

| ID | Test | Expected |
|---|---|---|
| SEC-01 | Login with SQLi payloads (`' OR '1'='1`, `admin'--`) | Normal `401`; no SQL error text |
| SEC-02 | Search `q=%'; DROP TABLE students;--` | Treated as literal text; no effect |
| SEC-03 | Student requests `/api/students/{otherId}` | `403`/`404`; `ACCESS_DENIED` audited |
| SEC-04 | Student browses to `/admin` and `/staff` | Redirect/`403` |
| SEC-05 | Student `PATCH /api/me/profile` with `programId` or `role` | `422`; no change |
| SEC-06 | `<script>alert(1)</script>` stored in name/address | Rendered as text; CSP blocks inline execution |
| SEC-07 | Five wrong passwords | Account locked 15 min; `ACCOUNT_LOCKED` audited |
| SEC-08 | Reuse of a pre-login cookie after login | Old token invalid (rotation) |
| SEC-09 | Use cookie after logout / password change | `401` |
| SEC-10 | Cross-origin POST (forged `Origin`) to a mutating endpoint | `403` |
| SEC-11 | Direct SQL `UPDATE audit_logs …` / `DELETE FROM audit_logs` | Rejected by trigger |
| SEC-12 | Response bodies and logs searched for `password_hash`, plaintext passwords | None found |
| SEC-13 | Admin demotes self / deactivates last admin | Rejected |
| SEC-14 | Idle > 20 min, then request | `401`; `SESSION_TIMEOUT` audited |
| SEC-15 | Unauthenticated request to `/api/cron/purge-sessions` | `401` |

### 11.4 Acceptance Criteria (Summary)

The system is accepted when every FR in §2.5 has a passing test, all S1–S10 verification items in §8.1 pass, the production checklist in §10.6 is complete, and the demo workflow in §9.1 runs on the deployed Vercel URL against the real database.

---

## 12. Traceability Matrix

| Brief item | Design section(s) | Requirement IDs / tests |
|---|---|---|
| A. Project description (centralized DB, register, update, courses/sections, reports, student login) | §2, §3, §4 | FR-REG-*, FR-ADM-*, FR-STU-* |
| B. O1 centralized web system | §3 | all FRs |
| B. O2 register and maintain records | §5.5 | FR-REG-01, 02, 07 · TC-02 |
| B. O3 student access to own info | §5.4 | FR-STU-01…08 · TC-03, TC-04 |
| B. O4 courses, sections, year levels | §4.2, §5.6 | FR-ADM-05, 06 · TC-07 |
| B. O5 reduce manual work, faster retrieval | §5.5, §5.7, §4.3 | FR-REG-05, 06 · NFR performance |
| B. O6 protect confidential info | §8 | S1–S10 |
| B. O7 prevent unauthorized access/modification | §5.2, §8.1 (S2, S3, S10) | SEC-03…05, SEC-13 |
| B. O8 accurate activity records | §4.4, §8.1 (S8) | FR-ADM-09 · SEC-11 |
| C. Student module | §5.4 | FR-STU-01…08 |
| C. Administrator module | §5.6 | FR-ADM-01…11 |
| C. Staff/Registrar module | §5.5 | FR-REG-01…07 |
| D. User roles table | §5.2 | RBAC matrix test |
| E.1 Password hashing | §5.3, §8.1 | S1 |
| E.2 Authentication | §5.3, §8.1 | S2 |
| E.3 RBAC | §5.2 | S3 |
| E.4 Data confidentiality | §8.1, §8.3 | S4 |
| E.5 SQL injection prevention | §3.3, §8.1 | S5 · SEC-01, 02 |
| E.6 Input validation | §6.4, §8.1 | S6 · SEC-05, 06 |
| E.7 Session management | §5.3, §8.1 | S7 · SEC-08, 09, 14 |
| E.8 Activity logs | §4.2, §8.1 | S8 |
| E.9 Account management | §5.6, §9.4 | S9 · TC-08 |
| E.10 Data integrity | §4.4 | S10 · TC-05, 06 |
| G. Example workflow | §9.1 | Acceptance criteria §11.4 |

---

## 13. Risks, Limitations, and Future Work

### 13.1 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Free-tier limits (DB storage/compute, function time) | Medium | Medium | Paginate, cap exports, monitor usage; upgrade plan before real deployment |
| Cold start + bcrypt slows first login | Medium | Low | Keep cost 12; accept ~0.5 s first-login latency |
| Misconfigured env variables (wrong DB URL, missing `SESSION`/`CRON_SECRET`) | Medium | High | Validate env with Zod at startup (`env.ts`), fail fast |
| Over-reliance on middleware for access control | Low | High | Authorization in services; RBAC tests (§8.4) |
| No email, so password recovery depends on an administrator | High | Low | Documented admin reset procedure; email recovery in future work |
| Real student PII used in demos | Medium | High | Use synthetic data for demos and previews |

### 13.2 Known Limitations

- Single-campus, single-school-year-at-a-time UX (data model supports multiple terms).
- No MFA in v1.0.
- PDF output relies on the browser's print-to-PDF.

### 13.3 Future Work

1. Multi-factor authentication (TOTP) for staff and admin.
2. Email-based password reset and notifications (Resend/SMTP).
3. Per-IP rate limiting with Upstash Redis.
4. `pg_trgm` full-text-style name search; materialized dashboard counts.
5. Bulk import of students via CSV with validation preview.
6. Field-level encryption (AES-256-GCM) for guardian contact and similar fields.
7. Visitor/time-in-time-out log table, if the adviser's intent for the "visitor time-out" item (A1) is a physical visit record.
8. Document attachments (Vercel Blob / S3) with malware scanning.
9. Fine-grained, admin-editable permissions (custom roles).

---

## 14. Implementation Plan

| Phase | Deliverables | Exit criteria |
|---|---|---|
| **1. Foundation** | Repo, Next.js + TS + Tailwind, Prisma schema + migrations, Neon DB, env validation, CI | App deploys to Vercel and connects to the real DB |
| **2. Auth and security core** | Password hashing, sessions, login/logout/password change, lockout, RBAC helpers, audit logger, security headers, seed admin | S1, S2, S3, S7, S8 tests pass |
| **3. Admin data setup** | Programs, sections, account management, staff accounts | FR-ADM-05, 06, 10 pass |
| **4. Registrar workflows** | Student registration, profile update, enrollment, section assignment, search/filter | FR-REG-01…05, 07 pass; TC-02, 05, 07 |
| **5. Student portal** | Profile, enrollment, academic view, self-update, password change | FR-STU-01…08 pass |
| **6. Reports and dashboard** | Dashboard stats, CSV/print reports, log viewer | FR-ADM-02, 08, 09; FR-REG-06 |
| **7. Hardening and release** | Security test suite, performance check, README/user guide, production checklist | §10.6 complete; acceptance demo (§9.1) on production URL |

---

## Appendix A – Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // pooled connection (runtime)
  directUrl = env("DIRECT_URL")   // direct connection (migrations)
}

enum Role {
  STUDENT
  STAFF
  ADMIN
}

enum AccountStatus {
  ACTIVE
  INACTIVE
  LOCKED
}

enum Sex {
  MALE
  FEMALE
}

enum EnrollmentStatus {
  ENROLLED
  NOT_ENROLLED
  ON_LEAVE
  GRADUATED
  DROPPED
}

enum Semester {
  FIRST
  SECOND
  MIDYEAR
}

enum Outcome {
  SUCCESS
  FAILURE
}

model User {
  id                 String        @id @default(uuid()) @db.Uuid
  username           String        @unique
  email              String?       @unique
  passwordHash       String        @map("password_hash")
  role               Role
  status             AccountStatus @default(ACTIVE)
  mustChangePassword Boolean       @default(true) @map("must_change_password")
  failedLoginCount   Int           @default(0) @map("failed_login_count")
  lockedUntil        DateTime?     @map("locked_until") @db.Timestamptz
  lastLoginAt        DateTime?     @map("last_login_at") @db.Timestamptz
  passwordChangedAt  DateTime?     @map("password_changed_at") @db.Timestamptz
  createdById        String?       @map("created_by_id") @db.Uuid
  createdAt          DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  student   Student?
  sessions  Session[]
  auditLogs AuditLog[]

  @@index([role, status])
  @@map("users")
}

model Session {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  ip         String?
  userAgent  String?   @map("user_agent")
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz
  lastSeenAt DateTime  @default(now()) @map("last_seen_at") @db.Timestamptz
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}

model Program {
  id          String  @id @default(uuid()) @db.Uuid
  code        String  @unique
  name        String
  description String?
  isActive    Boolean @default(true) @map("is_active")

  sections    Section[]
  students    Student[]
  enrollments Enrollment[]

  @@map("programs")
}

model Section {
  id         String  @id @default(uuid()) @db.Uuid
  programId  String  @map("program_id") @db.Uuid
  yearLevel  Int     @map("year_level") @db.SmallInt
  name       String
  schoolYear String  @map("school_year")
  capacity   Int?
  isActive   Boolean @default(true) @map("is_active")

  program     Program      @relation(fields: [programId], references: [id], onDelete: Restrict)
  students    Student[]
  enrollments Enrollment[]

  @@unique([programId, yearLevel, name, schoolYear])
  @@map("sections")
}

model Student {
  id               String           @id @default(uuid()) @db.Uuid
  userId           String?          @unique @map("user_id") @db.Uuid
  studentNumber    String           @unique @map("student_number")
  firstName        String           @map("first_name")
  middleName       String?          @map("middle_name")
  lastName         String           @map("last_name")
  suffix           String?
  sex              Sex
  birthDate        DateTime         @map("birth_date") @db.Date
  contactNumber    String?          @map("contact_number")
  address          String?
  personalEmail    String?          @map("personal_email")
  guardianName     String?          @map("guardian_name")
  guardianContact  String?          @map("guardian_contact")
  programId        String           @map("program_id") @db.Uuid
  yearLevel        Int              @map("year_level") @db.SmallInt
  sectionId        String?          @map("section_id") @db.Uuid
  enrollmentStatus EnrollmentStatus @default(ENROLLED) @map("enrollment_status")
  dateEnrolled     DateTime?        @map("date_enrolled") @db.Date
  version          Int              @default(1)
  deletedAt        DateTime?        @map("deleted_at") @db.Timestamptz
  createdById      String?          @map("created_by_id") @db.Uuid
  updatedById      String?          @map("updated_by_id") @db.Uuid
  createdAt        DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  user            User?            @relation(fields: [userId], references: [id], onDelete: SetNull)
  program         Program          @relation(fields: [programId], references: [id], onDelete: Restrict)
  section         Section?         @relation(fields: [sectionId], references: [id], onDelete: Restrict)
  enrollments     Enrollment[]
  academicRecords AcademicRecord[]

  @@index([lastName, firstName])
  @@index([programId, yearLevel, sectionId])
  @@index([enrollmentStatus])
  @@index([deletedAt])
  @@map("students")
}

model Enrollment {
  id           String           @id @default(uuid()) @db.Uuid
  studentId    String           @map("student_id") @db.Uuid
  programId    String           @map("program_id") @db.Uuid
  sectionId    String?          @map("section_id") @db.Uuid
  schoolYear   String           @map("school_year")
  semester     Semester
  yearLevel    Int              @map("year_level") @db.SmallInt
  status       EnrollmentStatus
  enrolledById String?          @map("enrolled_by_id") @db.Uuid
  createdAt    DateTime         @default(now()) @map("created_at") @db.Timestamptz

  student Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
  program Program  @relation(fields: [programId], references: [id], onDelete: Restrict)
  section Section? @relation(fields: [sectionId], references: [id], onDelete: Restrict)

  @@unique([studentId, schoolYear, semester])
  @@index([sectionId])
  @@map("enrollments")
}

model AcademicRecord {
  id           String   @id @default(uuid()) @db.Uuid
  studentId    String   @map("student_id") @db.Uuid
  schoolYear   String   @map("school_year")
  semester     Semester
  subjectCode  String   @map("subject_code")
  subjectTitle String   @map("subject_title")
  units        Decimal  @db.Decimal(3, 1)
  grade        String?
  remarks      String?
  encodedById  String?  @map("encoded_by_id") @db.Uuid

  student Student @relation(fields: [studentId], references: [id], onDelete: Restrict)

  @@index([studentId, schoolYear, semester])
  @@map("academic_records")
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actorId    String?  @map("actor_id") @db.Uuid
  actorRole  Role?    @map("actor_role")
  action     String
  entityType String?  @map("entity_type")
  entityId   String?  @map("entity_id")
  outcome    Outcome  @default(SUCCESS)
  metadata   Json?
  ip         String?
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

> Note: `onDelete: SetNull` on `audit_logs.actor_id` is applied only by the database when a user row is hard-deleted. Because users are deactivated, not deleted, and the immutability trigger blocks row updates, hard-deleting users is **not** supported in the application. Keep it that way.

---

## Appendix B – SQL Hardening Migration

Create with `prisma migrate dev --create-only --name hardening`, paste the SQL below into the generated `migration.sql`, then run `prisma migrate dev`.

```sql
-- 1. Data integrity CHECK constraints
ALTER TABLE users
  ADD CONSTRAINT users_username_lowercase CHECK (username = lower(username));

ALTER TABLE sections
  ADD CONSTRAINT sections_year_level_range CHECK (year_level BETWEEN 1 AND 6),
  ADD CONSTRAINT sections_capacity_positive CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE students
  ADD CONSTRAINT students_year_level_range CHECK (year_level BETWEEN 1 AND 6),
  ADD CONSTRAINT students_birth_date_past CHECK (birth_date < CURRENT_DATE),
  ADD CONSTRAINT students_number_format CHECK (student_number ~ '^[A-Za-z0-9-]{6,20}$');

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_year_level_range CHECK (year_level BETWEEN 1 AND 6);

ALTER TABLE academic_records
  ADD CONSTRAINT academic_units_nonnegative CHECK (units >= 0);

-- 2. Immutable (append-only) audit log
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();
```

> Because of this trigger, the `ON DELETE SET NULL` action on `audit_logs.actor_id` would also be rejected. This is intentional: audit history must never be altered, which is why accounts are deactivated rather than deleted.

---

## Appendix C – Environment Variables

`.env.example`

```bash
# Database (Neon): pooled for runtime, direct for migrations
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/sims?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/sims?sslmode=require"

# Application
NODE_ENV="production"
APP_URL="https://your-app.vercel.app"
FEATURE_ACADEMIC_RECORDS="true"

# Cron protection (Vercel sends this as a Bearer token to cron paths)
CRON_SECRET="generate-a-long-random-string"

# One-time seed (use locally, remove from Vercel after seeding)
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="choose-a-strong-temporary-password"
SEED_DEMO_DATA="false"
```

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | Prod, Preview, Dev | Pooled runtime connection |
| `DIRECT_URL` | yes | Prod, Preview, Dev | Migrations |
| `APP_URL` | yes | Prod, Preview | Canonical origin (used for CSRF/Origin checks and redirects) |
| `CRON_SECRET` | yes | Prod | Authorizes the cron endpoint |
| `FEATURE_ACADEMIC_RECORDS` | no | all | Toggles the optional academic module |
| `SEED_*` | one-time | local only | First admin bootstrapping |

Generate secrets with `openssl rand -base64 32`. Validate all variables with Zod in `src/lib/env.ts` so the app fails fast with a clear message when something is missing.

---

## Appendix D – Reference Code for Security-Critical Modules

> Reference implementations to guide development. Adapt names and paths to your codebase.

### D.1 Prisma client singleton: `src/lib/db.ts`

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### D.2 Password hashing and policy: `src/lib/password.ts`

```ts
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { z } from "zod";

const COST = 12;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST); // equalizes timing for unknown users

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export async function verifyPassword(plain: string, hash: string | null | undefined) {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && !!hash);
}

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long (72 bytes max).");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function generateTemporaryPassword(length = 12) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
```

### D.3 Sessions: `src/lib/session.ts`

```ts
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const isProd = process.env.NODE_ENV === "production";
export const COOKIE_NAME = isProd ? "__Host-sims_sid" : "sims_sid";
const IDLE_MS = 20 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const TOUCH_MS = 60 * 1000;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + ABSOLUTE_MS),
    },
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_MS / 1000,
  });
}

// Read-only resolver (safe in Server Components: it never sets cookies).
export const getSession = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const s = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, username: true, role: true, status: true, mustChangePassword: true } } },
  });
  if (!s || s.revokedAt) return null;

  const now = Date.now();
  const expired = s.expiresAt.getTime() <= now || now - s.lastSeenAt.getTime() > IDLE_MS;
  if (expired) {
    await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    await audit({ actorId: s.user.id, actorRole: s.user.role, action: "SESSION_TIMEOUT" }); // brief A1
    return null;
  }
  if (s.user.status !== "ACTIVE") return null;

  if (now - s.lastSeenAt.getTime() > TOUCH_MS) {
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now) } });
  }
  return { sessionId: s.id, user: s.user };
});

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  jar.delete(COOKIE_NAME);
}

export const revokeAllSessions = (userId: string, exceptSessionId?: string) =>
  prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
```

### D.4 Permissions and guard: `src/lib/authz.ts`

```ts
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http";

export type Permission =
  | "profile:read:self" | "profile:update:self" | "academic:read:self"
  | "student:read" | "student:create" | "student:update" | "student:delete" | "student:restore"
  | "enrollment:manage" | "academic:manage"
  | "program:read" | "program:manage" | "section:read" | "section:manage" | "section:assign"
  | "account:manage" | "user:manage" | "report:generate" | "audit:read" | "dashboard:read";

const STUDENT: Permission[] = ["profile:read:self", "profile:update:self", "academic:read:self"];
const STAFF: Permission[] = [
  "student:read", "student:create", "student:update", "enrollment:manage", "academic:manage",
  "program:read", "section:read", "section:assign", "report:generate", "dashboard:read",
];
const ADMIN: Permission[] = [
  ...STAFF, "student:delete", "student:restore", "program:manage", "section:manage",
  "account:manage", "user:manage", "audit:read",
];

const PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  STUDENT: new Set(STUDENT),
  STAFF: new Set(STAFF),
  ADMIN: new Set(ADMIN),
};

export async function requirePermission(permission: Permission) {
  const session = await getSession();
  if (!session) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
  if (session.user.mustChangePassword) throw new HttpError(403, "PASSWORD_CHANGE_REQUIRED", "Change your password to continue.");
  if (!PERMISSIONS[session.user.role].has(permission)) {
    await audit({ actorId: session.user.id, actorRole: session.user.role, action: "ACCESS_DENIED", outcome: "FAILURE", metadata: { permission } });
    throw new HttpError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
  return session;
}
```

### D.5 Audit logger: `src/lib/audit.ts`

```ts
import { Prisma, Role, Outcome } from "@prisma/client";
import { prisma } from "@/lib/db";

const REDACT = new Set(["password", "newPassword", "currentPassword", "passwordHash", "temporaryPassword", "token"]);

function redact(obj?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!obj) return undefined;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, REDACT.has(k) ? "[REDACTED]" : v])
  ) as Prisma.InputJsonValue;
}

export type AuditInput = {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;           // e.g. LOGIN_SUCCESS, STUDENT_UPDATED
  entityType?: string;
  entityId?: string;
  outcome?: Outcome;
  metadata?: Record<string, unknown>; // store changed FIELD NAMES, not sensitive values
  ip?: string | null;
  userAgent?: string | null;
};

export async function audit(e: AuditInput, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: e.actorId ?? null,
      actorRole: e.actorRole ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      outcome: e.outcome ?? "SUCCESS",
      metadata: redact(e.metadata),
      ip: e.ip ?? null,
      userAgent: e.userAgent?.slice(0, 255) ?? null,
    },
  });
}
```

### D.6 HTTP helpers and CSRF origin check: `src/lib/http.ts`

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new HttpError(403, "BAD_ORIGIN", "Cross-origin request rejected.");
  }
}

export const ok = (data: unknown, init?: { status?: number; meta?: unknown }) =>
  NextResponse.json({ data, meta: init?.meta }, { status: init?.status ?? 200, headers: { "Cache-Control": "no-store" } });

export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }, { status: err.status });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input.", fieldErrors: err.flatten().fieldErrors } }, { status: 422 });
    }
    const id = crypto.randomUUID();
    console.error("unhandled", id, err); // never return err details to the client
    return NextResponse.json({ error: { code: "INTERNAL", message: `Something went wrong. Ref: ${id}` } }, { status: 500 });
  }
}
```

### D.7 Example route handler: `src/app/api/students/[id]/route.ts`

```ts
import { requirePermission } from "@/lib/authz";
import { assertSameOrigin, handle, ok } from "@/lib/http";
import { studentUpdateSchema } from "@/validation/student";
import { studentService } from "@/server/services/students";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const session = await requirePermission("student:update");
    const { id } = await params;
    const input = studentUpdateSchema.parse(await req.json()); // .strict(): unknown keys rejected
    return ok(await studentService.update(session, id, input)); // service handles version check + audit
  });
}
```

### D.8 Strict validation and optimistic locking (excerpt)

```ts
// src/validation/student.ts
import { z } from "zod";

export const selfUpdateSchema = z.object({
  contactNumber: z.string().regex(/^(09|\+639)\d{9}$/).nullable(),
  address: z.string().max(255).nullable(),
  personalEmail: z.string().email().max(254).nullable(),
  guardianName: z.string().max(120).nullable(),
  guardianContact: z.string().regex(/^(09|\+639)\d{9}$/).nullable(),
}).partial().strict(); // brief A5: only five fields, anything else = 422

// src/server/services/students.ts (excerpt)
const updated = await prisma.student.updateMany({
  where: { id, version: input.version, deletedAt: null },
  data: { ...fields, version: { increment: 1 }, updatedById: session.user.id },
});
if (updated.count === 0) throw new HttpError(409, "VERSION_CONFLICT", "This record was changed by someone else. Reload and try again.");
```

### D.9 Safe search query (parameterized via Prisma)

```ts
const where: Prisma.StudentWhereInput = {
  deletedAt: null,
  ...(q && {
    OR: [
      { studentNumber: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
    ],
  }),
  ...(programId && { programId }),
  ...(yearLevel && { yearLevel }),
  ...(sectionId && { sectionId }),
};
const SORTABLE = { lastName: "lastName", studentNumber: "studentNumber", createdAt: "createdAt" } as const; // allow-list
```

### D.10 Cron endpoint: `src/app/api/cron/purge-sessions/route.ts`

```ts
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] },
  });
  return Response.json({ purged: count });
}
```

---

## Appendix E – Configuration Files

### E.1 `package.json` (relevant parts)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma migrate deploy && next build",
    "start": "next start",
    "postinstall": "prisma generate",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "engines": { "node": ">=20" }
}
```

### E.2 `vercel.json`

```json
{
  "regions": ["sin1"],
  "crons": [
    { "path": "/api/cron/purge-sessions", "schedule": "0 18 * * *" }
  ]
}
```

(`0 18 * * *` UTC = 2:00 AM Philippine time.)

### E.3 `src/middleware.ts`: headers, CSP nonce, cookie gate

```ts
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/student", "/staff", "/admin", "/change-password"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieName = process.env.NODE_ENV === "production" ? "__Host-sims_sid" : "sims_sid";

  // Cheap gate only. Real authorization happens in pages/route handlers (defense in depth).
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !req.cookies.get(cookieName)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### E.4 `next.config.ts`: static security headers

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
```

### E.5 `prisma/seed.ts` (first admin)

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) throw new Error("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD are required.");
  if (await prisma.user.count({ where: { role: "ADMIN" } })) {
    console.log("An admin already exists. Nothing to do.");
    return;
  }
  await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN", mustChangePassword: true },
  });
  console.log(`Admin "${username}" created. Change the password at first login.`);
}

main().finally(() => prisma.$disconnect());
```

---

*End of document.*
