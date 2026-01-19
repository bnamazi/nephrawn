-- CreateEnum
CREATE TYPE "TimeEntryActivity" AS ENUM ('PATIENT_REVIEW', 'CARE_PLAN_UPDATE', 'PHONE_CALL', 'COORDINATION', 'DOCUMENTATION', 'OTHER');

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "activity" "TimeEntryActivity" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_patientId_entryDate_idx" ON "time_entries"("patientId", "entryDate");

-- CreateIndex
CREATE INDEX "time_entries_clinicianId_entryDate_idx" ON "time_entries"("clinicianId", "entryDate");

-- CreateIndex
CREATE INDEX "time_entries_clinicId_entryDate_idx" ON "time_entries"("clinicId", "entryDate");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "clinicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
