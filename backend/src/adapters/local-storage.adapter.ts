import { createHmac } from "crypto";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { StorageAdapter } from "./storage.adapter.js";

const DEFAULT_EXPIRY_SECONDS = 900; // 15 minutes

/**
 * Local filesystem storage adapter for development.
 * Files are stored in ./uploads directory.
 * Signed URLs use HMAC tokens for verification.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(options?: { uploadDir?: string; baseUrl?: string; secret?: string }) {
    this.uploadDir = options?.uploadDir ?? join(process.cwd(), "uploads");
    this.baseUrl = options?.baseUrl ?? "http://localhost:3000";
    this.secret = options?.secret ?? process.env.JWT_SECRET ?? "local-dev-secret";

    // Ensure upload directory exists
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Generate a signed token for URL authentication.
   */
  private generateToken(key: string, expires: number): string {
    const data = `${key}:${expires}`;
    return createHmac("sha256", this.secret).update(data).digest("hex");
  }

  /**
   * Verify a signed token.
   */
  verifyToken(key: string, expires: number, token: string): boolean {
    if (Date.now() > expires) {
      return false;
    }
    const expectedToken = this.generateToken(key, expires);
    return token === expectedToken;
  }

  async generateUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = DEFAULT_EXPIRY_SECONDS
  ): Promise<string> {
    const expires = Date.now() + expiresIn * 1000;
    const token = this.generateToken(key, expires);

    // Ensure directory exists for the key
    const filePath = this.getFilePath(key);
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // For local storage, the upload URL points to our file upload endpoint
    const params = new URLSearchParams({
      token,
      expires: expires.toString(),
      contentType,
    });

    return `${this.baseUrl}/files/${encodeURIComponent(key)}?${params.toString()}`;
  }

  async generateDownloadUrl(
    key: string,
    expiresIn: number = DEFAULT_EXPIRY_SECONDS
  ): Promise<string> {
    const expires = Date.now() + expiresIn * 1000;
    const token = this.generateToken(key, expires);

    const params = new URLSearchParams({
      token,
      expires: expires.toString(),
    });

    return `${this.baseUrl}/files/${encodeURIComponent(key)}?${params.toString()}`;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    return existsSync(filePath);
  }

  getUploadDirectory(): string {
    return this.uploadDir;
  }

  getFilePath(key: string): string {
    // Prevent directory traversal attacks
    const sanitizedKey = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return join(this.uploadDir, sanitizedKey);
  }
}

// Singleton instance for the application
let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    storageAdapter = new LocalStorageAdapter();
  }
  return storageAdapter;
}

export function setStorageAdapter(adapter: StorageAdapter): void {
  storageAdapter = adapter;
}
