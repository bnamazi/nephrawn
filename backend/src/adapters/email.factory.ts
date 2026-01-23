/**
 * Factory for creating the appropriate email adapter based on configuration.
 */

import { EmailAdapter } from "./email.adapter.js";
import { ConsoleEmailAdapter } from "./console-email.adapter.js";
import { ResendEmailAdapter } from "./resend-email.adapter.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

let adapterInstance: EmailAdapter | null = null;

/**
 * Get the email adapter instance.
 * Returns console adapter if RESEND_API_KEY is not configured.
 */
export function getEmailAdapter(): EmailAdapter {
  if (!adapterInstance) {
    if (config.email.resendApiKey) {
      logger.info("Using Resend email adapter");
      adapterInstance = new ResendEmailAdapter(
        config.email.resendApiKey,
        config.email.fromAddress
      );
    } else {
      logger.warn("RESEND_API_KEY not set, using console email adapter");
      adapterInstance = new ConsoleEmailAdapter();
    }
  }
  return adapterInstance;
}

/**
 * Reset the adapter instance (for testing).
 */
export function resetEmailAdapter(): void {
  adapterInstance = null;
}
