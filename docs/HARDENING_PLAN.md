# NEPHRAWN MVP HARDENING PLAN

---

## A) EXECUTIVE SUMMARY

### Current State
The Nephrawn MVP is **functionally complete** across all three tiers:
- Backend: Node.js + TypeScript + Prisma with 28 working endpoints
- Patient App: Flutter with auth, measurements, symptoms, dashboard, and alerts
- Clinician App: React/Next.js with patient list, charts, alerts, and notes

### Key Assessment
The architecture is **sound and clinically realistic**. Decisions around canonical units, alert deduplication, transaction boundaries, and explainable alerts are well-designed. The codebase is **ready for demos but not for pilots or production** without the hardening work outlined below.

### Critical Blockers (Must Fix Before Any Real Use)
| # | Issue | Component | Risk Level |
|---|-------|-----------|------------|
| 1 | Hardcoded JWT secret fallback | Backend | **CRITICAL** (data breach) |
| 2 | No rate limiting on auth endpoints | Backend | **CRITICAL** (brute-force) |
| 3 | Token lost on page refresh (web) | Clinician App | **CRITICAL** (unusable) |
| 4 | BP category logic error (OR vs AND) | Patient App | **CRITICAL** (clinical safety) |
| 5 | No persistent auth session | Both Apps | **HIGH** (session loss) |

### Hardening Scope
- 1 week for critical fixes
- 1 week for testing, polish, and safety checks
- **Exit criteria**: All critical issues resolved, manual test checklist passed, observability in place

---

## B) BACKEND HARDENING FINDINGS

### B.1 Critical Security Issues

| Issue | File:Line | Impact | Fix Effort |
|-------|-----------|--------|------------|
| Hardcoded JWT secret default | `config.ts:6` | Production tokens can be forged | 15 min |
| No rate limiting on login/register | `index.ts` | Brute-force password attacks | 1 hr |
| `.env` with real credentials in repo | `.env` | Credential exposure if public | 10 min |
| CORS hardcoded to localhost | `index.ts:12-15` | Can't deploy to other domains | 30 min |

### B.2 Error Handling Weaknesses

| Issue | File:Line | Impact |
|-------|-----------|--------|
| Global error handler returns 500 for everything | `index.ts:34-37` | No error differentiation, poor debugging |
| Alert rule evaluation fails silently | `alert.service.ts:242-244` | Lost alerts, no operator visibility |
| Inconsistent HTTP status codes | `patient.routes.ts:110-115` | 200 for duplicates instead of 409 |
| Generic catch blocks throughout routes | Multiple | No error categorization |

### B.3 Validation Gaps

| Issue | File:Line | Risk |
|-------|-----------|------|
| No bounds on measurement values | `validation.ts:50` | Accept weight=999999 kg |
| Password only checks length (8 chars) | `validation.ts:5` | Weak passwords allowed |
| No dateOfBirth age validation | `validation.ts:7` | Future dates, 120+ year olds |

### B.4 Testing & Observability

- **Zero test files** - no unit, integration, or e2e tests
- **No structured logging** - only `console.error` scattered throughout
- **No request correlation IDs** - impossible to trace request flow
- **No health check beyond `/health: {status:"ok"}`**
- **No metrics collection** (latency, error rates, endpoint usage)

### B.5 Missing Safeguards

| Gap | Impact |
|-----|--------|
| No soft deletes | HIPAA retention compliance risk |
| No audit trail for note/alert changes | Can't track who did what |
| Unused `summaryText` field on Alert | LLM integration placeholder, confusing |
| Hardcoded 5-min dedup window | Not configurable for edge cases |

---

## C) PATIENT APP (FLUTTER) HARDENING FINDINGS

### C.1 Critical Issues

| Issue | File:Line | Impact |
|-------|-----------|--------|
| **BP category logic uses OR instead of AND** | `bp_history_screen.dart:252` | Misclassifies hypertension stages - **clinical safety** |
| Hardcoded API base URL | `api_endpoints.dart:3-4` | Cannot deploy to different environments |
| Auth token race condition in interceptor | `api_client.dart:62-76` | Requests may be sent without auth |
| In-memory token on macOS (dev hack) | `secure_storage.dart:11-20` | Token exposed in memory |

### C.2 State Management Issues

| Issue | File:Line | Impact |
|-------|-----------|--------|
| `SymptomCheckinProvider.isEmpty` doesn't check loading state | `symptom_checkin_provider.dart:22` | "No data" shown during initial load |
| WeightHistoryProvider error doesn't clear `hasLoaded` | `weight_history_provider.dart:51-59` | Retry shows loading instead of error |
| Role hardcoded as 'patient' | `auth_service.dart:46-47` | Backend contract assumption |

### C.3 Validation Weaknesses

| Issue | File:Line |
|-------|-----------|
| Email validation: only checks `contains('@')` | `login_form.dart:90`, `registration_form.dart:143` |
| No password confirmation field | `registration_form.dart` |
| Unsafe type casting in JSON parsing | `dashboard.dart:175-179` |

### C.4 UX Inconsistencies

| Issue | Impact |
|-------|--------|
| SpO2 and Heart Rate cards disabled (no entry screens) | Confusing buttons |
| Inconsistent error messages (technical vs. generic) | User confusion |
| No network connectivity detection | Wrong error messages shown |
| No retry limits or backoff | Infinite retry loops possible |

### C.5 Testing

- Only one empty test file exists
- No provider tests, model tests, or API client tests

---

## D) CLINICIAN APP (REACT/NEXT.JS) HARDENING FINDINGS

### D.1 Critical Issues

| Issue | File:Line | Impact |
|-------|-----------|--------|
| **Token lost on page refresh** | `api.ts:3` | Users logged out unexpectedly - **MVP unusable for real work** |
| No auth persistence on app load | `AuthContext.tsx:29-30` | Session not restored |
| No route protection middleware | Multiple pages | All pages manually check auth |

### D.2 Error Handling

| Issue | File:Line | Impact |
|-------|-----------|--------|
| Uses `alert()` for errors | `notes/page.tsx:58,71,81` | Blocking, unprofessional |
| Silent error in navbar alert count | `Navbar.tsx:24-25` | No indication of failure |
| No error boundary component | N/A | Unhandled errors crash UI |

### D.3 Code Quality Issues

| Issue | Impact |
|-------|--------|
| Loading spinner duplicated 15+ times | Maintenance burden |
| Patient type defined in 3 places | Type inconsistency risk |
| `Record<string, unknown>` for alert inputs | Type unsafety |
| No data caching (React Query/SWR) | Inefficient fetching |

### D.4 Missing Features

| Feature | Impact on Demo/Pilot |
|---------|---------------------|
| No pagination on alerts/notes | Performance with large datasets |
| No search on patient list | Finding patients is manual |
| No custom date range for charts | Limited analysis capability |
| No audit trail for note edits | Compliance concern |

### D.5 Race Conditions

| Issue | File:Line |
|-------|-----------|
| Rapid metric switching could race | `measurements/page.tsx:82-83` |
| No AbortController for cancelled requests | Multiple fetching locations |
| Optimistic updates with poor rollback | `alerts/page.tsx:53-68` |

---

## E) TESTING PLAN

### E.1 Unit Tests (High Value, Low Effort)

**Backend - Critical**
| Test Target | File | Why It Matters |
|-------------|------|----------------|
| Unit conversion (kg<->lbs) | `units.ts` | Data integrity |
| Validation schemas | `validation.ts` | Input sanitization |
| JWT sign/verify | `jwt.ts` | Auth correctness |
| Trend calculation | `timeseries.service.ts` | Clinical accuracy |
| Alert rule evaluation | `alert.service.ts` | Alert correctness |
| Measurement deduplication | `measurement.service.ts` | Data quality |

**Patient App - Critical**
| Test Target | File | Why It Matters |
|-------------|------|----------------|
| BP category colors | `bp_history_screen.dart` | Clinical safety (fix bug first) |
| Model JSON parsing | `core/models/*.dart` | API contract stability |
| Auth state transitions | `auth_provider.dart` | Session reliability |

**Clinician App - Critical**
| Test Target | File | Why It Matters |
|-------------|------|----------------|
| Alert input formatting | `AlertCard.tsx` | Display correctness |
| API error class | `api.ts` | Error handling |
| Type guards for API responses | `types.ts` | Runtime safety |

### E.2 Integration Tests (Backend API)

| Flow | Endpoints | What to Verify |
|------|-----------|----------------|
| Patient registration + login | `POST /auth/patient/register`, `POST /auth/patient/login` | Token returned, user created |
| Measurement -> Alert | `POST /patient/measurements` | Alert triggered for threshold breach |
| Measurement deduplication | `POST /patient/measurements` (x2) | Second returns `isDuplicate: true` |
| Clinician alert workflow | `GET /clinician/alerts`, `POST .../acknowledge` | Status transitions correctly |
| Note CRUD | All `/clinician/notes/*` endpoints | Create, update, delete work |
| Time-series queries | `GET /patient/charts/:type` | Returns valid data structure |

**Failure Modes to Test:**
- Invalid JWT token -> 401
- Wrong patient ID -> 404
- Unauthorized clinician -> 403
- Malformed request body -> 400 with details
- Server error -> 500 with correlation ID

### E.3 End-to-End Flows (Manual + Automated)

**Patient Journey**
1. Register new account
2. Log in with credentials
3. Add weight measurement
4. Add blood pressure
5. Complete symptom check-in
6. View dashboard with trends
7. View alerts if triggered

**Clinician Journey**
1. Log in to web app
2. View patient list
3. Select patient, view dashboard
4. View measurement charts (toggle metrics)
5. View and respond to alerts (acknowledge/dismiss)
6. Create/edit/delete note
7. Log out

### E.4 Manual Test Checklist

**Pre-Demo Checklist**
- [ ] Patient can register and log in (valid credentials)
- [ ] Patient login fails gracefully (wrong password)
- [ ] Weight entry works (lbs -> stored as kg)
- [ ] BP entry works (paired correctly)
- [ ] Symptom checkin with all fields
- [ ] Dashboard loads without errors
- [ ] Dashboard shows trends correctly
- [ ] Clinician can log in
- [ ] Clinician sees enrolled patients
- [ ] Clinician can view patient detail
- [ ] Charts render with real data
- [ ] Alerts appear for threshold breaches
- [ ] Alert acknowledge/dismiss works
- [ ] Notes can be created/edited/deleted
- [ ] Logout works on both apps
- [ ] Page refresh doesn't crash (clinician app - after fix)

**Edge Case Checklist**
- [ ] Weight of 0 rejected
- [ ] BP systolic < diastolic shows error
- [ ] Date in future rejected
- [ ] Empty symptom checkin rejected
- [ ] Very long note content handled
- [ ] Network timeout shows error message
- [ ] Invalid token redirects to login

---

## F) SAFETY & CLINICAL RISK REVIEW

### F.1 Scenarios That Could Confuse Patients

| Scenario | Risk | Mitigation |
|----------|------|------------|
| "insufficient_data" trend shown | Patient thinks app is broken | Add explanation: "4+ readings over 24+ hours needed for trends" |
| BP category shows wrong color | Patient misunderstands severity | **FIX BUG** (OR->AND logic) |
| Disabled SpO2/HR buttons | Patient thinks feature broken | Add "Coming soon" label or hide entirely |
| Alert without context | Patient alarmed by technical jargon | Improve `ruleName` to be patient-friendly |
| Measurement rejected as duplicate | Patient thinks data wasn't saved | Show confirmation: "Already recorded - we got it!" |

### F.2 Scenarios That Could Mislead Clinicians

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Stale dashboard after refresh | Clinician makes decision on old data | Add "Last updated" timestamp |
| Alert dismissed accidentally | No undo, alert gone | Add confirmation dialog |
| Note deleted without warning | Lost clinical documentation | Add confirmation dialog |
| Empty patient list (no enrollments) | Clinician thinks system broken | Add explanation: "No patients assigned yet" |
| Charts with no data in date range | Looks like patient not compliant | Show "No readings in this period" vs "Never recorded" |

### F.3 Alert Fatigue Risks

| Risk Factor | Current State | Recommendation |
|-------------|---------------|----------------|
| Alert spam for ongoing conditions | **Mitigated** - alert upsert pattern prevents duplicates | Keep |
| No alert severity filtering | UI shows all severities mixed | Add severity filter toggle |
| No alert "snooze" capability | Clinician must dismiss or acknowledge | Consider MVP+ feature |
| All alerts treated equally | Critical mixed with info | Visual hierarchy by severity |

### F.4 Data Interpretation Risks

| Risk | Source | Mitigation |
|------|--------|------------|
| Unit confusion (lbs vs kg) | Display shows lbs, stored in kg | Consistent UI labeling with unit |
| Time zone confusion | Dashboard uses UTC | Display patient's local timezone |
| Trend direction misinterpretation | "increasing" weight could be good or bad | Add clinical context icons |
| Aggregated data hides outliers | Daily averages smooth spikes | Show min/max alongside average |

### F.5 Recommended Copy Improvements

| Current | Improved |
|---------|----------|
| "insufficient_data" | "Need more readings for trend (4+ over 24 hours)" |
| "No data available" | "No readings recorded yet - add your first measurement" |
| "Alert acknowledged" | "Noted - this alert is now in your reviewed list" |
| "Error: Connection timeout" | "Couldn't reach server - check your connection and try again." |
| "weight_gain_48h" rule name | "Rapid Weight Increase" |

---

## G) OBSERVABILITY & OPS IMPROVEMENTS

### G.1 Current Logging State

| Component | Current | Gap |
|-----------|---------|-----|
| Backend | `console.log/error` only | No structured logging, no correlation |
| Patient App | None | No error tracking |
| Clinician App | None | No error tracking |

### G.2 Required Logging Additions

**Backend - Minimum Viable Logging**
```
- Request: {requestId, method, path, userId, timestamp}
- Response: {requestId, status, durationMs}
- Error: {requestId, error, stack, context}
- Auth: {event: login/logout/failure, userId, ip}
- Clinical: {event: measurement/alert/note, patientId, clinicianId}
```

**Recommended Package**: `pino` or `winston` with JSON output

### G.3 Metrics to Collect

| Metric | Why |
|--------|-----|
| API latency by endpoint | Identify slow queries |
| Error rate by endpoint | Find broken flows |
| Auth failure count | Detect brute-force attempts |
| Alert generation rate | Monitor for spam |
| Measurement submission rate | Track patient engagement |

### G.4 Debugging Pilot Issues

**What would help diagnose real-world issues:**
- Request correlation IDs (trace through logs)
- Error aggregation dashboard (Sentry, Datadog)
- Database query logging (slow queries)
- Network timing (client-side errors)

### G.5 Health Check Enhancements

Current: `GET /health` -> `{status: "ok"}`

Recommended:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "uptime": "2h 15m",
  "timestamp": "2025-01-04T10:00:00Z"
}
```

---

## H) PROFESSIONAL POLISH CHECKLIST

### H.1 Copy Consistency

- [ ] All error messages use consistent tone (friendly, not technical)
- [ ] All empty states have actionable messaging
- [ ] Button labels are verb-first ("Save Note" not "Note Save")
- [ ] Confirmation messages are specific ("Weight saved" not "Success")
- [ ] Loading states say what's loading ("Loading patients...")

### H.2 Empty States

| Screen | Current | Recommended |
|--------|---------|-------------|
| Dashboard (no data) | Shows cards with "-" | Add "Add your first reading" CTA |
| Patient list | "No patients enrolled" | Add context about enrollment |
| Alerts (none) | "No alerts" | "All clear - no alerts to review" |
| Notes (none) | "No notes yet" | "Add a clinical note to start documentation" |
| Charts (no data) | "No data available" | "No readings in this period. Try expanding date range." |

### H.3 Error Messages

| Error Type | Current | Recommended |
|------------|---------|-------------|
| Network timeout | "Connection timeout" | "Couldn't connect to server. Check your internet and try again." |
| Server error | "Internal server error" | "Something went wrong on our end. Please try again." |
| Auth failure | "Invalid credentials" | "Email or password is incorrect. Please try again." |
| Validation error | `{details: [...]}` | "Please check: Email format is invalid" |

### H.4 Loading States

- [ ] All screens have loading indicators
- [ ] Loading appears within 200ms of action
- [ ] Spinners are consistent across both apps
- [ ] Charts show skeleton while loading

### H.5 Trust Signals

- [ ] Version number visible in settings/profile
- [ ] "Last synced" timestamp on dashboard
- [ ] Confirmation after successful actions
- [ ] Clear indication of saved vs. unsaved state

---

## I) RELEASE READINESS CHECKLIST

### I.1 Safe to Demo?

| Criterion | Status | Blocker? |
|-----------|--------|----------|
| Core flows work (patient + clinician) | Yes | - |
| No obvious crashes on happy path | Yes | - |
| Token persistence (web) | No - lost on refresh | **YES** |
| Data displays correctly | Mostly | - |
| Alerts generate for thresholds | Yes | - |
| Professional appearance | Acceptable | - |

**Verdict**: Demo-able with caveats. Do not refresh the web app during demo.

### I.2 Safe for Pilot?

| Criterion | Status | Blocker? |
|-----------|--------|----------|
| Token persistence | Critical | **YES** |
| Rate limiting on auth | Missing | **YES** |
| JWT secret not hardcoded | Dev fallback exists | **YES** |
| BP category logic correct | Bug present | **YES** |
| Error handling graceful | Partial | No |
| Observability for debugging | None | Yes (for support) |
| Basic test coverage | None | Yes (for confidence) |

**Verdict**: NOT safe for pilot without resolving blockers.

### I.3 What Would Block Limited Real-World Rollout?

**Hard Blockers (Must Fix)**
1. JWT secret fallback - production compromise
2. Rate limiting - security baseline
3. Token persistence - usability baseline
4. BP logic bug - clinical safety

**Soft Blockers (Strongly Recommended)**
1. Structured logging - cannot debug production issues
2. Error boundaries - crashes lose user data
3. Basic test suite - cannot refactor safely
4. Environment configuration - cannot deploy to staging/prod

---

## J) HARDENED-MVP EXECUTION PLAN

### Phase: MVP Stabilization

**Duration**: ~2 weeks
**Goal**: Resolve all critical issues, establish testing baseline, prepare for pilot

---

### Week 1: Critical Fixes & Security

**Day 1-2: Security Hardening**
- [ ] Remove JWT secret fallback; require env var (throw on missing)
- [ ] Add rate limiting middleware to auth endpoints (express-rate-limit)
- [ ] Move `.env` to `.gitignore`, create `.env.example`
- [ ] Make CORS origins configurable via environment

**Day 2-3: Authentication Fixes**
- [ ] Clinician App: Implement token persistence (httpOnly cookie or secure storage)
- [ ] Clinician App: Add session restoration on app load
- [ ] Patient App: Fix auth token race condition in interceptor

**Day 3-4: Clinical Safety**
- [ ] Patient App: Fix BP category logic (OR -> AND)
- [ ] Add unit tests for BP classification
- [ ] Review all clinical display logic

**Day 4-5: Error Handling**
- [ ] Backend: Categorize errors (400/401/403/404/500)
- [ ] Backend: Add request correlation IDs
- [ ] Clinician App: Replace `alert()` with toast notifications
- [ ] Both Apps: Add error boundary components

---

### Week 2: Testing & Polish

**Day 1-2: Unit Testing Foundation**
- [ ] Backend: Set up Jest/Vitest
- [ ] Backend: Unit tests for `units.ts`, `validation.ts`, `jwt.ts`
- [ ] Backend: Unit tests for trend calculation
- [ ] Patient App: Test BP classification, model parsing

**Day 2-3: Integration Testing**
- [ ] Backend: Auth flow tests (register, login, protected routes)
- [ ] Backend: Measurement -> Alert flow test
- [ ] Backend: Clinician alert workflow test

**Day 3-4: Observability**
- [ ] Backend: Add structured logging (pino/winston)
- [ ] Backend: Enhance health check endpoint
- [ ] Document logging format for debugging

**Day 4-5: Polish & Manual Testing**
- [ ] Execute full manual test checklist
- [ ] Fix any issues found
- [ ] Review all error messages and empty states
- [ ] Verify all confirmation dialogs work

---

### Exit Criteria (Before MVP+ Work)

**All boxes must be checked:**

- [ ] No hardcoded secrets in codebase
- [ ] Rate limiting active on auth endpoints
- [ ] Token persists across page refresh (clinician app)
- [ ] BP classification logic correct with test
- [ ] Structured logging in place
- [ ] Unit tests for critical paths (validation, units, auth)
- [ ] Integration tests for core flows
- [ ] Manual test checklist passed
- [ ] All critical/high issues from this document resolved
- [ ] Environment configuration working (dev, can run prod)

---

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep into MVP+ features | Strict adherence to this plan; defer enhancements |
| Test coverage taking too long | Focus on highest-risk paths only (security, clinical) |
| New bugs discovered during testing | Prioritize by severity; minor issues logged for later |
| Team fatigue | Fixed 2-week timebox; celebrate completion |

---

### Post-Stabilization

Once all exit criteria are met:
1. Document lessons learned
2. Update `DECISIONS.md` with new architectural decisions
3. Create deployment checklist for staging/production
4. Begin MVP+ Phase 1 planning (per PRD roadmap)

---

## Files with Critical Issues (Quick Reference)

| File | Issue |
|------|-------|
| `backend/src/lib/config.ts:6` | JWT secret fallback |
| `backend/src/index.ts` | No rate limiting |
| `apps/clinician/src/lib/api.ts:3` | Token persistence |
| `apps/patient/lib/features/blood_pressure/bp_history_screen.dart:252` | BP logic bug |

---

**Document Version**: 1.0
**Generated**: 2025-01-04
**Status**: Ready for Review
