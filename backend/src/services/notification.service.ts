import { Alert, AlertSeverity, NotificationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { getEmailAdapter } from "../adapters/email.factory.js";
import {
  generateAlertEmailHtml,
  generateAlertEmailText,
  generateAlertEmailSubject,
  AlertEmailData,
} from "../templates/alert-email.js";

// Rate limit: 1 notification per patient per hour
const RATE_LIMIT_HOURS = 1;

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

/**
 * Check if a clinician should be notified for a given alert severity.
 */
export async function shouldNotifyForSeverity(
  clinicianId: string,
  severity: AlertSeverity
): Promise<boolean> {
  const prefs = await getPreferences(clinicianId);

  if (!prefs.emailEnabled) {
    return false;
  }

  switch (severity) {
    case "CRITICAL":
      return prefs.notifyOnCritical;
    case "WARNING":
      return prefs.notifyOnWarning;
    case "INFO":
      return prefs.notifyOnInfo;
    default:
      return false;
  }
}

/**
 * Check if an alert was notified within the rate limit window.
 */
function isWithinRateLimit(lastNotifiedAt: Date | null): boolean {
  if (!lastNotifiedAt) {
    return false;
  }
  const cutoff = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000);
  return lastNotifiedAt > cutoff;
}

/**
 * Log a notification attempt to the NotificationLog table.
 */
async function logNotification(params: {
  clinicianId: string;
  patientId: string;
  alertId: string;
  recipient: string;
  subject: string;
  status: NotificationStatus;
  errorMessage?: string;
}): Promise<void> {
  await prisma.notificationLog.create({
    data: {
      clinicianId: params.clinicianId,
      patientId: params.patientId,
      alertId: params.alertId,
      channel: "EMAIL",
      status: params.status,
      recipient: params.recipient,
      subject: params.subject,
      errorMessage: params.errorMessage,
    },
  });
}

/**
 * Send an alert notification email to the clinician.
 * Returns true if email was sent, false if skipped or failed.
 */
export async function sendAlertNotification(
  alert: Alert & { patient: { id: string; name: string } },
  clinician: { id: string; name: string; email: string }
): Promise<boolean> {
  const emailData: AlertEmailData = {
    clinicianName: clinician.name,
    patientName: alert.patient.name,
    patientId: alert.patientId,
    alertId: alert.id,
    severity: alert.severity,
    ruleName: alert.ruleName,
    summaryText: alert.summaryText,
    triggeredAt: alert.triggeredAt,
  };

  const subject = generateAlertEmailSubject(emailData);
  const html = generateAlertEmailHtml(emailData);
  const text = generateAlertEmailText(emailData);

  const adapter = getEmailAdapter();
  const result = await adapter.send({
    to: clinician.email,
    subject,
    html,
    text,
  });

  if (result.success) {
    // Update alert's lastNotifiedAt
    await prisma.alert.update({
      where: { id: alert.id },
      data: { lastNotifiedAt: new Date() },
    });

    await logNotification({
      clinicianId: clinician.id,
      patientId: alert.patientId,
      alertId: alert.id,
      recipient: clinician.email,
      subject,
      status: "SENT",
    });

    logger.info(
      { alertId: alert.id, clinicianId: clinician.id, patientId: alert.patientId },
      "Alert notification sent"
    );
    return true;
  } else {
    await logNotification({
      clinicianId: clinician.id,
      patientId: alert.patientId,
      alertId: alert.id,
      recipient: clinician.email,
      subject,
      status: "FAILED",
      errorMessage: result.error,
    });

    logger.error(
      { alertId: alert.id, error: result.error },
      "Failed to send alert notification"
    );
    return false;
  }
}

/**
 * Main entry point: notify clinician when a new alert is created.
 * Called after alert creation in evaluateRulesAtomic.
 */
export async function notifyOnAlert(alert: Alert): Promise<void> {
  // 1. Check rate limit on alert
  if (isWithinRateLimit(alert.lastNotifiedAt)) {
    logger.debug(
      { alertId: alert.id },
      "Skipping notification: within rate limit window"
    );
    return;
  }

  // 2. Get patient's primary clinician via enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId: alert.patientId,
      status: "ACTIVE",
      isPrimary: true,
    },
    include: {
      clinician: {
        select: { id: true, name: true, email: true },
      },
      patient: {
        select: { id: true, name: true },
      },
    },
  });

  if (!enrollment) {
    logger.debug(
      { alertId: alert.id, patientId: alert.patientId },
      "Skipping notification: no active primary enrollment"
    );
    return;
  }

  const clinician = enrollment.clinician;
  const patient = enrollment.patient;

  // 3. Check clinician notification preferences
  const shouldNotify = await shouldNotifyForSeverity(clinician.id, alert.severity);
  if (!shouldNotify) {
    logger.debug(
      { alertId: alert.id, clinicianId: clinician.id, severity: alert.severity },
      "Skipping notification: preferences do not allow this severity"
    );

    // Log as skipped
    await logNotification({
      clinicianId: clinician.id,
      patientId: alert.patientId,
      alertId: alert.id,
      recipient: clinician.email,
      subject: `${alert.ruleName} - ${patient.name}`,
      status: "SKIPPED",
      errorMessage: `Clinician preferences: severity ${alert.severity} notifications disabled`,
    });
    return;
  }

  // 4. Check for recent notification to same patient (additional rate limit)
  const recentNotification = await prisma.notificationLog.findFirst({
    where: {
      clinicianId: clinician.id,
      patientId: alert.patientId,
      status: "SENT",
      sentAt: {
        gt: new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000),
      },
    },
  });

  if (recentNotification) {
    logger.debug(
      { alertId: alert.id, clinicianId: clinician.id, patientId: alert.patientId },
      "Skipping notification: recent notification sent to this clinician for this patient"
    );

    await logNotification({
      clinicianId: clinician.id,
      patientId: alert.patientId,
      alertId: alert.id,
      recipient: clinician.email,
      subject: `${alert.ruleName} - ${patient.name}`,
      status: "SKIPPED",
      errorMessage: "Rate limited: notification sent within last hour",
    });
    return;
  }

  // 5. Send notification
  const alertWithPatient = {
    ...alert,
    patient,
  };

  await sendAlertNotification(alertWithPatient, clinician);
}
