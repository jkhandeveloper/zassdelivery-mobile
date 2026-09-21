/** Where a file is filed in the bucket. Mirrors `UploadFolder` on the API. */
export type UploadFolder =
  | 'rider-documents'
  | 'restaurant-logos'
  | 'restaurant-gallery'
  | 'menu-items'
  | 'avatars'
  | 'support-attachments'
  | 'payment-qr-codes'

export interface UploadedFileDto {
  /** Absolute URL the file reads back from. This is what records store. */
  url: string
  key: string
  folder: UploadFolder
  fileName: string | null
  mimeType: string
  size: number
}

/**
 * The picture formats the API accepts.
 *
 * Split out from the full list because most upload fields in the product are
 * photos — a logo, a dish, a gallery shot — and a PDF picked for one of those
 * would upload happily and then render as a broken image.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

/**
 * What the API accepts, kept in one place so the file picker's `accept`
 * attribute and its rejection message can never drift from each other.
 */
export const ACCEPTED_UPLOAD_TYPES = [...ACCEPTED_IMAGE_TYPES, 'application/pdf'] as const

/** Extensions listed alongside the media types because HEIC from an iPhone often
 * arrives with an empty or unexpected one. */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const

export const UPLOAD_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf'] as const

/** For `<input type="file" accept>`. */
export const ACCEPT_IMAGES = `${ACCEPTED_IMAGE_TYPES.join(',')},${IMAGE_EXTENSIONS.map((extension) => `.${extension}`).join(',')}`

export const ACCEPT_ATTRIBUTE = `${ACCEPTED_UPLOAD_TYPES.join(',')},${UPLOAD_EXTENSIONS.map((extension) => `.${extension}`).join(',')}`

/** Must match `UPLOAD_MAX_FILE_SIZE_MB` on the API. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
