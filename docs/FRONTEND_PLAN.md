# Nephrawn Frontend MVP Plan

Based on the source-of-truth documents (DB.md, ARCH.md, DECISIONS.md, PRD.md). The design PDF informs navigation labels and UI patterns but does NOT expand scope.

---

## A) Patient Screens (Flutter)

### P1. Login Screen
**Purpose:** Authenticate patient via email/password and obtain JWT.

**UI Components:**
- Email text field
- Password text field (obscured)
- "Login" button
- "Register" link
- Error message banner

**API Endpoints:**
- `POST /auth/patient/login`

**Request Fields:**
- `email` (string)
- `password` (string)

**Response Fields:**
- `token` (JWT string, stored in secure storage — Flutter's flutter_secure_storage)
- `patient.id`, `patient.name`, `patient.email`

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Button disabled, spinner |
| empty | N/A (always has form) |
| error | Display error banner with message (401 = "Invalid credentials") |
| success | Navigate to Dashboard |

---

### P2. Registration Screen
**Purpose:** Create a new patient account.

**UI Components:**
- Name text field
- Email text field
- Password text field
- Confirm password text field
- Date of birth picker
- "Register" button
- "Back to Login" link

**API Endpoints:**
- `POST /auth/patient/register`

**Request Fields:**
- `email`, `password`, `name`, `dateOfBirth`

**Response Fields:**
- `token` (JWT)
- `patient.id`, `patient.name`, `patient.email`

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Button disabled, spinner |
| error | Display field-level or banner errors (409 = "Email already exists") |
| success | Navigate to Dashboard |

---

### P3. Dashboard Screen
**Purpose:** Show summary of recent measurements, symptoms, and alerts.

**UI Components:**
- Greeting header with patient name and date
- "How are you feeling today?" card → navigates to Symptom Check-in
- Measurement summary cards (Weight, BP) with latest value + trend indicator
- Recent alerts list (if any open)
- Bottom navigation: Home | Symptoms | Body Status | More

**API Endpoints:**
- `GET /patient/dashboard`

**Request Fields:** None (auth via JWT header)

**Response Fields:**
```json
{
  "summaries": {
    "weight": { "latest", "trend", "unit", "displayUnit" },
    "bp_systolic": { ... },
    "bp_diastolic": { ... }
  },
  "recentAlerts": [{ "id", "ruleName", "severity", "status", "triggeredAt" }],
  "recentCheckins": [{ "id", "timestamp", "symptoms" }]
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton cards |
| empty | Show "No data yet" message with prompt to add first measurement |
| error | "Failed to load dashboard" with retry button |
| error (401) | Redirect to Login |
| error (403 - no enrollment) | "You are not enrolled with a clinician yet" |
| success | Render summary cards |

---

### P4. Symptom Check-in Screen
**Purpose:** Patient reports symptoms with severity scores.

**UI Components:**
- Symptom category list (multi-select checkboxes per DB.md symptoms JSONB)
- For each selected symptom: severity slider (1-10) with labels (Mild/Moderate/Severe/Very Severe per PDF)
- Optional notes text area
- "Submit" button
- Cancel/back navigation

**API Endpoints:**
- `POST /patient/checkins`

**Request Fields:**
```json
{
  "timestamp": "ISO8601",
  "symptoms": {
    "edema": { "severity": 2 },
    "fatigue": { "severity": 5 },
    ...
  },
  "notes": "Optional free text"
}
```

**Response Fields:**
- `id`, `timestamp`, `symptoms`, `notes`, `createdAt`

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Submit button disabled, spinner |
| empty | Show "Select symptoms or mark 'No symptoms'" |
| error | Display error banner |
| success | Show confirmation, navigate back to Dashboard |

---

### P5. Symptom History Screen
**Purpose:** View past symptom check-ins as a list.

**UI Components:**
- Date-grouped list of check-ins
- Each item shows: date, symptom chips with severity color-coded
- Tap to view detail (optional: inline expand)

**API Endpoints:**
- `GET /patient/checkins?from=&to=&limit=`

**Request Fields (query params):**
- `from` (optional, ISO8601)
- `to` (optional, ISO8601)
- `limit` (default 50)

**Response Fields:**
```json
{
  "checkins": [{ "id", "timestamp", "symptoms", "notes", "createdAt" }],
  "meta": { "totalCount", "hasMore" }
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton list |
| empty | "No symptom check-ins recorded yet" |
| error | Error banner with retry |
| success | Render list |

---

### P6. Measurement Entry Screen (Weight)
**Purpose:** Patient submits a weight measurement.

**UI Components:**
- Numeric input field for weight
- Unit toggle: kg / lbs (default based on patient preferences, or lbs for US locale)
- Date/time picker (defaults to now)
- "Submit" button

**API Endpoints:**
- `POST /patient/measurements`

**Request Fields:**
```json
{
  "type": "weight",
  "value": 185,
  "unit": "lbs",
  "timestamp": "ISO8601",
  "source": "manual"
}
```

**Response Fields:**
```json
{
  "measurement": {
    "id", "type", "value", "unit", "inputUnit", "timestamp", "source", "createdAt"
  },
  "isDuplicate": false,
  "convertedFrom": { "value": 185, "unit": "lbs" }  // if conversion occurred
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Submit disabled, spinner |
| error | Error banner |
| success (normal) | "Weight recorded: 83.9 kg" toast, navigate back |
| success (isDuplicate: true) | "This measurement was already recorded" info message |
| success (unit conversion) | "Recorded as 83.9 kg (converted from 185 lbs)" info |

---

### P7. Measurement Entry Screen (Blood Pressure)
**Purpose:** Patient submits systolic + diastolic BP as a pair.

**UI Components:**
- Systolic numeric input
- Diastolic numeric input
- Unit display: mmHg (fixed, no toggle)
- Date/time picker
- "Submit" button

**API Endpoints:**
- `POST /patient/measurements/blood-pressure`

**Request Fields:**
```json
{
  "systolic": 135,
  "diastolic": 85,
  "timestamp": "ISO8601",
  "source": "manual"
}
```

**Response Fields:**
```json
{
  "systolic": { "id", "type", "value", "unit", ... },
  "diastolic": { "id", "type", "value", "unit", ... },
  "isDuplicate": false
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Spinner |
| error | Error banner |
| success | "Blood pressure recorded: 135/85 mmHg" |
| success (isDuplicate) | "This reading was already recorded" |

---

### P8. Measurement History / Charts Screen
**Purpose:** View historical measurements with time-series chart.

**UI Components:**
- Tab selector: Weight | Blood Pressure | (future: SpO2, HR)
- Time range selector: Week | Month | 3 Months
- Line chart (Weight) or dual-line chart (BP systolic/diastolic)
- List of recent values below chart
- Trend indicator label (from trendMeta)

**API Endpoints:**
- `GET /patient/charts/:type?from=&to=&aggregate=`

**Request Fields (query params):**
- `type`: `weight` | `blood_pressure`
- `from`, `to`: ISO8601
- `aggregate`: `raw` | `daily` (for longer ranges)

**Response Fields:**
```json
{
  "type": "weight",
  "unit": "kg",
  "displayUnit": "kg",
  "range": { "from", "to" },
  "points": [{ "timestamp", "value" }],
  "meta": { "timezone": "UTC", "totalCount", "hasMore" }
}
```

For BP:
```json
{
  "type": "blood_pressure",
  "points": [{ "timestamp", "systolic", "diastolic" }],
  "meta": { "unpairedSystolicCount", "unpairedDiastolicCount", ... }
}
```

**Also uses:**
- `GET /patient/summary/:type`

**Summary Response Fields:**
```json
{
  "type": "weight",
  "latest": { "value", "timestamp" },
  "trend": "increasing" | "decreasing" | "stable" | "insufficient_data",
  "trendMeta": { "oldAvg", "newAvg", "delta", "thresholdUsed" }
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton chart |
| empty | "No measurements yet. Add your first weight." |
| error | Error banner |
| success | Render chart + list |

---

### P9. Alerts Screen (Patient View)
**Purpose:** Patient views alerts generated for their data (read-only).

**UI Components:**
- List of alerts with severity badge, rule name, triggered date
- Filter: All | Open
- Tap to expand detail (shows inputs that triggered)

**API Endpoints:**
- `GET /patient/alerts?status=&limit=`

**Request Fields:**
- `status`: `open` | `acknowledged` | `dismissed` | (none for all)

**Response Fields:**
```json
{
  "alerts": [{
    "id", "ruleId", "ruleName", "severity", "status",
    "triggeredAt", "inputs", "summaryText"
  }]
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton |
| empty | "No alerts" |
| error | Error banner |
| success | Render list |

---

### P10. Settings / More Screen
**Purpose:** Access profile info, preferences, logout.

**UI Components:**
- Profile section (name, email)
- Preferences (notifications toggle — stored locally for MVP, not synced)
- "Log out" button
- App version

**API Endpoints:**
- `GET /patient/me` (for profile display)

**Response Fields:**
- `id`, `name`, `email`, `dateOfBirth`, `preferences`, `createdAt`

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton |
| error | Show cached data if available, or error |
| success | Render profile |
| logout | Clear secure storage, navigate to Login |

---

## B) Clinician Screens (React/Next.js)

**Session Handling Note:** Per ARCH.md, tokens must NOT be stored in localStorage. Use httpOnly cookies set by the API. The web app will rely on cookie-based sessions.

---

### C1. Login Screen
**Purpose:** Authenticate clinician and establish session cookie.

**UI Components:**
- Email input
- Password input
- "Login" button
- Error message area

**API Endpoints:**
- `POST /auth/clinician/login`

**Request Fields:**
- `email`, `password`

**Response Fields:**
- Sets httpOnly cookie with JWT
- Returns `clinician.id`, `clinician.name`, `clinician.email`, `clinician.role`

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Button disabled, spinner |
| error (401) | "Invalid credentials" |
| error (network) | "Unable to connect" |
| success | Redirect to Patient List |

---

### C2. Patient List Screen
**Purpose:** Show all enrolled patients for this clinician.

**UI Components:**
- Table/list: Patient name, last check-in date, alert count badge
- Search/filter by name
- Click row → navigate to Patient Detail
- Sidebar navigation: Patients | Alerts

**API Endpoints:**
- `GET /clinician/patients?status=active`

**Request Fields:**
- `status`: `active` | `paused` | `discharged` (default: `active`)

**Response Fields:**
```json
{
  "patients": [{
    "id", "name", "email", "enrollment": { "status", "enrolledAt", "isPrimary" },
    "alertCount": 2,
    "lastCheckinAt": "ISO8601"
  }]
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton table |
| empty | "No enrolled patients" |
| error | Error banner with retry |
| success | Render table |

---

### C3. Patient Detail Screen
**Purpose:** Comprehensive view of a single patient's data.

**UI Components:**
- Header: Patient name, DOB, enrollment status
- Tabs: Overview | Measurements | Symptoms | Alerts | Notes
- Overview tab:
  - Summary cards (weight, BP with trends)
  - Recent alerts (top 3)
  - Recent check-ins (top 3)
- Quick action: "Add Note" button

**API Endpoints:**
- `GET /clinician/patients/:patientId`
- `GET /clinician/patients/:patientId/dashboard`

**Request Fields:** `patientId` in path

**Response Fields (dashboard):**
```json
{
  "patient": { "id", "name", "email", "dateOfBirth" },
  "summaries": { "weight": {...}, "bp_systolic": {...}, "bp_diastolic": {...} },
  "recentAlerts": [...],
  "recentCheckins": [...]
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton |
| error (404) | "Patient not found" |
| error (403) | "You are not enrolled with this patient" |
| success | Render dashboard |

---

### C4. Patient Measurements Tab
**Purpose:** View patient's measurements with charts.

**UI Components:**
- Chart type selector: Weight | Blood Pressure
- Date range picker
- Line chart
- Data table below chart

**API Endpoints:**
- `GET /clinician/patients/:patientId/charts/:type`
- `GET /clinician/patients/:patientId/summary/:type`

**Request/Response:** Same structure as patient-facing chart endpoints.

**State Handling:** Same as P8.

---

### C5. Patient Symptoms Tab
**Purpose:** View patient's symptom check-in history.

**UI Components:**
- Date-sorted list of check-ins
- Each shows: date, symptoms with severity chips, notes preview
- Click to expand full details

**API Endpoints:**
- `GET /clinician/patients/:patientId/checkins`

**State Handling:** Same as P5.

---

### C6. Patient Alerts Tab
**Purpose:** View and manage alerts for this patient.

**UI Components:**
- Alert list with severity badge, status badge
- Filter: Open | Acknowledged | Dismissed
- Alert row expandable: shows `inputs` (explainability data)
- Actions per alert: "Acknowledge" | "Dismiss"
- "Add Note" action (links to alert)

**API Endpoints:**
- `GET /clinician/patients/:patientId/alerts` — **NEEDS CONFIRMATION** (not in ARCH.md, may filter via `GET /clinician/alerts?patientId=`)
- `POST /clinician/alerts/:alertId/acknowledge`
- `POST /clinician/alerts/:alertId/dismiss`

**Request Fields (acknowledge/dismiss):** None (just alertId in path)

**Response Fields:**
```json
{
  "alert": { "id", "status": "acknowledged", "acknowledgedBy", "acknowledgedAt" }
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton |
| empty | "No alerts for this patient" |
| action loading | Button spinner |
| action success | Update alert status in place, show toast |
| action error | Error toast |

---

### C7. Patient Notes Tab
**Purpose:** View and add clinician notes for this patient.

**UI Components:**
- Notes list (newest first): author name, date, content preview, linked alert badge (if any)
- "Add Note" button → opens modal/drawer
- Edit/Delete actions (author only)

**API Endpoints:**
- `GET /clinician/patients/:patientId/notes`
- `POST /clinician/patients/:patientId/notes`
- `PUT /clinician/notes/:noteId`
- `DELETE /clinician/notes/:noteId`

**Request Fields (create):**
```json
{
  "content": "Note text",
  "alertId": "uuid or null"
}
```

**Response Fields:**
```json
{
  "note": { "id", "content", "clinicianId", "patientId", "alertId", "createdAt", "updatedAt" }
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton |
| empty | "No notes yet. Add the first note." |
| create success | Prepend to list, clear form |
| delete confirm | "Are you sure?" modal |

---

### C8. Alert Inbox Screen (Global)
**Purpose:** View all alerts across enrolled patients, prioritized for review.

**UI Components:**
- Table: Patient name, alert rule, severity, status, triggered date
- Filters: Status (Open/Acknowledged/Dismissed), Severity
- Sort by: Triggered date (default), Severity
- Click row → navigate to Patient Detail (Alerts tab) or inline expand

**API Endpoints:**
- `GET /clinician/alerts?status=open&limit=50`

**Request Fields:**
- `status`, `severity`, `limit`, `offset`

**Response Fields:**
```json
{
  "alerts": [{
    "id", "patientId", "patient": { "name" },
    "ruleId", "ruleName", "severity", "status", "triggeredAt", "inputs"
  }],
  "meta": { "totalCount", "hasMore" }
}
```

**State Handling:**
| State | Behavior |
|-------|----------|
| loading | Skeleton table |
| empty | "No alerts to review" |
| success | Render table |

---

### C9. Alert Detail Modal/Page
**Purpose:** View full alert details and take action.

**UI Components:**
- Alert header: rule name, severity badge, status
- Patient info link
- Inputs section (expandable JSON → formatted view)
- Summary text (if present)
- Notes linked to this alert
- Actions: Acknowledge | Dismiss | Add Note

**API Endpoints:**
- `GET /clinician/alerts/:alertId`
- `GET /clinician/alerts/:alertId/notes`
- `POST /clinician/alerts/:alertId/acknowledge`
- `POST /clinician/alerts/:alertId/dismiss`

**State Handling:** Same as C6.

---

### C10. Settings / Profile Screen
**Purpose:** View clinician profile, logout.

**UI Components:**
- Profile info (name, email, role)
- "Log out" button

**API Endpoints:**
- `GET /clinician/me`

**State Handling:**
| State | Behavior |
|-------|----------|
| success | Render profile |
| logout | Clear session cookie (via logout endpoint or client-side), redirect to Login |

---

## C) Missing Endpoints

After reviewing the ARCH.md API surface against screen requirements:

### C.1 Patient-scoped alerts for clinician
**Issue:** ARCH.md lists `GET /clinician/alerts` (global) but clinician Patient Detail needs patient-scoped alerts.

**Options:**
1. Add query param to existing endpoint: `GET /clinician/alerts?patientId=:patientId`
2. Add dedicated endpoint: `GET /clinician/patients/:patientId/alerts`

**Recommendation:** Option 1 is likely already supported (common pattern). **Needs confirmation** if query param filtering exists.

**If missing, proposed endpoint:**
- `GET /clinician/patients/:patientId/alerts`
- Request: path param `patientId`, query params `status`, `limit`
- Response: same as `GET /clinician/alerts` but filtered

### C.2 Logout endpoint (optional)
**Issue:** No explicit logout endpoint. For httpOnly cookies, a server-side logout is cleaner.

**Proposed endpoint:**
- `POST /auth/logout`
- Request: None (uses session cookie)
- Response: Clears session cookie, returns 200

**Alternative:** If using short-lived JWTs + refresh rotation, frontend can simply delete cookies. **Needs confirmation** on auth flow details.

---

## D) Build Order

For a solo developer targeting a working demo. Prioritize auth → core data flows → visualization.

### Phase 1: Foundation (Auth + Shell)
1. **Backend verification** — Confirm all endpoints work via curl/Postman
2. **Patient Flutter: Login + Registration screens**
   - Secure storage for JWT
   - Can stub dashboard initially
3. **Clinician React: Login screen**
   - Cookie-based session setup
   - Can stub patient list initially

### Phase 2: Data Entry (Patient App Core)
4. **Patient Flutter: Dashboard screen** (GET /patient/dashboard)
   - Stub measurement cards initially
5. **Patient Flutter: Measurement Entry (Weight)**
   - Full flow: entry → POST → success/duplicate feedback
6. **Patient Flutter: Measurement Entry (BP)**
   - Same pattern
7. **Patient Flutter: Symptom Check-in screen**
   - POST /patient/checkins with symptom selection + severity

### Phase 3: Data Viewing (Patient App)
8. **Patient Flutter: Measurement History/Charts**
   - GET /patient/charts/:type, GET /patient/summary/:type
   - Use fl_chart or similar for visualization
9. **Patient Flutter: Symptom History**
   - GET /patient/checkins
10. **Patient Flutter: Alerts (read-only)**
    - GET /patient/alerts

### Phase 4: Clinician Core Flows
11. **Clinician React: Patient List**
    - GET /clinician/patients
    - Navigation to detail
12. **Clinician React: Patient Detail (Overview tab)**
    - GET /clinician/patients/:patientId/dashboard
13. **Clinician React: Patient Measurements Tab**
    - Charts integration (use recharts or similar)
14. **Clinician React: Patient Symptoms Tab**
    - GET /clinician/patients/:patientId/checkins

### Phase 5: Alert Management
15. **Clinician React: Alert Inbox (global)**
    - GET /clinician/alerts
16. **Clinician React: Patient Alerts Tab + Actions**
    - Acknowledge/Dismiss flows
17. **Clinician React: Alert Detail view**
    - Display inputs (explainability)

### Phase 6: Notes + Polish
18. **Clinician React: Patient Notes Tab**
    - CRUD for notes
    - Link notes to alerts
19. **Patient Flutter: Settings/Profile screen**
20. **Clinician React: Settings/Profile**
21. **Polish: Loading states, error handling, empty states across all screens**

### What Can Be Stubbed vs Must Be Real

| Component | Stub OK? | Notes |
|-----------|----------|-------|
| Auth endpoints | **MUST BE REAL** | Core to all flows |
| Patient dashboard | Can stub summaries initially | Wire real data by Phase 2 end |
| Charts | Can use static data initially | Wire to real API by Phase 3 |
| Alert rules/triggers | Backend handles this | Frontend just displays |
| Notes CRUD | Can defer to Phase 6 | Not critical for demo |
| Symptom severity colors | Hardcode initially | Derive from severity number |

---

## E) Risks / Unknowns

### Doc-based gaps requiring confirmation:

1. **Patient-scoped alerts endpoint** — Does `GET /clinician/alerts` support `?patientId=` filtering? If not, endpoint must be added.

2. **Logout endpoint** — No explicit logout in ARCH.md. Clarify if cookie invalidation is handled server-side or if client-side cookie deletion is sufficient.

3. **Patient preferences for units** — DB.md shows `preferences JSONB` on Patient. Is there an endpoint to update preferences, or is this admin-only? MVP may skip and default to locale-based unit display.

4. **Alert list on patient dashboard** — `GET /patient/dashboard` response structure is inferred; confirm it includes `recentAlerts`.

5. **Web session security** — ARCH.md specifies "httpOnly cookies for web" but doesn't detail the cookie-setting mechanism (same-origin API vs. separate auth service). Confirm API sets cookies directly.

6. **Enrollment error handling** — If a patient is not enrolled with any clinician, what error does the API return? 403? Need consistent handling for "no enrollment" state.

### Assumptions (supported by docs):

- **Units always canonical in API responses** — Frontends receive kg, mmHg, etc. Display conversion happens client-side if user prefers lbs. (Supported by DECISIONS.md)
- **JWT stored in Flutter secure storage** — Standard pattern for mobile. (ARCH.md says no localStorage for web; mobile secure storage is acceptable)
- **Symptom JSONB structure** — Per DB.md example, symptoms keyed by name with severity. Frontend must match this schema.
- **Trend requires 4+ points, 24+ hours** — Frontend should handle `insufficient_data` trend gracefully.
- **Alert deduplication is backend-only** — Frontend displays alerts as-is; backend ensures no spam.

---

## Summary Statistics

| App | Screen Count | Endpoints Used |
|-----|--------------|----------------|
| Patient (Flutter) | 10 | 12 |
| Clinician (React) | 10 | 15 |
| **Total** | **20** | ~20 unique endpoints |

**Missing endpoints:** 0-2 (pending confirmation on filtering + logout)
