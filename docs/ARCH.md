# Nephrawn — Reference Architecture

## System Boundaries

```
┌─────────────────┐     ┌─────────────────┐
│  Patient App    │     │  Clinician App  │
│  (Flutter)      │     │  (React/Next)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   API       │
              │  (Node/TS)  │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Postgres   │
              └─────────────┘
```

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Patient App | Flutter | iOS + Android; data entry focused |
| Clinician App | React / Next.js | Web only; review and decision support |
| API | Node.js + TypeScript | REST, versioned endpoints |
| ORM | Prisma | Type-safe, migration management |
| Database | PostgreSQL | Source of truth; JSONB for flexible fields |
| Auth | JWT | Role-based; enforced at API middleware |

---

## Component Responsibilities

### API Layer (MVP)
- Authentication & session management
- Patient/Clinician/Enrollment CRUD
- SymptomCheckin and Measurement ingestion
- Alert generation (rule engine)
- Note management
- Interaction logging (RPM/CCM)
- Time-series query endpoints

### Patient App (MVP)
- Login / session management
- Symptom check-in form
- Measurement entry (weight, BP)
- View own history (read-only)

### Clinician App (MVP)
- Login / session management
- Patient list (enrolled patients)
- Patient detail with timeline
- Alert inbox
- Acknowledge alerts, add notes
- Time-series charts

---

## API Layer (MVP+ Extension Points)

| Capability | Integration Pattern | Notes |
|------------|---------------------|-------|
| Lab Results | Upload → Blob storage → Document entity | Structured parsing deferred |
| Device Sync | OAuth adapter → Measurement entity | Withings first; adapter interface defined |
| Medication | New entity; optional push notifications | Reminder service deferred |
| LLM Summaries | Async job → cache result on entity | No real-time generation in UI path |
| Prioritization | Background scoring → sort order field | Must be explainable |

---

## Data Flow Patterns

### Observation Ingestion (MVP)
1. Patient submits SymptomCheckin or Measurement via API
2. API validates, persists to Postgres
3. Rule engine evaluates thresholds → creates Alert if triggered
4. Interaction logged automatically
5. Clinician queries patient timeline

### Clinician Review (MVP)
1. Clinician views patient list
2. Selects patient → sees timeline of checkins, measurements, alerts
3. Acknowledges alert → Interaction logged
4. Adds note → Interaction logged
5. All interactions timestamped for RPM/CCM

### Document Upload (MVP+)
1. Patient uploads file via signed URL
2. API creates Document entity (metadata only)
3. Clinician views document inline
4. (Later) Background job extracts structured data

### Device Sync (MVP+)
1. Patient authorizes Withings via OAuth
2. Background job polls vendor API
3. Normalized Measurement entities created with `source = 'withings'`
4. Same rule engine evaluates data

---

## Extension Contracts (Define Now, Implement Later)

### Device Adapter Interface
```
authorize(patientId, vendorCode) → OAuth redirect URL
sync(patientId, vendorCode, since) → Measurement[]
disconnect(patientId, vendorCode) → void
```

### LLM Summary Interface
```
Input: entityType (alert|measurement_series|lab_result) + entityId
Output: { markdown: string, confidence: number, citations: string[] }
Constraint: Must be cacheable; never blocks UI render
```

---

## RPM/CCM Architectural Considerations

- All clinician actions log `interactionType` and duration
- Patient data submissions create implicit interactions
- Monthly aggregation view requires indexed timestamps
- Device data must retain original source timestamp
- Clinician "review" action creates auditable event
- InteractionLog table supports billing queries

---

## Security Model

### Authentication
- JWT tokens with role claim (patient | clinician | admin)
- Short-lived access tokens; refresh token rotation
- Tokens never stored in localStorage (httpOnly cookies for web)

### Authorization
- Enforced at API middleware, not UI
- Patients can only access own data
- Clinicians can only access enrolled patients
- Admin role for user management (MVP+)

### Data Protection
- No PHI in logs or error messages
- Encryption at rest (Postgres)
- TLS in transit
- Audit trail for sensitive operations

---

## Deployment (MVP)

- Single-region deployment
- Managed Postgres (e.g., Supabase, RDS, Neon)
- API on containerized platform (e.g., Railway, Render, ECS)
- Clinician app: Vercel or similar
- Patient app: App Store / Play Store

Horizontal scaling and multi-region are deferred.
