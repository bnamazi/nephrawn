/**
 * Email adapter interface for sending transactional emails.
 * Implementations can use console logging (dev) or real email services (prod).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailAdapter {
  /**
   * Send an email message.
   * @param message - The email message to send
   * @returns Result indicating success or failure
   */
  send(message: EmailMessage): Promise<SendResult>;
}
