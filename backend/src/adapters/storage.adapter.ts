/**
 * Storage adapter interface for file storage.
 * Implementations can use local filesystem, S3, or other storage backends.
 */
export interface StorageAdapter {
  /**
   * Generate a signed URL for uploading a file.
   * @param key - The storage key (path) for the file
   * @param contentType - MIME type of the file
   * @param expiresIn - URL expiration in seconds (default: 900 = 15 minutes)
   * @returns The signed upload URL
   */
  generateUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;

  /**
   * Generate a signed URL for downloading a file.
   * @param key - The storage key (path) of the file
   * @param expiresIn - URL expiration in seconds (default: 900 = 15 minutes)
   * @returns The signed download URL
   */
  generateDownloadUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a file from storage.
   * @param key - The storage key (path) of the file to delete
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Check if a file exists in storage.
   * @param key - The storage key (path) to check
   * @returns True if the file exists
   */
  fileExists(key: string): Promise<boolean>;

  /**
   * Get the upload directory for direct file writes (local storage only).
   * Used by the file upload endpoint to write files directly.
   * @returns The absolute path to the upload directory
   */
  getUploadDirectory(): string;

  /**
   * Get the full path for a storage key (local storage only).
   * @param key - The storage key
   * @returns The absolute file path
   */
  getFilePath(key: string): string;
}
