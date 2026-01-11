/**
 * Withings API adapter interface.
 * Implementations can use the real Withings API or a mock for testing.
 */

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  scope: string;
  userId: string; // Withings user ID
}

export interface MeasureParams {
  startdate?: number; // Unix timestamp
  enddate?: number; // Unix timestamp
  lastupdate?: number; // Unix timestamp for incremental sync
  category?: number; // 1 = real measures (not objectives)
}

export interface WithingsMeasure {
  type: number; // 1=weight, 9=diastolic, 10=systolic, etc.
  value: number;
  unit: number; // Power of 10 multiplier
}

export interface WithingsMeasureGroup {
  grpid: number; // Group ID (unique identifier for this measurement set)
  date: number; // Unix timestamp
  measures: WithingsMeasure[];
  deviceid?: string;
}

export interface WithingsAdapter {
  /**
   * Generate the OAuth authorization URL for user consent.
   * @param state - CSRF protection state value
   * @returns The full authorization URL
   */
  getAuthorizationUrl(state: string): string;

  /**
   * Exchange authorization code for tokens.
   * Must be called within 30 seconds of receiving the code.
   * @param code - Authorization code from callback
   * @returns Token response with access and refresh tokens
   */
  exchangeCodeForToken(code: string): Promise<TokenResponse>;

  /**
   * Refresh an expired access token.
   * @param refreshToken - The refresh token
   * @returns New token response
   */
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>;

  /**
   * Fetch measurements from Withings API.
   * @param accessToken - Valid access token
   * @param params - Query parameters for filtering
   * @returns Array of measurement groups
   */
  getMeasurements(
    accessToken: string,
    params: MeasureParams
  ): Promise<WithingsMeasureGroup[]>;
}

/**
 * Withings measurement type codes.
 * See: https://developer.withings.com/api-reference/
 */
export const WITHINGS_MEASURE_TYPES = {
  WEIGHT: 1,
  FAT_FREE_MASS: 5,
  FAT_RATIO: 6,
  FAT_MASS: 8,
  DIASTOLIC_BP: 9,
  SYSTOLIC_BP: 10,
  HEART_RATE: 11,
  TEMPERATURE: 12,
  SPO2: 54,
  BODY_TEMPERATURE: 71,
  SKIN_TEMPERATURE: 73,
  MUSCLE_MASS: 76,
  HYDRATION: 77,
  BONE_MASS: 88,
  PULSE_WAVE_VELOCITY: 91,
} as const;

/**
 * Convert Withings value with unit exponent to actual value.
 * Withings stores values as: real_value = value * 10^unit
 * e.g., value=7200, unit=-2 → 72.00 kg
 */
export function convertWithingsValue(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}
