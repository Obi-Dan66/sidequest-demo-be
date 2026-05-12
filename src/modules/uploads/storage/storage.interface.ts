/**
 * Storage abstraction. The local-disk driver is shipped for MVP.
 * Production swap: implement S3StorageDriver / GcsStorageDriver behind this interface
 * and bind it in UploadsModule providers - no callers need to change.
 */
export interface StoredObject {
  filename: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageDriver {
  save(input: { buffer: Buffer; originalName: string; mimeType: string }): Promise<StoredObject>;
  delete(filename: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
