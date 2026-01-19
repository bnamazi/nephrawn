# Slice 0: Critical Fixes

**Goal**: Address security and clinical safety issues before implementing new features.

**Duration estimate**: 1-2 days

---

## Current State Assessment

| Item | Status | Finding |
|------|--------|---------|
| JWT secret fallback | ✅ Acceptable | Throws in production; dev fallback is intentional |
| Rate limiting | ✅ Implemented | Auth: 5/15min (prod), API: 100/min (prod) |
| Token persistence (web) | ✅ Acceptable | Uses sessionStorage (survives refresh) |
| BP classification | 🐛 **BUG** | OR vs AND logic error (clinical safety) |
| Structured logging | ✅ Implemented | Pino with redaction |
| Console.log usage | ⚠️ Minor | 3 console.error in files.routes.ts |
| CORS configuration | ✅ Implemented | Environment-based |
| .env.example | ✅ Complete | All variables documented |

---

## Tasks

### Task 1: Fix BP Classification Bug (CRITICAL)

**File**: `apps/patient/lib/features/blood_pressure/bp_list.dart`

**Problem**: Line 49 uses OR instead of AND, causing incorrect BP category classification.

```dart
// CURRENT (WRONG)
} else if (reading.systolic < 140 || reading.diastolic < 90) {
  return Colors.orange;  // Stage 1
}

// CORRECT
} else if (reading.systolic < 140 && reading.diastolic < 90) {
  return Colors.orange;  // Stage 1
}
```

**Why this matters**:
- With OR: A reading of 150/70 shows as Stage 1 (orange) because `diastolic < 90` is true
- With AND: A reading of 150/70 correctly shows as Stage 2 (red) because `systolic >= 140`

**AHA Blood Pressure Categories**:
| Category | Systolic | Diastolic | Color |
|----------|----------|-----------|-------|
| Normal | < 120 | AND < 80 | Green |
| Elevated | 120-129 | AND < 80 | Amber |
| Stage 1 | 130-139 | OR 80-89 | Orange |
| Stage 2 | ≥ 140 | OR ≥ 90 | Red |

The check for "not Stage 2" (i.e., Stage 1) must use AND: `systolic < 140 AND diastolic < 90`.

**Acceptance Criteria**:
- [ ] Reading 150/70 shows red (Stage 2) not orange
- [ ] Reading 120/95 shows red (Stage 2) not orange
- [ ] Reading 135/85 shows orange (Stage 1)
- [ ] Reading 115/75 shows green (Normal)
- [ ] Existing test passes (or update test if it was also wrong)

**Affected Files**:
- `apps/patient/lib/features/blood_pressure/bp_list.dart` (line 49)

---

### Task 2: Replace console.error with logger (LOW)

**Files**: `backend/src/routes/files.routes.ts`

**Problem**: Three instances of `console.error` should use structured logger.

**Current**:
```typescript
console.error("Error serving file:", error);
console.error("Error receiving upload:", error);
console.error("Error handling upload:", error);
```

**Change to**:
```typescript
import { logger } from "../lib/logger.js";
// ...
logger.error({ err: error, storageKey }, "Error serving file");
logger.error({ err: error }, "Error receiving upload");
logger.error({ err: error }, "Error handling upload");
```

**Acceptance Criteria**:
- [ ] No `console.error` in files.routes.ts
- [ ] Errors logged with structured context
- [ ] File upload/download still works

**Affected Files**:
- `backend/src/routes/files.routes.ts` (lines 58, 117, 121)

---

### Task 3: Add test for BP classification (NEW)

**File**: `apps/patient/test/models/blood_pressure_test.dart`

**Problem**: Existing tests may not cover the edge cases that reveal the bug.

**Add test cases**:
```dart
test('Stage 2 - high systolic only', () {
  final bp = BloodPressureReading(systolic: 150, diastolic: 70, ...);
  expect(bp.severityLevel, equals(3)); // Stage 2
});

test('Stage 2 - high diastolic only', () {
  final bp = BloodPressureReading(systolic: 120, diastolic: 95, ...);
  expect(bp.severityLevel, equals(3)); // Stage 2
});

test('Stage 1 - both elevated but below Stage 2', () {
  final bp = BloodPressureReading(systolic: 135, diastolic: 85, ...);
  expect(bp.severityLevel, equals(2)); // Stage 1
});
```

**Acceptance Criteria**:
- [ ] Tests cover systolic-only Stage 2
- [ ] Tests cover diastolic-only Stage 2
- [ ] Tests pass after fix is applied

**Affected Files**:
- `apps/patient/test/models/blood_pressure_test.dart`

---

## Out of Scope for Slice 0

| Item | Reason |
|------|--------|
| JWT secret: remove dev fallback | Intentional for local dev; production already fails |
| httpOnly cookies | Good improvement but not blocking; sessionStorage works |
| Config console.warn | Startup warnings are acceptable |
| Additional rate limit tuning | Current limits are reasonable |

---

## Verification Plan

### Before Changes
```bash
# Run Flutter tests to establish baseline
cd apps/patient && flutter test

# Run backend tests
cd backend && npm test
```

### After Changes
```bash
# Verify Flutter tests pass
cd apps/patient && flutter test

# Verify backend tests pass
cd backend && npm test

# Manual verification:
# 1. Enter BP 150/70 in patient app → should show RED
# 2. Enter BP 120/95 in patient app → should show RED
# 3. Enter BP 135/85 in patient app → should show ORANGE
```

---

## Implementation Order

1. **Task 1**: Fix BP classification (5 min code change, critical)
2. **Task 3**: Add/update BP tests (15 min, validates fix)
3. **Task 2**: Replace console.error (5 min, low priority)

---

## Risks

| Risk | Mitigation |
|------|------------|
| BP model uses different classification logic | Check `BloodPressureReading.severityLevel` getter |
| Duplicate classification logic elsewhere | Search for other `_getCategoryColor` methods |
| Flutter test infrastructure not set up | Verify `flutter test` works before changes |

---

## Definition of Done

- [ ] BP classification bug fixed in `bp_list.dart`
- [ ] BP classification tests added/updated
- [ ] All tests pass (Flutter + backend)
- [ ] console.error replaced with logger
- [ ] Changes committed with clear message
