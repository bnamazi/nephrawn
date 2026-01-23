/**
 * Resend email adapter for production.
 * Sends real emails via Resend transactional email service.
 */

import { Resend } from "resend";
import { EmailAdapter, EmailMessage, SendResult } from "./email.adapter.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export class ResendEmailAdapter implements EmailAdapter {
  private resend: Resend;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress?: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress || config.email.fromAddress;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (error) {
        logger.error(
          { err: error, to: message.to, subject: message.subject },
          "Failed to send email via Resend"
        );
        return {
          success: false,
          error: error.message,
        };
      }

      logger.info(
        {
          emailAdapter: "resend",
          messageId: data?.id,
          to: message.to,
          subject: message.subject,
        },
        "Email sent successfully"
      );

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error(
        { err, to: message.to, subject: message.subject },
        "Exception sending email via Resend"
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
