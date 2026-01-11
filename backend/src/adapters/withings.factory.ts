/**
 * Factory for creating the appropriate Withings adapter based on configuration.
 */

import { WithingsAdapter } from "./withings.adapter.js";
import { MockWithingsAdapter } from "./mock-withings.adapter.js";
import { RealWithingsAdapter } from "./real-withings.adapter.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

let adapterInstance: WithingsAdapter | null = null;

/**
 * Get the Withings adapter instance.
 * Returns mock adapter if WITHINGS_MOCK=true or credentials are not configured.
 */
export function getWithingsAdapter(): WithingsAdapter {
  if (!adapterInstance) {
    if (config.withings.mock) {
      logger.info("Using mock Withings adapter");
      adapterInstance = new MockWithingsAdapter();
    } else {
      if (!config.withings.clientId || !config.withings.clientSecret) {
        logger.warn(
          "Withings credentials not configured, falling back to mock adapter"
        );
        adapterInstance = new MockWithingsAdapter();
      } else {
        logger.info("Using real Withings adapter");
        adapterInstance = new RealWithingsAdapter();
      }
    }
  }
  return adapterInstance;
}

/**
 * Reset the adapter instance (for testing).
 */
export function resetWithingsAdapter(): void {
  adapterInstance = null;
}
