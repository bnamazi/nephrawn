import { prisma } from "../lib/prisma.js";

export interface NotificationPreferenceInput {
  emailEnabled?: boolean;
  notifyOnCritical?: boolean;
  notifyOnWarning?: boolean;
  notifyOnInfo?: boolean;
}

export async function getPreferences(clinicianId: string) {
  return prisma.notificationPreference.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      emailEnabled: true,
      notifyOnCritical: true,
      notifyOnWarning: true,
      notifyOnInfo: false,
    },
    update: {},
  });
}

export async function updatePreferences(
  clinicianId: string,
  input: NotificationPreferenceInput
) {
  return prisma.notificationPreference.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      emailEnabled: input.emailEnabled ?? true,
      notifyOnCritical: input.notifyOnCritical ?? true,
      notifyOnWarning: input.notifyOnWarning ?? true,
      notifyOnInfo: input.notifyOnInfo ?? false,
    },
    update: {
      ...(input.emailEnabled !== undefined && { emailEnabled: input.emailEnabled }),
      ...(input.notifyOnCritical !== undefined && { notifyOnCritical: input.notifyOnCritical }),
      ...(input.notifyOnWarning !== undefined && { notifyOnWarning: input.notifyOnWarning }),
      ...(input.notifyOnInfo !== undefined && { notifyOnInfo: input.notifyOnInfo }),
    },
  });
}
