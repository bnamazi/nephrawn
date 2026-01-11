/**
 * Real Withings API adapter.
 * Requires valid WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET.
 */

import {
  WithingsAdapter,
  TokenResponse,
  MeasureParams,
  WithingsMeasureGroup,
} from "./withings.adapter.js";
import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";

const WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const WITHINGS_MEASURE_URL = "https://wbsapi.withings.net/measure";

interface WithingsApiResponse<T> {
  status: number;
  body: T;
  error?: string;
}

interface WithingsTokenBody {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  userid: string;
  token_type: string;
}

interface WithingsMeasureBody {
  updatetime: number;
  timezone: string;
  measuregrps: Array<{
    grpid: number;
    attrib: number;
    date: number;
    created: number;
    deviceid?: string;
    measures: Array<{
      value: number;
      type: number;
      unit: number;
    }>;
  }>;
}

export class RealWithingsAdapter implements WithingsAdapter {
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.withings.clientId,
      scope: config.withings.scopes,
      redirect_uri: config.withings.redirectUri,
      state,
    });

    return `${WITHINGS_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    logger.info("Withings: exchanging code for token");

    const params = new URLSearchParams({
      action: "requesttoken",
      grant_type: "authorization_code",
      client_id: config.withings.clientId,
      client_secret: config.withings.clientSecret,
      code,
      redirect_uri: config.withings.redirectUri,
    });

    const response = await fetch(WITHINGS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await response.json()) as WithingsApiResponse<WithingsTokenBody>;

    if (data.status !== 0) {
      logger.error({ status: data.status, error: data.error }, "Withings token exchange failed");
      throw new Error(`Withings API error: ${data.error || `status ${data.status}`}`);
    }

    return {
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
      expiresIn: data.body.expires_in,
      scope: data.body.scope,
      userId: String(data.body.userid),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    logger.info("Withings: refreshing access token");

    const params = new URLSearchParams({
      action: "requesttoken",
      grant_type: "refresh_token",
      client_id: config.withings.clientId,
      client_secret: config.withings.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(WITHINGS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await response.json()) as WithingsApiResponse<WithingsTokenBody>;

    if (data.status !== 0) {
      logger.error({ status: data.status, error: data.error }, "Withings token refresh failed");
      throw new Error(`Withings API error: ${data.error || `status ${data.status}`}`);
    }

    return {
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
      expiresIn: data.body.expires_in,
      scope: data.body.scope,
      userId: String(data.body.userid),
    };
  }

  async getMeasurements(
    accessToken: string,
    params: MeasureParams
  ): Promise<WithingsMeasureGroup[]> {
    logger.info({ params }, "Withings: fetching measurements");

    const queryParams: Record<string, string> = {
      action: "getmeas",
      category: String(params.category ?? 1), // 1 = real measures
    };

    if (params.startdate) {
      queryParams.startdate = String(params.startdate);
    }
    if (params.enddate) {
      queryParams.enddate = String(params.enddate);
    }
    if (params.lastupdate) {
      queryParams.lastupdate = String(params.lastupdate);
    }

    // Request all measurement types we care about
    queryParams.meastypes = "1,5,6,8,9,10,11,76,77,88,91";

    const urlParams = new URLSearchParams(queryParams);

    const response = await fetch(`${WITHINGS_MEASURE_URL}?${urlParams.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = (await response.json()) as WithingsApiResponse<WithingsMeasureBody>;

    if (data.status !== 0) {
      logger.error({ status: data.status, error: data.error }, "Withings getmeas failed");
      throw new Error(`Withings API error: ${data.error || `status ${data.status}`}`);
    }

    return data.body.measuregrps.map((grp) => ({
      grpid: grp.grpid,
      date: grp.date,
      deviceid: grp.deviceid,
      measures: grp.measures.map((m) => ({
        type: m.type,
        value: m.value,
        unit: m.unit,
      })),
    }));
  }
}
