# Nephrawn

A clinician-centered digital health platform for longitudinal management of patients with Chronic Kidney Disease (CKD).

## Overview

Nephrawn enables structured collection of patient-reported symptoms, device-derived physiological measurements, and clinical interactions over time. The platform helps clinicians identify meaningful trends and changes that may indicate worsening fluid status, disease progression, or increased risk of hospitalization.

**Key Principle:** Nephrawn augments—not replaces—clinical judgment.

## Features

### Current (MVP)
- **Patient symptom tracking** - Structured check-ins for CKD-relevant symptoms
- **Manual measurement entry** - Weight, blood pressure, SpO2, heart rate
- **Time-series visualization** - Charts with clinically meaningful trend detection
- **Rule-based alerts** - Threshold-based notifications with explainability
- **Clinic-initiated enrollment** - Secure invite model with DOB verification
- **Multi-clinic support** - Clinicians can work across multiple clinics
- **Role-based access** - Owner, Admin, Clinician, Staff roles
- **RPM/CCM interaction logging** - Audit trail for billing compliance

### Planned (MVP+)
- Device integration (Withings)
- Lab result uploads
- LLM-powered summaries
- Email notifications

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Patient App    │     │  Clinician App  │
│  (Flutter)      │     │  (React/Next)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   Backend   │
              │  (Node/TS)  │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  PostgreSQL │
              └─────────────┘
```

| Layer | Technology |
|-------|------------|
| Patient App | Flutter (iOS, Android, macOS, Web) |
| Clinician App | Next.js / React |
| Backend | Node.js + TypeScript + Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (role-based) |

## Project Structure

```
nephrawn/
├── apps/
│   ├── clinician/          # Next.js clinician portal
│   └── patient/            # Flutter patient app
├── backend/
│   ├── prisma/             # Database schema & migrations
│   └── src/
│       ├── routes/         # API endpoints
│       ├── services/       # Business logic
│       └── middleware/     # Auth, rate limiting
└── docs/                   # Architecture & decisions
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Flutter 3.x (for patient app)
- pnpm (recommended) or npm

### Backend Setup

```bash
cd backend

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and JWT secret

# Run migrations
pnpm prisma migrate dev

# Seed demo data
pnpm prisma db seed

# Start development server
pnpm dev
```

The backend runs on `http://localhost:3000`.

### Clinician App Setup

```bash
cd apps/clinician

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The clinician app runs on `http://localhost:3001`.

### Patient App Setup

```bash
cd apps/patient

# Get dependencies
flutter pub get

# Run on macOS (development)
flutter run -d macos

# Run on Chrome (web)
flutter run -d chrome

# Run on iOS simulator
flutter run -d ios
```

### Demo Credentials

After seeding the database:

| Role | Email | Password |
|------|-------|----------|
| Clinician (Owner) | clinician1@test.com | password123 |
| Clinician | clinician2@test.com | password123 |
| Patient | patient1@test.com | password123 |

## Documentation

- [Product Requirements](docs/PRD.md) - Features and scope
- [Architecture](docs/ARCH.md) - Technical design and API reference
- [Database Schema](docs/DB.md) - Domain model
- [Decisions](docs/DECISIONS.md) - Design rationale and tradeoffs
- [Enrollment Plan](docs/PLAN-enrollment.md) - Implementation status

## Key Design Decisions

1. **Backend-first development** - Define domain model and APIs before UI
2. **Rule-based signals** - Transparent, explainable alerts before AI models
3. **Clinic-initiated enrollment** - Clinicians control patient access (no self-enrollment)
4. **Canonical units** - All measurements stored in standard units (kg, mmHg, %, bpm)
5. **Clinical trend thresholds** - Trends use clinically significant deltas, not percentages

## Security

- JWT authentication with role claims
- Clinic boundary enforcement on all queries
- 40-character cryptographic invite codes
- DOB verification for patient enrollment
- Rate limiting on public endpoints
- No PHI in logs or error messages

## License

Proprietary - All rights reserved.

## Contributing

This is a private project. Contact the maintainers for contribution guidelines.
