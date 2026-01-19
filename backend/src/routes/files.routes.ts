import { Router, Request, Response } from "express";
import { createReadStream, existsSync, statSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { mkdirSync } from "fs";
import { LocalStorageAdapter, getStorageAdapter } from "../adapters/local-storage.adapter.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * GET /files/:key
 * Serve a file with signed token verification.
 * Used for both uploads (via PUT) and downloads (via GET).
 */
router.get("/*splat", async (req: Request, res: Response) => {
  try {
    // Get the key from the URL path (everything after /files/)
    // In Express 5, named splat params are captured in req.params.splat as an array
    const splatParam = req.params.splat;
    const rawKey = Array.isArray(splatParam) ? splatParam.join("/") : (splatParam || req.path.substring(1));
    const key = decodeURIComponent(rawKey);
    const token = req.query.token as string;
    const expires = parseInt(req.query.expires as string, 10);

    if (!token || !expires) {
      res.status(400).json({ error: "Missing token or expires parameter" });
      return;
    }

    const storage = getStorageAdapter();
    if (!(storage instanceof LocalStorageAdapter)) {
      res.status(501).json({ error: "File serving not supported for this storage backend" });
      return;
    }

    // Verify the signed token
    if (!storage.verifyToken(key, expires, token)) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    const filePath = storage.getFilePath(key);

    if (!existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const stat = statSync(filePath);

    // Set content headers
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${key.split("/").pop()}"`);

    // Stream the file
    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    logger.error({ err: error }, "Error serving file");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

/**
 * PUT /files/:key
 * Upload a file with signed token verification.
 * The client uploads directly to this endpoint after getting a signed URL.
 */
router.put("/*splat", async (req: Request, res: Response) => {
  try {
    // Get the key from the URL path (everything after /files/)
    // In Express 5, named splat params are captured in req.params.splat as an array
    const splatParam = req.params.splat;
    const rawKey = Array.isArray(splatParam) ? splatParam.join("/") : (splatParam || req.path.substring(1));
    const key = decodeURIComponent(rawKey);
    const token = req.query.token as string;
    const expires = parseInt(req.query.expires as string, 10);
    const contentType = req.query.contentType as string;

    if (!token || !expires) {
      res.status(400).json({ error: "Missing token or expires parameter" });
      return;
    }

    const storage = getStorageAdapter();
    if (!(storage instanceof LocalStorageAdapter)) {
      res.status(501).json({ error: "File upload not supported for this storage backend" });
      return;
    }

    // Verify the signed token
    if (!storage.verifyToken(key, expires, token)) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    const filePath = storage.getFilePath(key);
    const dir = dirname(filePath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Collect the request body
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      writeFileSync(filePath, buffer);
      res.status(200).json({ success: true, key });
    });

    req.on("error", (error) => {
      logger.error({ err: error }, "Error receiving upload");
      res.status(500).json({ error: "Failed to receive upload" });
    });
  } catch (error) {
    logger.error({ err: error }, "Error handling upload");
    res.status(500).json({ error: "Failed to handle upload" });
  }
});

export default router;
