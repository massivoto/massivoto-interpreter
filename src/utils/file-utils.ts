/**
 * File utilities for OTO runtime.
 *
 * OtoFile represents a resolved file with content and metadata.
 * readFile() reads from disk and produces an OtoFile.
 */
import { readFile as fsReadFile } from 'node:fs/promises'
import { extname } from 'node:path'

export interface OtoFile {
  path: string       // original path (e.g., ~/images/f1.png)
  base64: string     // content as base64
  mimeType: string   // e.g., image/png
  size: number       // file size in bytes
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
}

export function mimeTypeFromExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

export async function readFile(filePath: string): Promise<OtoFile> {
  const buffer = await fsReadFile(filePath)
  return {
    path: filePath,
    base64: buffer.toString('base64'),
    mimeType: mimeTypeFromExtension(filePath),
    size: buffer.length,
  }
}

/**
 * Extracts base64 and mimeType from either an OtoFile or a raw base64 string.
 * Used by handlers that accept both input types.
 */
export function toImageData(image: unknown): { base64: string; mimeType: string } {
  if (typeof image === 'string') {
    return { base64: image, mimeType: 'image/png' }
  }
  if (image && typeof image === 'object' && 'base64' in image) {
    const file = image as OtoFile
    return { base64: file.base64, mimeType: file.mimeType }
  }
  throw new Error('Invalid image: expected a base64 string or an OtoFile object')
}
