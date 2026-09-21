import { useMutation } from "@tanstack/react-query";
import * as React from "react";

import { uploadApi, type UploadAsset } from "@/lib/api/uploads";
import type { UploadedFileDto, UploadFolder } from "@/types/upload";

/**
 * MOBILE: same hook as the web app's, over a `UploadAsset` rather than a `File`.
 * See `lib/api/uploads.ts` for why that type had to change.
 *
 * Sends one file and reports how far along it is.
 *
 * Progress is state rather than a callback so a form can render a bar without
 * wiring one up itself; it is reset on every new attempt, and cleared when the
 * upload settles either way. It earns its keep more here than on the web — a
 * photo going up over a cell connection takes long enough that a button with
 * no feedback gets tapped again.
 */
export function useUploadFile() {
  const [progress, setProgress] = React.useState<number | null>(null);

  const mutation = useMutation<
    UploadedFileDto,
    Error,
    { file: UploadAsset; folder: UploadFolder }
  >({
    mutationFn: ({ file, folder }) => {
      setProgress(0);
      return uploadApi.uploadFile(file, folder, { onProgress: setProgress });
    },
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress };
}
