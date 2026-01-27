-- CreateEnum
CREATE TYPE "BillingProgram" AS ENUM ('RPM_CCM', 'RPM_PCM', 'RPM_ONLY');

-- CreateEnum
CREATE TYPE "PerformerType" AS ENUM ('CLINICAL_STAFF', 'PHYSICIAN_QHP');

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "billingProgram" "BillingProgram" NOT NULL DEFAULT 'RPM_CCM';

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "performerType" "PerformerType" NOT NULL DEFAULT 'CLINICAL_STAFF';
