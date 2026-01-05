#!/bin/bash
set -e

BASE_URL="http://localhost:3000"

# Generate unique identifier for this test run
UNIQUE_ID=$(date +%s)
TEST_EMAIL="test.patient.${UNIQUE_ID}@example.com"
TEST_NAME="Test Patient ${UNIQUE_ID}"

echo "=== FULL INVITE FLOW E2E TEST ==="
echo "Test ID: $UNIQUE_ID"
echo ""

# Step 1: Login as clinician
echo "Step 1: Login as clinician"
CLINICIAN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/clinician/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "demo.clinician@example.com", "password": "DemoPass123"}')
CLINICIAN_TOKEN=$(echo "$CLINICIAN_RESPONSE" | jq -r '.token')
echo "  Logged in as: $(echo "$CLINICIAN_RESPONSE" | jq -r '.user.name')"
echo ""

# Step 2: Get clinic ID
echo "Step 2: Get clinicians clinic"
CLINICS_RESPONSE=$(curl -s "$BASE_URL/clinician/clinics" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN")
echo "  Raw response: $CLINICS_RESPONSE"
CLINIC_ID=$(echo "$CLINICS_RESPONSE" | jq -r '.clinics[0].id')
CLINIC_NAME=$(echo "$CLINICS_RESPONSE" | jq -r '.clinics[0].name')
echo "  Clinic: $CLINIC_NAME"
echo "  Clinic ID: $CLINIC_ID"
echo ""

# Step 3: Create an invite
echo "Step 3: Create patient invite"
INVITE_RESPONSE=$(curl -s -X POST "$BASE_URL/clinician/clinic/$CLINIC_ID/invites" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"patientName\": \"$TEST_NAME\", \"patientDob\": \"1985-06-15\", \"patientEmail\": \"$TEST_EMAIL\"}")
echo "  Raw response: $INVITE_RESPONSE"
INVITE_CODE=$(echo "$INVITE_RESPONSE" | jq -r '.invite.code')
echo "  Created invite for: $(echo "$INVITE_RESPONSE" | jq -r '.invite.patientName')"
echo "  Invite code: $INVITE_CODE"
echo ""

# Step 4: Validate invite code (public endpoint)
echo "Step 4: Validate invite code (public)"
VALIDATE_RESPONSE=$(curl -s "$BASE_URL/auth/invite/$INVITE_CODE")
echo "  Valid: $(echo "$VALIDATE_RESPONSE" | jq -r '.valid')"
echo "  Clinic: $(echo "$VALIDATE_RESPONSE" | jq -r '.clinicName')"
echo ""

# Step 5: Claim the invite as new patient
echo "Step 5: Claim invite (create patient account)"
CLAIM_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/invite/$INVITE_CODE/claim" \
  -H "Content-Type: application/json" \
  -d "{\"dateOfBirth\": \"1985-06-15\", \"email\": \"$TEST_EMAIL\", \"password\": \"SecurePass123\", \"name\": \"$TEST_NAME\"}")
echo "  Raw response: $CLAIM_RESPONSE"
PATIENT_TOKEN=$(echo "$CLAIM_RESPONSE" | jq -r '.token')
echo "  Success: $(echo "$CLAIM_RESPONSE" | jq -r '.success')"
echo "  Is New Patient: $(echo "$CLAIM_RESPONSE" | jq -r '.isNewPatient')"
echo "  Patient ID: $(echo "$CLAIM_RESPONSE" | jq -r '.patient.id')"
echo "  Enrolled at: $(echo "$CLAIM_RESPONSE" | jq -r '.clinic.name')"
echo ""

# Step 6: Verify patient can access their dashboard
echo "Step 6: Verify patient session works"
PATIENT_ME=$(curl -s "$BASE_URL/patient/me" \
  -H "Authorization: Bearer $PATIENT_TOKEN")
echo "  Patient name: $(echo "$PATIENT_ME" | jq -r '.patient.name')"
echo "  Patient email: $(echo "$PATIENT_ME" | jq -r '.patient.email')"
echo ""

# Step 7: Verify invite is no longer in pending list (it's claimed)
echo "Step 7: Verify invite is no longer pending"
INVITES_LIST=$(curl -s "$BASE_URL/clinician/clinic/$CLINIC_ID/invites" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN")
PENDING_COUNT=$(echo "$INVITES_LIST" | jq -r ".invites | map(select(.code == \"$INVITE_CODE\")) | length")
echo "  Pending invites with this code: $PENDING_COUNT (should be 0 since it was claimed)"
echo ""

echo "=== E2E TEST COMPLETE ==="
# Verify all key steps succeeded
if [ "$PENDING_COUNT" = "0" ] && [ -n "$PATIENT_TOKEN" ] && [ "$PATIENT_TOKEN" != "null" ]; then
  echo "SUCCESS: Full invite flow works correctly!"
  echo ""
  echo "Summary:"
  echo "  - Clinician created invite"
  echo "  - Patient validated and claimed invite"
  echo "  - New patient account created"
  echo "  - Patient enrolled at clinic"
  echo "  - Invite removed from pending list"
  exit 0
else
  echo "ISSUE: Some verification failed"
  echo "  PENDING_COUNT=$PENDING_COUNT (expected 0)"
  echo "  PATIENT_TOKEN set: $([ -n \"$PATIENT_TOKEN\" ] && echo 'yes' || echo 'no')"
  exit 1
fi
