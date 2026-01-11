import { DeviceVendor, DeviceConnectionStatus, MeasurementType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/encryption.js";
import { logger } from "../lib/logger.js";
import { getWithingsAdapter } from "../adapters/withings.factory.js";
import {
  WITHINGS_MEASURE_TYPES,
  convertWithingsValue,
  WithingsMeasureGroup,
} from "../adapters/withings.adapter.js";
import { createMeasurement, CreateMeasurementInput } from "./measurement.service.js";
import crypto from "crypto";

// OAuth state cache (in production, use Redis or similar)
const stateCache = new Map<string, { patientId: string; expiresAt: Date }>();

/**
 * Withings type code to MeasurementType mapping.
 */
const WITHINGS_TYPE_MAP: Record<number, MeasurementType> = {
  [WITHINGS_MEASURE_TYPES.WEIGHT]: "WEIGHT",
  [WITHINGS_MEASURE_TYPES.SYSTOLIC_BP]: "BP_SYSTOLIC",
  [WITHINGS_MEASURE_TYPES.DIASTOLIC_BP]: "BP_DIASTOLIC",
  [WITHINGS_MEASURE_TYPES.HEART_RATE]: "HEART_RATE",
  [WITHINGS_MEASURE_TYPES.FAT_FREE_MASS]: "FAT_FREE_MASS",
  [WITHINGS_MEASURE_TYPES.FAT_RATIO]: "FAT_RATIO",
  [WITHINGS_MEASURE_TYPES.FAT_MASS]: "FAT_MASS",
  [WITHINGS_MEASURE_TYPES.MUSCLE_MASS]: "MUSCLE_MASS",
  [WITHINGS_MEASURE_TYPES.HYDRATION]: "HYDRATION",
  [WITHINGS_MEASURE_TYPES.BONE_MASS]: "BONE_MASS",
  [WITHINGS_MEASURE_TYPES.PULSE_WAVE_VELOCITY]: "PULSE_WAVE_VELOCITY",
};

/**
 * Canonical units for each measurement type.
 */
const CANONICAL_UNITS: Record<MeasurementType, string> = {
  WEIGHT: "kg",
  BP_SYSTOLIC: "mmHg",
  BP_DIASTOLIC: "mmHg",
  HEART_RATE: "bpm",
  SPO2: "%",
  FAT_FREE_MASS: "kg",
  FAT_RATIO: "%",
  FAT_MASS: "kg",
  MUSCLE_MASS: "kg",
  HYDRATION: "kg",
  BONE_MASS: "kg",
  PULSE_WAVE_VELOCITY: "m/s",
};

export interface InitiateAuthResult {
  authUrl: string;
  state: string;
}

export interface SyncResult {
  measurementsCreated: number;
  measurementsSkipped: number;
  errors: string[];
}

/**
 * Initiate Withings OAuth flow.
 * Returns URL to redirect user to for authorization.
 */
export function initiateWithingsAuth(patientId: string): InitiateAuthResult {
  const state = crypto.randomBytes(32).toString("hex");
  const adapter = getWithingsAdapter();

  // Cache state for CSRF validation (expires in 10 minutes)
  stateCache.set(state, {
    patientId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Clean up expired states
  const now = new Date();
  for (const [key, value] of stateCache.entries()) {
    if (value.expiresAt < now) {
      stateCache.delete(key);
    }
  }

  const authUrl = adapter.getAuthorizationUrl(state);

  logger.info({ patientId, state }, "Initiated Withings OAuth");

  return { authUrl, state };
}

/**
 * Handle OAuth callback and create device connection.
 */
export async function handleWithingsCallback(
  code: string,
  state: string
): Promise<{ connection: Awaited<ReturnType<typeof prisma.deviceConnection.create>>; patientId: string }> {
  // Validate state
  const cached = stateCache.get(state);
  if (!cached) {
    throw new Error("Invalid or expired OAuth state");
  }

  if (cached.expiresAt < new Date()) {
    stateCache.delete(state);
    throw new Error("OAuth state expired");
  }

  const { patientId } = cached;
  stateCache.delete(state);

  // Exchange code for tokens
  const adapter = getWithingsAdapter();
  const tokens = await adapter.exchangeCodeForToken(code);

  // Store connection with encrypted tokens
  const connection = await prisma.deviceConnection.upsert({
    where: {
      patientId_vendor: {
        patientId,
        vendor: "WITHINGS",
      },
    },
    create: {
      patientId,
      vendor: "WITHINGS",
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      scope: tokens.scope,
      withingsUserId: tokens.userId,
      status: "ACTIVE",
    },
    update: {
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      scope: tokens.scope,
      withingsUserId: tokens.userId,
      status: "ACTIVE",
      lastSyncError: null,
    },
  });

  logger.info(
    { patientId, connectionId: connection.id, withingsUserId: tokens.userId },
    "Withings device connected"
  );

  return { connection, patientId };
}

/**
 * Disconnect a device (revoke connection).
 */
export async function disconnectDevice(
  patientId: string,
  vendor: DeviceVendor
): Promise<void> {
  await prisma.deviceConnection.update({
    where: {
      patientId_vendor: {
        patientId,
        vendor,
      },
    },
    data: {
      status: "REVOKED",
      lastSyncError: "User disconnected",
    },
  });

  logger.info({ patientId, vendor }, "Device disconnected");
}

/**
 * Get all device connections for a patient.
 */
export async function getDeviceConnections(patientId: string) {
  return prisma.deviceConnection.findMany({
    where: { patientId },
    select: {
      id: true,
      vendor: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
      createdAt: true,
    },
  });
}

/**
 * Get a specific device connection.
 */
export async function getDeviceConnection(
  patientId: string,
  vendor: DeviceVendor
) {
  return prisma.deviceConnection.findUnique({
    where: {
      patientId_vendor: {
        patientId,
        vendor,
      },
    },
    select: {
      id: true,
      vendor: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
      createdAt: true,
    },
  });
}

/**
 * Sync measurements from Withings for a specific connection.
 */
export async function syncWithingsData(connectionId: string): Promise<SyncResult> {
  const connection = await prisma.deviceConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error("Device connection not found");
  }

  if (connection.status !== "ACTIVE") {
    throw new Error(`Connection is ${connection.status}, cannot sync`);
  }

  const result: SyncResult = {
    measurementsCreated: 0,
    measurementsSkipped: 0,
    errors: [],
  };

  try {
    // Refresh token if needed
    const refreshedConnection = await refreshTokenIfNeeded(connection);

    // Fetch measurements
    const adapter = getWithingsAdapter();
    const accessToken = decrypt(refreshedConnection.accessToken);

    // Use lastSyncAt for incremental sync, or default to 7 days ago
    const lastupdate = refreshedConnection.lastSyncAt
      ? Math.floor(refreshedConnection.lastSyncAt.getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    const measureGroups = await adapter.getMeasurements(accessToken, {
      lastupdate,
      category: 1, // Real measures only
    });

    // Convert and create measurements
    for (const group of measureGroups) {
      const inputs = convertMeasureGroup(group, connection.patientId);

      for (const input of inputs) {
        try {
          const createResult = await createMeasurement(input);
          if (createResult.isDuplicate) {
            result.measurementsSkipped++;
          } else {
            result.measurementsCreated++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(`Failed to create ${input.type}: ${message}`);
          logger.error({ err, input }, "Failed to create measurement from Withings");
        }
      }
    }

    // Update sync status
    await prisma.deviceConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: result.errors.length > 0 ? result.errors.join("; ") : null,
      },
    });

    logger.info(
      {
        connectionId,
        patientId: connection.patientId,
        created: result.measurementsCreated,
        skipped: result.measurementsSkipped,
        errors: result.errors.length,
      },
      "Withings sync completed"
    );

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Update connection with error
    await prisma.deviceConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncError: message,
        // Mark as expired if token refresh failed
        status: message.includes("token") ? "EXPIRED" : connection.status,
      },
    });

    logger.error({ err, connectionId }, "Withings sync failed");
    throw err;
  }
}

/**
 * Refresh access token if it's about to expire.
 */
async function refreshTokenIfNeeded(
  connection: Awaited<ReturnType<typeof prisma.deviceConnection.findUnique>>
): Promise<NonNullable<typeof connection>> {
  if (!connection) {
    throw new Error("Connection not found");
  }

  const bufferMinutes = 5;
  const expiresAt = connection.tokenExpiresAt;

  if (expiresAt <= new Date(Date.now() + bufferMinutes * 60 * 1000)) {
    logger.info({ connectionId: connection.id }, "Refreshing Withings access token");

    const adapter = getWithingsAdapter();
    const refreshToken = decrypt(connection.refreshToken);
    const tokens = await adapter.refreshAccessToken(refreshToken);

    return prisma.deviceConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: tokens.scope,
      },
    });
  }

  return connection;
}

/**
 * Convert a Withings measure group to measurement inputs.
 */
function convertMeasureGroup(
  group: WithingsMeasureGroup,
  patientId: string
): CreateMeasurementInput[] {
  const inputs: CreateMeasurementInput[] = [];
  const timestamp = new Date(group.date * 1000);

  for (const measure of group.measures) {
    const measurementType = WITHINGS_TYPE_MAP[measure.type];

    if (!measurementType) {
      // Unknown measurement type, skip
      continue;
    }

    const value = convertWithingsValue(measure.value, measure.unit);
    const unit = CANONICAL_UNITS[measurementType];

    inputs.push({
      patientId,
      type: measurementType,
      value,
      unit,
      source: "withings",
      externalId: `${group.grpid}_${measure.type}`,
      timestamp,
    });
  }

  return inputs;
}

/**
 * Get all active connections that need syncing.
 */
export async function getActiveConnectionsForSync() {
  return prisma.deviceConnection.findMany({
    where: {
      status: "ACTIVE",
      vendor: "WITHINGS",
    },
    select: {
      id: true,
      patientId: true,
      lastSyncAt: true,
    },
  });
}
