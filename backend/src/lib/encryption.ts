import crypto from "crypto";
import { config } from "./config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts text using AES-256-GCM.
 * Output format: iv:tag:ciphertext (all hex-encoded)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts text that was encrypted with encrypt().
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error("Invalid encrypted data format");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Get the encryption key from config, ensuring it's the correct length.
 */
function getEncryptionKey(): Buffer {
  const keyString = config.encryption.key;

  // If hex-encoded key, convert to buffer
  if (keyString.length === 64 && /^[0-9a-fA-F]+$/.test(keyString)) {
    return Buffer.from(keyString, "hex");
  }

  // Otherwise, derive a 32-byte key using SHA-256
  return crypto.createHash("sha256").update(keyString).digest();
}
