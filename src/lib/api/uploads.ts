import { apiUpload } from '../api-client'
import type { UploadedFileDto, UploadFolder } from '@/types/upload'

/**
 * MOBILE: rewritten from the web app's `lib/api/uploads.ts`.
 *
 * The web version appends a `File` to `FormData`. React Native has no `File` —
 * an image picker or the camera hands back a URI into the app's own sandbox,
 * and the platform networking layer streams the file from that path when the
 * form is sent. So the shape of what goes into `FormData` is genuinely
 * different, and this is the one API module that could not be copied.
 *
 * Everything else is identical: same endpoint, same folders, same response,
 * and the URL that comes back is still what goes on the record the file
 * belongs to.
 */

/**
 * A file chosen on the device.
 *
 * Deliberately narrower than expo-image-picker's own asset type, so the camera,
 * the photo library and a document picker can all feed the same function.
 */
export interface UploadAsset {
  /** `file://…` inside the app sandbox, as the picker returns it. */
  uri: string
  /** What the file is called server-side. */
  name: string
  mimeType: string
}

/**
 * React Native's `FormData` accepts this object where the web takes a `Blob`.
 *
 * It is not in the DOM `FormData` types, hence the cast — RN's own typings
 * model `append` against the web signature even though the runtime differs.
 */
interface ReactNativeFormDataFile {
  uri: string
  name: string
  type: string
}

export const uploadApi = {
  /**
   * Sends one file and gets back the URL it reads from.
   *
   * Uploading and using a file are two steps: the URL returned here is what
   * goes on the record the file belongs to — a rider document's `fileUrl`, a
   * restaurant's logo — so every other endpoint keeps taking plain JSON.
   */
  uploadFile: (
    file: UploadAsset,
    folder: UploadFolder,
    options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
  ) => {
    const form = new FormData()

    const part: ReactNativeFormDataFile = {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    }

    form.append('file', part as unknown as Blob)
    form.append('folder', folder)

    return apiUpload<UploadedFileDto>('/uploads', form, options)
  },
}
