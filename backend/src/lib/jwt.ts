import jwt from "jsonwebtoken";
import { config } from "./config.js";

export type TokenPayload = {
  sub: string;
  email: string;
  role: "patient" | "clinician" | "admin";
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
}
