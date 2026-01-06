-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CkdStage" AS ENUM ('STAGE_1', 'STAGE_2', 'STAGE_3A', 'STAGE_3B', 'STAGE_4', 'STAGE_5', 'STAGE_5D', 'TRANSPLANT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "KidneyDiseaseEtiology" AS ENUM ('DIABETES', 'HYPERTENSION', 'GLOMERULONEPHRITIS', 'POLYCYSTIC', 'OBSTRUCTIVE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DialysisStatus" AS ENUM ('NONE', 'HEMODIALYSIS', 'PERITONEAL_DIALYSIS');

-- CreateEnum
CREATE TYPE "TransplantStatus" AS ENUM ('NONE', 'PRIOR', 'CURRENT');

-- CreateEnum
CREATE TYPE "NyhaClass" AS ENUM ('CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4');

-- CreateEnum
CREATE TYPE "DiabetesType" AS ENUM ('NONE', 'TYPE_1', 'TYPE_2');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('PATIENT_PROFILE', 'CARE_PLAN');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PATIENT', 'CLINICIAN', 'SYSTEM');

-- CreateTable
CREATE TABLE "patient_profiles" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sex" "Sex",
    "heightCm" DECIMAL(5,1),
    "ckdStageSelfReported" "CkdStage",
    "ckdStageClinician" "CkdStage",
    "ckdStageSetById" TEXT,
    "ckdStageSetAt" TIMESTAMP(3),
    "primaryEtiology" "KidneyDiseaseEtiology",
    "dialysisStatus" "DialysisStatus" NOT NULL DEFAULT 'NONE',
    "dialysisStartDate" DATE,
    "transplantStatus" "TransplantStatus" NOT NULL DEFAULT 'NONE',
    "transplantDate" DATE,
    "hasHeartFailure" BOOLEAN NOT NULL DEFAULT false,
    "heartFailureClass" "NyhaClass",
    "diabetesType" "DiabetesType" NOT NULL DEFAULT 'NONE',
    "hasHypertension" BOOLEAN NOT NULL DEFAULT false,
    "otherConditions" JSONB,
    "onDiuretics" BOOLEAN NOT NULL DEFAULT false,
    "onAceArbInhibitor" BOOLEAN NOT NULL DEFAULT false,
    "onSglt2Inhibitor" BOOLEAN NOT NULL DEFAULT false,
    "onNsaids" BOOLEAN NOT NULL DEFAULT false,
    "onMra" BOOLEAN NOT NULL DEFAULT false,
    "onInsulin" BOOLEAN NOT NULL DEFAULT false,
    "medicationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "dryWeightKg" DECIMAL(5,2),
    "targetBpSystolic" JSONB,
    "targetBpDiastolic" JSONB,
    "priorHfHospitalizations" INTEGER NOT NULL DEFAULT 0,
    "fluidRetentionRisk" BOOLEAN NOT NULL DEFAULT false,
    "fallsRisk" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profile_audits" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "changedFields" JSONB NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_profile_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_patientId_key" ON "patient_profiles"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "care_plans_enrollmentId_key" ON "care_plans"("enrollmentId");

-- CreateIndex
CREATE INDEX "patient_profile_audits_patientId_timestamp_idx" ON "patient_profile_audits"("patientId", "timestamp");

-- CreateIndex
CREATE INDEX "patient_profile_audits_entityType_entityId_timestamp_idx" ON "patient_profile_audits"("entityType", "entityId", "timestamp");

-- CreateIndex
CREATE INDEX "patient_profile_audits_actorId_actorType_idx" ON "patient_profile_audits"("actorId", "actorType");

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profile_audits" ADD CONSTRAINT "patient_profile_audits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
