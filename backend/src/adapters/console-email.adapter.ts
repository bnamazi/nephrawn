/**
 * Console email adapter for development.
 * Logs emails to console instead of sending them.
 */

import { EmailAdapter, EmailMessage, SendResult } from "./email.adapter.js";
import { logger } from "../lib/logger.js";

export class ConsoleEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    logger.info(
      {
        emailAdapter: "console",
        messageId,
        to: message.to,
        subject: message.subject,
      },
      "[EMAIL] Would send email in production"
    );

    // Log the full email content in debug mode
    logger.debug(
      {
        html: message.html.slice(0, 500) + (message.html.length > 500 ? "..." : ""),
        text: message.text,
      },
      "[EMAIL] Email content"
    );

    return {
      success: true,
      messageId,
    };
  }
}
