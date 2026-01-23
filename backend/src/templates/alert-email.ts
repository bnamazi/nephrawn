/**
 * Email templates for alert notifications.
 */

import { AlertSeverity } from "@prisma/client";
import { config } from "../lib/config.js";

export interface AlertEmailData {
  clinicianName: string;
  patientName: string;
  patientId: string;
  alertId: string;
  severity: AlertSeverity;
  ruleName: string;
  summaryText?: string | null;
  triggeredAt: Date;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  CRITICAL: "#dc2626", // red-600
  WARNING: "#d97706", // amber-600
  INFO: "#2563eb", // blue-600
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: "Critical Alert",
  WARNING: "Warning Alert",
  INFO: "Information",
};

/**
 * Generate HTML email content for an alert notification.
 */
export function generateAlertEmailHtml(data: AlertEmailData): string {
  const severityColor = SEVERITY_COLORS[data.severity];
  const severityLabel = SEVERITY_LABELS[data.severity];
  const dashboardUrl = `${config.email.clinicianDashboardUrl}/patients/${data.patientId}`;
  const formattedTime = data.triggeredAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${severityLabel} - ${data.patientName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${severityColor}; padding: 20px 24px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                ${severityLabel}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">
                Hello ${data.clinicianName},
              </p>

              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px;">
                A new alert has been triggered for your patient:
              </p>

              <!-- Alert Details Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 6px; border-left: 4px solid ${severityColor};">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                      Patient
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
                      ${data.patientName}
                    </p>

                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                      Alert Type
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">
                      ${data.ruleName}
                    </p>

                    ${data.summaryText ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                      Details
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #374151;">
                      ${data.summaryText}
                    </p>
                    ` : ""}

                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                      Time
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #374151;">
                      ${formattedTime}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #2563eb;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600;">
                      View Patient Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                You can manage your notification preferences in your account settings.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Nephrawn - CKD Patient Management Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generate plain text email content for an alert notification.
 */
export function generateAlertEmailText(data: AlertEmailData): string {
  const severityLabel = SEVERITY_LABELS[data.severity];
  const dashboardUrl = `${config.email.clinicianDashboardUrl}/patients/${data.patientId}`;
  const formattedTime = data.triggeredAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let text = `${severityLabel}

Hello ${data.clinicianName},

A new alert has been triggered for your patient:

Patient: ${data.patientName}
Alert Type: ${data.ruleName}`;

  if (data.summaryText) {
    text += `\nDetails: ${data.summaryText}`;
  }

  text += `
Time: ${formattedTime}

View Patient Dashboard: ${dashboardUrl}

---
You can manage your notification preferences in your account settings.
Nephrawn - CKD Patient Management Platform`;

  return text;
}

/**
 * Generate email subject for an alert notification.
 */
export function generateAlertEmailSubject(data: AlertEmailData): string {
  const prefix = data.severity === "CRITICAL" ? "[CRITICAL] " : "";
  return `${prefix}${data.ruleName} - ${data.patientName}`;
}
