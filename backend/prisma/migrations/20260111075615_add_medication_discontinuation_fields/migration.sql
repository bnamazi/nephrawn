-- AlterTable
ALTER TABLE "medications" ADD COLUMN     "discontinuedAt" TIMESTAMP(3),
ADD COLUMN     "discontinuedById" TEXT,
ADD COLUMN     "discontinuedReason" TEXT;
