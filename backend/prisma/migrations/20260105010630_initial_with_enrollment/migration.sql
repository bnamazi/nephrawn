-- CreateEnum
CREATE TYPE "ClinicianRole" AS ENUM ('CLINICIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ClinicMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'CLINICIAN', 'STAFF');

-- CreateEnum
CREATE TYPE "ClinicMembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'CLAIMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EnrolledVia" AS ENUM ('INVITE', 'MIGRATION', 'ADMIN');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('PATIENT_CHECKIN', 'PATIENT_MEASUREMENT', 'CLINICIAN_VIEW', 'CLINICIAN_ALERT_ACK', 'CLINICIAN_NOTE', 'CLINICIAN_CALL', 'CLINICIAN_MESSAGE');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('WEIGHT', 'BP_SYSTOLIC', 'BP_DIASTOLIC', 'SPO2', 'HEART_RATE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'DISMISSED');

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinicians" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ClinicianRole" NOT NULL DEFAULT 'CLINICIAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "npi" TEXT,
    "address" JSONB,
    "phone" TEXT,
    "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_memberships" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "role" "ClinicMembershipRole" NOT NULL DEFAULT 'CLINICIAN',
    "status" "ClinicMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "clinicId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientDob" DATE NOT NULL,
    "patientEmail" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "enrolledVia" "EnrolledVia" NOT NULL DEFAULT 'INVITE',
    "inviteId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_logs" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interactionType" "InteractionType" NOT NULL,
    "durationSeconds" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptom_checkins" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptoms" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "symptom_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "MeasurementType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "inputUnit" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "inputs" JSONB NOT NULL,
    "summaryText" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinician_notes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "alertId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinician_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_email_key" ON "patients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clinicians_email_key" ON "clinicians"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_npi_key" ON "clinics"("npi");

-- CreateIndex
CREATE INDEX "clinics_status_idx" ON "clinics"("status");

-- CreateIndex
CREATE INDEX "clinic_memberships_clinicianId_status_idx" ON "clinic_memberships"("clinicianId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_memberships_clinicId_clinicianId_key" ON "clinic_memberships"("clinicId", "clinicianId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_status_expiresAt_idx" ON "invites"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "invites_clinicId_status_idx" ON "invites"("clinicId", "status");

-- CreateIndex
CREATE INDEX "enrollments_clinicianId_clinicId_status_idx" ON "enrollments"("clinicianId", "clinicId", "status");

-- CreateIndex
CREATE INDEX "enrollments_patientId_clinicId_idx" ON "enrollments"("patientId", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_patientId_clinicianId_clinicId_key" ON "enrollments"("patientId", "clinicianId", "clinicId");

-- CreateIndex
CREATE INDEX "interaction_logs_patientId_timestamp_idx" ON "interaction_logs"("patientId", "timestamp");

-- CreateIndex
CREATE INDEX "interaction_logs_clinicianId_timestamp_idx" ON "interaction_logs"("clinicianId", "timestamp");

-- CreateIndex
CREATE INDEX "symptom_checkins_patientId_timestamp_idx" ON "symptom_checkins"("patientId", "timestamp");

-- CreateIndex
CREATE INDEX "measurements_patientId_type_timestamp_idx" ON "measurements"("patientId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "measurements_patientId_type_source_timestamp_idx" ON "measurements"("patientId", "type", "source", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "measurements_source_externalId_key" ON "measurements"("source", "externalId");

-- CreateIndex
CREATE INDEX "alerts_patientId_status_triggeredAt_idx" ON "alerts"("patientId", "status", "triggeredAt");

-- CreateIndex
CREATE INDEX "clinician_notes_patientId_createdAt_idx" ON "clinician_notes"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "clinician_notes_alertId_idx" ON "clinician_notes"("alertId");

-- AddForeignKey
ALTER TABLE "clinic_memberships" ADD CONSTRAINT "clinic_memberships_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_memberships" ADD CONSTRAINT "clinic_memberships_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptom_checkins" ADD CONSTRAINT "symptom_checkins_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_notes" ADD CONSTRAINT "clinician_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_notes" ADD CONSTRAINT "clinician_notes_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_notes" ADD CONSTRAINT "clinician_notes_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
