import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon, Trash2, Upload } from "lucide-react-native";
import * as React from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useUploadFile } from "@/hooks/use-uploads";
import { ApiError } from "@/lib/api-client";
import type { UploadAsset } from "@/lib/api/uploads";
import { cn, hasText } from "@/lib/utils";
import { MAX_UPLOAD_BYTES, formatFileSize, type UploadFolder } from "@/types/upload";

/**
 * Pick a photo — from the camera or the library — upload it, and hand back the
 * URL.
 *
 * Camera *and* library, always both, because the two uses are genuinely
 * different: a rider photographing their licence has it in their hand, while a
 * vendor adding a dish photo took it last week. Offering only the library makes
 * the first case a three-app detour.
 *
 * The size check happens before the upload, not after. The API rejects anything
 * over its limit, but finding out after a 9 MB upload over a cell connection has
 * already cost the user the wait and the data.
 */

interface ImageUploadFieldProps {
  label: string;
  folder: UploadFolder;
  /** The currently stored URL, if any. */
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
  hint?: string;
  /** Square for documents and avatars; wide for covers and gallery shots. */
  aspect?: "square" | "wide";
  /** Cropping is right for an avatar and wrong for a document. */
  allowsEditing?: boolean;
}

export function ImageUploadField({
  label,
  folder,
  value,
  onChange,
  required,
  hint,
  aspect = "wide",
  allowsEditing = false,
}: ImageUploadFieldProps) {
  const upload = useUploadFile();

  const send = React.useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (asset.fileSize !== undefined && asset.fileSize > MAX_UPLOAD_BYTES) {
        toast.error("That photo is too large", {
          description: `The limit is ${formatFileSize(MAX_UPLOAD_BYTES)}. Try a smaller one.`,
        });
        return;
      }

      const file: UploadAsset = {
        uri: asset.uri,
        // The picker leaves `fileName` empty for a camera capture, and the API
        // needs something to file it under.
        name: asset.fileName ?? `upload-${Date.now()}.jpg`,
        // HEIC from an iPhone often arrives with no mime type at all.
        mimeType: asset.mimeType ?? "image/jpeg",
      };

      try {
        const result = await upload.mutateAsync({ file, folder });
        onChange(result.url);
      } catch (error) {
        toast.error(
          error instanceof ApiError ? error.message : "That upload didn't go through.",
        );
      }
    },
    [upload, folder, onChange],
  );

  const fromLibrary = React.useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      toast.error("Photo access is off", {
        description: "Allow photo access in Settings to pick an image.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing,
      aspect: aspect === "square" ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] !== undefined) {
      await send(result.assets[0]);
    }
  }, [allowsEditing, aspect, send]);

  const fromCamera = React.useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      toast.error("Camera access is off", {
        description: "Allow the camera in Settings to take a photo.",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing,
      aspect: aspect === "square" ? [1, 1] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] !== undefined) {
      await send(result.assets[0]);
    }
  }, [allowsEditing, aspect, send]);

  /** The native chooser on each platform, rather than two buttons. */
  const choose = React.useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Take a photo", "Choose from library", "Cancel"],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) void fromCamera();
          if (index === 1) void fromLibrary();
        },
      );

      return;
    }

    Alert.alert(label, undefined, [
      { text: "Take a photo", onPress: () => void fromCamera() },
      { text: "Choose from library", onPress: () => void fromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [label, fromCamera, fromLibrary]);

  const busy = upload.isPending;

  return (
    <Field label={label} required={required} hint={hint}>
      {hasText(value) ? (
        <View className="gap-2">
          <Image
            source={{ uri: value }}
            style={{
              width: "100%",
              height: aspect === "square" ? 180 : 150,
              borderRadius: 14,
              backgroundColor: "#E4EEF5",
            }}
            contentFit="cover"
            accessibilityLabel={`${label}, uploaded`}
          />
          <View className="flex-row gap-2">
            <Button variant="outline" size="sm" onPress={choose} loading={busy} className="flex-1">
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => onChange(null)}
              disabled={busy}
              accessibilityLabel={`Remove ${label}`}
              icon={<Trash2 size={15} color="#DC2626" />}
            >
              Remove
            </Button>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${label}`}
          accessibilityState={{ busy }}
          onPress={choose}
          disabled={busy}
          className={cn(
            "items-center justify-center gap-2 rounded-input border border-dashed border-border-strong bg-surface-muted py-8",
            busy && "opacity-60",
          )}
        >
          {busy ? (
            <>
              <Upload size={22} color="#0E7490" />
              <Text
                className="font-sans text-[13px] font-semibold text-brand"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {upload.progress ?? 0}%
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row gap-3">
                <Camera size={22} color="#75909F" />
                <ImageIcon size={22} color="#75909F" />
              </View>
              <Text className="font-sans text-[13px] text-secondary">
                Take a photo or choose one
              </Text>
            </>
          )}
        </Pressable>
      )}
    </Field>
  );
}
