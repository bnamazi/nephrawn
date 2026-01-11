/**
 * Mock Withings adapter for development and testing without real credentials.
 * Simulates OAuth flow and returns realistic measurement data.
 */

import {
  WithingsAdapter,
  TokenResponse,
  MeasureParams,
  WithingsMeasureGroup,
  WITHINGS_MEASURE_TYPES,
} from "./withings.adapter.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

export class MockWithingsAdapter implements WithingsAdapter {
  private mockTokenCounter = 0;

  getAuthorizationUrl(state: string): string {
    // Return a mock URL that points to our callback directly
    const redirectUri = encodeURIComponent(config.withings.redirectUri);
    const mockCode = `mock_auth_code_${Date.now()}`;

    logger.info({ state }, "Mock Withings: generating authorization URL");

    // In mock mode, we simulate the redirect directly
    return `${config.withings.redirectUri}?code=${mockCode}&state=${state}`;
  }

  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    logger.info({ code }, "Mock Withings: exchanging code for token");

    // Simulate a small delay like a real API call
    await this.delay(100);

    this.mockTokenCounter++;

    return {
      accessToken: `mock_access_token_${this.mockTokenCounter}_${Date.now()}`,
      refreshToken: `mock_refresh_token_${this.mockTokenCounter}_${Date.now()}`,
      expiresIn: 10800, // 3 hours
      scope: "user.metrics",
      userId: `mock_withings_user_${this.mockTokenCounter}`,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    logger.info("Mock Withings: refreshing access token");

    await this.delay(100);

    this.mockTokenCounter++;

    return {
      accessToken: `mock_access_token_${this.mockTokenCounter}_${Date.now()}`,
      refreshToken: `mock_refresh_token_${this.mockTokenCounter}_${Date.now()}`,
      expiresIn: 10800, // 3 hours
      scope: "user.metrics",
      userId: refreshToken.split("_")[3] || `mock_user_${this.mockTokenCounter}`,
    };
  }

  async getMeasurements(
    accessToken: string,
    params: MeasureParams
  ): Promise<WithingsMeasureGroup[]> {
    logger.info({ params }, "Mock Withings: fetching measurements");

    await this.delay(150);

    const now = Math.floor(Date.now() / 1000);
    const uniqueId = Date.now(); // Use milliseconds for uniqueness
    const groups: WithingsMeasureGroup[] = [];

    // Generate BPM Pro2 data (blood pressure)
    groups.push({
      grpid: uniqueId * 10 + 1,
      date: now - 300, // 5 minutes ago
      deviceid: "mock_bpm_pro2",
      measures: [
        {
          type: WITHINGS_MEASURE_TYPES.SYSTOLIC_BP,
          value: 120 + Math.floor(Math.random() * 15),
          unit: 0,
        },
        {
          type: WITHINGS_MEASURE_TYPES.DIASTOLIC_BP,
          value: 75 + Math.floor(Math.random() * 10),
          unit: 0,
        },
        {
          type: WITHINGS_MEASURE_TYPES.HEART_RATE,
          value: 68 + Math.floor(Math.random() * 12),
          unit: 0,
        },
      ],
    });

    // Generate Body Pro 2 data (scale with body composition)
    const baseWeight = 7000 + Math.floor(Math.random() * 500); // 70-75 kg in centgrams
    const fatRatio = 200 + Math.floor(Math.random() * 80); // 20-28% in tenths

    groups.push({
      grpid: uniqueId * 10 + 2,
      date: now - 600, // 10 minutes ago
      deviceid: "mock_body_pro2",
      measures: [
        {
          type: WITHINGS_MEASURE_TYPES.WEIGHT,
          value: baseWeight,
          unit: -2, // centgrams to kg
        },
        {
          type: WITHINGS_MEASURE_TYPES.FAT_FREE_MASS,
          value: Math.floor(baseWeight * (1 - fatRatio / 1000)),
          unit: -2,
        },
        {
          type: WITHINGS_MEASURE_TYPES.FAT_RATIO,
          value: fatRatio,
          unit: -1, // tenths of percent
        },
        {
          type: WITHINGS_MEASURE_TYPES.FAT_MASS,
          value: Math.floor(baseWeight * (fatRatio / 1000)),
          unit: -2,
        },
        {
          type: WITHINGS_MEASURE_TYPES.MUSCLE_MASS,
          value: Math.floor(baseWeight * 0.42),
          unit: -2,
        },
        {
          type: WITHINGS_MEASURE_TYPES.HYDRATION,
          value: Math.floor(baseWeight * 0.55),
          unit: -2,
        },
        {
          type: WITHINGS_MEASURE_TYPES.BONE_MASS,
          value: Math.floor(baseWeight * 0.04),
          unit: -2,
        },
        {
          type: WITHINGS_MEASURE_TYPES.PULSE_WAVE_VELOCITY,
          value: 75 + Math.floor(Math.random() * 20),
          unit: -1, // 7.5-9.5 m/s
        },
        {
          type: WITHINGS_MEASURE_TYPES.HEART_RATE,
          value: 62 + Math.floor(Math.random() * 10),
          unit: 0, // bpm (standing on scale)
        },
      ],
    });

    logger.info(
      { groupCount: groups.length, measureCount: groups.reduce((sum, g) => sum + g.measures.length, 0) },
      "Mock Withings: returning measurements"
    );

    return groups;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
