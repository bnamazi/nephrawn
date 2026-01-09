-- CreateEnum
CREATE TYPE "LabSource" AS ENUM ('MANUAL_PATIENT', 'MANUAL_CLINICIAN', 'IMPORTED');

-- CreateEnum
CREATE TYPE "LabResultFlag" AS ENUM ('H', 'L', 'C');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InteractionType" ADD VALUE 'PATIENT_LAB_REPORT';
ALTER TYPE "InteractionType" ADD VALUE 'CLINICIAN_LAB_VIEW';
ALTER TYPE "InteractionType" ADD VALUE 'CLINICIAN_LAB_VERIFY';
ALTER TYPE "InteractionType" ADD VALUE 'CLINICIAN_LAB_CREATE';

-- CreateTable
CREATE TABLE "lab_reports" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "labName" TEXT,
    "orderingProvider" TEXT,
    "notes" TEXT,
    "source" "LabSource" NOT NULL DEFAULT 'MANUAL_PATIENT',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "analyteCode" TEXT,
    "analyteName" TEXT NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "referenceRangeLow" DECIMAL(10,4),
    "referenceRangeHigh" DECIMAL(10,4),
    "flag" "LabResultFlag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_reports_patientId_collectedAt_idx" ON "lab_reports"("patientId", "collectedAt");

-- CreateIndex
CREATE INDEX "lab_reports_documentId_idx" ON "lab_reports"("documentId");

-- CreateIndex
CREATE INDEX "lab_results_reportId_idx" ON "lab_results"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_results_reportId_analyteName_key" ON "lab_results"("reportId", "analyteName");

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lab_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
