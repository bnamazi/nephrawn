-- CreateEnum
CREATE TYPE "DeviceVendor" AS ENUM ('WITHINGS');

-- CreateEnum
CREATE TYPE "DeviceConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MeasurementType" ADD VALUE 'FAT_FREE_MASS';
ALTER TYPE "MeasurementType" ADD VALUE 'FAT_RATIO';
ALTER TYPE "MeasurementType" ADD VALUE 'FAT_MASS';
ALTER TYPE "MeasurementType" ADD VALUE 'MUSCLE_MASS';
ALTER TYPE "MeasurementType" ADD VALUE 'HYDRATION';
ALTER TYPE "MeasurementType" ADD VALUE 'BONE_MASS';
ALTER TYPE "MeasurementType" ADD VALUE 'PULSE_WAVE_VELOCITY';

-- CreateTable
CREATE TABLE "device_connections" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "vendor" "DeviceVendor" NOT NULL DEFAULT 'WITHINGS',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "withingsUserId" TEXT,
    "status" "DeviceConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_connections_status_lastSyncAt_idx" ON "device_connections"("status", "lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_connections_patientId_vendor_key" ON "device_connections"("patientId", "vendor");

-- AddForeignKey
ALTER TABLE "device_connections" ADD CONSTRAINT "device_connections_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
