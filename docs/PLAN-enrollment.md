# Enrollment Model Implementation Plan

## Overview
Implement clinic-initiated invite model for patient enrollment with DOB verification.

## Phase 1: Core Enrollment (MVP-Critical)

### Day 1: Schema & Migration
- [ ] Add `Clinic` model to Prisma schema
- [ ] Add `ClinicMembership` model (clinician-clinic relationship)
- [ ] Add `Invite` model with code, status, expiration
- [ ] Update `Enrollment` model with `clinicId`, `enrolledVia`, `inviteId`
- [ ] Create migration
- [ ] Add seed script for demo clinic + membership

**Files:**
- `prisma/schema.prisma`
- `prisma/migrations/YYYYMMDD_enrollment_model/`
- `scripts/seed-clinic.ts`

### Day 2: Backend - Invite Endpoints
- [ ] Create `invite.service.ts` with:
  - `generateInviteCode()` - crypto random 40 chars
  - `createInvite(clinicId, clinicianId, patientName, dob, email?)`
  - `getInvite(code)` - public, returns clinic name only
  - `listPendingInvites(clinicId)`
  - `revokeInvite(inviteId)`
- [ ] Create `invite.routes.ts`:
  - `POST /clinician/clinic/:clinicId/invites`
  - `GET /clinician/clinic/:clinicId/invites`
  - `DELETE /clinician/clinic/:clinicId/invites/:inviteId`
  - `GET /auth/invite/:code` (public)
- [ ] Add clinic membership middleware check
- [ ] Add rate limiting (50/day per clinician)

**Files:**
- `src/services/invite.service.ts`
- `src/routes/invite.routes.ts`
- `src/middleware/clinicMembership.middleware.ts`

### Day 3: Backend - Claim Flow
- [ ] Add `claimInvite(code, dob, patientId?)` to invite service
  - Verify DOB matches
  - Create patient if needed (or link existing)
  - Create enrollment
  - Mark invite as claimed
- [ ] Create `POST /auth/invite/:code/claim` endpoint
- [ ] Update `enrollment.service.ts` for clinic-aware queries
- [ ] Update patient list queries to filter by clinic
- [ ] Add rate limiting (5 claims/hour per IP)

**Files:**
- `src/services/invite.service.ts` (update)
- `src/services/enrollment.service.ts` (update)
- `src/routes/auth.routes.ts` (update)

### Day 4: Frontend Integration
**Clinician App:**
- [ ] Add "Invite Patient" button/modal to patient list
- [ ] Create invite form (name, DOB, optional email)
- [ ] Show invite code with copy button
- [ ] Add pending invites view
- [ ] Add revoke invite action

**Patient App:**
- [ ] Add "Join Clinic" / "I have an invite code" flow
- [ ] Create code entry screen
- [ ] Create DOB verification screen
- [ ] Show success confirmation with clinic name

**Files:**
- `clinician/src/components/InvitePatientModal.tsx`
- `clinician/src/app/patients/page.tsx` (update)
- `patient/lib/screens/join_clinic_screen.dart`
- `patient/lib/screens/verify_dob_screen.dart`

---

## Phase 2: Clinic Management (Post-MVP)

### Clinic CRUD
- [ ] Clinic creation (admin only)
- [ ] Clinic settings page
- [ ] NPI and billing info

### Membership Management
- [ ] Invite clinician to clinic
- [ ] Remove clinician from clinic
- [ ] Role changes (owner, admin, clinician, staff)

---

## Phase 3: Multi-Clinic Support (Post-MVP)

### Clinician Experience
- [ ] Clinic switcher in header
- [ ] Per-clinic patient lists
- [ ] Cross-clinic patient view (if same patient at multiple clinics)

### Patient Experience
- [ ] View enrolled clinics
- [ ] Leave clinic (discharge self)

---

## Phase 4: Advanced Features (Post-MVP)

### Email Notifications
- [ ] Email invite link to patient
- [ ] Claim confirmation email
- [ ] Enrollment confirmation to clinician

### Invite Expiration
- [ ] Background job to expire old invites
- [ ] Configurable expiration per invite

### Audit Trail
- [ ] Log all invite/claim actions
- [ ] Admin view of enrollment history

---

## Testing Checklist

### Unit Tests
- [ ] Invite code generation uniqueness
- [ ] DOB verification logic
- [ ] Rate limiting behavior
- [ ] Invite expiration logic

### Integration Tests
- [ ] Full invite → claim → enrollment flow
- [ ] Clinic membership authorization
- [ ] Cross-clinic isolation
- [ ] Rate limit enforcement

### Manual Tests
- [ ] Clinician creates invite
- [ ] Patient claims with correct DOB
- [ ] Patient claim fails with wrong DOB
- [ ] Expired invite cannot be claimed
- [ ] Revoked invite cannot be claimed
- [ ] Patient appears in clinician's list after claim

---

## Security Review Checklist

- [ ] Invite codes are cryptographically random
- [ ] No timing attacks on DOB verification
- [ ] Rate limiting on all public endpoints
- [ ] Clinic boundary enforced on all patient queries
- [ ] No PII leakage in error messages
- [ ] Audit log for sensitive operations

---

## Migration Strategy

### Existing Data
Current demo data uses direct enrollment without clinic. Migration approach:

1. Create default "Demo Clinic"
2. Create ClinicMembership for existing clinicians
3. Update existing Enrollments with clinicId
4. Set `enrolledVia: 'migration'` for existing enrollments

---

## Estimated Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Core enrollment | 4 days |
| Phase 2 | Clinic management | 2 days |
| Phase 3 | Multi-clinic UX | 2 days |
| Phase 4 | Email + advanced | 2 days |

**Total: ~10 days for full feature set**
**MVP-critical (Phase 1): 4 days**
