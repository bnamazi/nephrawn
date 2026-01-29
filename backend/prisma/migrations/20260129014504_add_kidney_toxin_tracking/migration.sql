-- CreateEnum
CREATE TYPE "ToxinRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateTable
CREATE TABLE "kidney_toxin_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "examples" TEXT,
    "riskLevel" "ToxinRiskLevel" NOT NULL DEFAULT 'MODERATE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kidney_toxin_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_toxin_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toxinCategoryId" TEXT NOT NULL,
    "isEducated" BOOLEAN NOT NULL DEFAULT false,
    "educatedAt" TIMESTAMP(3),
    "educatedById" TEXT,
    "lastExposureDate" DATE,
    "exposureNotes" TEXT,
    "riskOverride" "ToxinRiskLevel",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_toxin_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kidney_toxin_categories_name_key" ON "kidney_toxin_categories"("name");

-- CreateIndex
CREATE INDEX "patient_toxin_records_patientId_idx" ON "patient_toxin_records"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_toxin_records_patientId_toxinCategoryId_key" ON "patient_toxin_records"("patientId", "toxinCategoryId");

-- AddForeignKey
ALTER TABLE "patient_toxin_records" ADD CONSTRAINT "patient_toxin_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_toxin_records" ADD CONSTRAINT "patient_toxin_records_toxinCategoryId_fkey" FOREIGN KEY ("toxinCategoryId") REFERENCES "kidney_toxin_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_toxin_records" ADD CONSTRAINT "patient_toxin_records_educatedById_fkey" FOREIGN KEY ("educatedById") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
