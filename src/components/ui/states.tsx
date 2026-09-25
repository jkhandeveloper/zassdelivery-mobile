import { CloudOff, Inbox, TriangleAlert } from "lucide-react-native";
import * as React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Body, Heading } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api-client";
import { usePalette } from "@/lib/palette";
import { cn } from "@/lib/utils";

/**
 * The three states every data screen has besides "it worked".
 *
 * Centralised because getting them consistent matters more than getting any one
 * of them perfect, and because `ErrorState` has a job that is easy to skip: it
 * distinguishes "you are offline" from "the server said no". On a phone the
 * first is common and retrying fixes it; the second is not, and a retry button
 * on a 403 just invites the user to fail again.
 */

/** The round tinted medallion every state leads with. */
function StateIcon({ children, tone }: { children: React.ReactNode; tone: "brand" | "danger" }) {
  return (
    <View
      collapsable={false}
      className={cn(
        "mb-1 h-20 w-20 items-center justify-center rounded-full",
        tone === "brand" ? "bg-brand-soft" : "bg-danger-soft",
      )}
    >
      {children}
    </View>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const palette = usePalette();

  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator size="large" color={palette.brand} />
      <Text className="font-sans text-[14px] text-muted">{label}</Text>
    </View>
  );
}

/** A grey block standing in for content whose shape is already known. */
export function Skeleton({ className }: { className?: string }) {
  return <View className={cn("rounded-input bg-skeleton", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  /** Replaces the default inbox glyph; drawn at 34pt in the brand colour. */
  icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const palette = usePalette();
  const Icon = icon ?? Inbox;

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <StateIcon tone="brand">
        <Icon size={34} color={palette.brand} />
      </StateIcon>
      <Heading level={3} className="text-center">
        {title}
      </Heading>
      {description !== undefined ? (
        <Body muted className="text-center">
          {description}
        </Body>
      ) : null}
      {action !== undefined ? (
        <Button variant="outline" onPress={action.onPress} className="mt-2">
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const palette = usePalette();
  const apiError = error instanceof ApiError ? error : null;

  const offline = apiError?.isNetworkError ?? false;

  const title = offline ? "You're offline" : "Something went wrong";

  const message = apiError?.message ?? "We couldn't load this. Please try again in a moment.";

  // A retry is only offered where it could plausibly succeed. A 4xx other than
  // 408/429 will fail identically however many times it is tried.
  const worthRetrying =
    onRetry !== undefined &&
    (offline ||
      apiError === null ||
      apiError.status >= 500 ||
      apiError.status === 408 ||
      apiError.status === 429);

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <StateIcon tone={offline ? "brand" : "danger"}>
        {offline ? (
          <CloudOff size={34} color={palette.brand} />
        ) : (
          <TriangleAlert size={34} color={palette.danger} />
        )}
      </StateIcon>
      <Heading level={3} className="text-center">
        {title}
      </Heading>
      <Body muted className="text-center">
        {message}
      </Body>

      {/*
        The request id is what support correlates against the server logs. Only
        shown when there is one, and kept quiet enough not to alarm anyone.
      */}
      {apiError?.requestId !== null && apiError?.requestId !== undefined ? (
        <Text selectable className="font-sans text-[11px] text-muted">
          Reference: {apiError.requestId}
        </Text>
      ) : null}

      {worthRetrying ? (
        <Button variant="outline" onPress={onRetry} className="mt-2">
          Try again
        </Button>
      ) : null}
    </View>
  );
}
