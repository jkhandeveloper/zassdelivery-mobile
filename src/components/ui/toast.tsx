import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A stand-in for `sonner`, which is web-only.
 *
 * The call signature is copied deliberately — `toast.success(msg)`,
 * `toast.error(msg)`, `toast(title, { description })` — so the web app's
 * components and hooks port across without their toast calls being rewritten.
 * That is worth more than a nicer API.
 *
 * Implemented as an external store rather than context so the imperative
 * `toast()` can be called from anywhere, including outside React — mutation
 * error handlers in the copied hooks do exactly that.
 */

type ToastVariant = "default" | "success" | "error";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastOptions {
  description?: string;
  /** Milliseconds on screen. Errors default to longer — they are read, not glanced at. */
  duration?: number;
}

let nextId = 1;
let items: Toast[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function dismiss(id: number): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(variant: ToastVariant, title: string, options?: ToastOptions): void {
  const id = nextId++;
  const duration = options?.duration ?? (variant === "error" ? 6_000 : 4_000);

  // Three at a time. A burst of realtime events — a vendor's order queue
  // waking up after a reconnect — would otherwise paper over the whole screen.
  items = [...items, { id, title, variant, description: options?.description }].slice(-3);
  emit();

  setTimeout(() => dismiss(id), duration);
}

interface ToastApi {
  (title: string, options?: ToastOptions): void;
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
}

export const toast: ToastApi = Object.assign(
  (title: string, options?: ToastOptions) => push("default", title, options),
  {
    success: (title: string, options?: ToastOptions) => push("success", title, options),
    error: (title: string, options?: ToastOptions) => push("error", title, options),
  },
);

const ACCENT: Record<ToastVariant, string> = {
  default: "border-l-brand",
  success: "border-l-success",
  error: "border-l-danger",
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Toast[] {
  return items;
}

/** Mounted once, at the root, above every screen. */
export function Toaster() {
  const toasts = React.useSyncExternalStore(subscribe, getSnapshot);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      // `pointerEvents="box-none"` so the strip never swallows a tap meant for
      // the screen behind it — only the cards themselves are touchable.
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 gap-2 px-4"
      style={{ top: insets.top + 8 }}
    >
      {toasts.map((item) => (
        <Animated.View key={item.id} entering={FadeInUp} exiting={FadeOutUp}>
          <Pressable
            onPress={() => dismiss(item.id)}
            accessibilityRole="alert"
            className={`rounded-input border border-border-default border-l-4 bg-surface px-4 py-3 ${ACCENT[item.variant]}`}
            style={{
              shadowColor: "#031220",
              shadowOpacity: 0.24,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <Text className="font-sans text-[15px] font-semibold text-primary">{item.title}</Text>
            {item.description !== undefined && item.description !== "" ? (
              <Text className="mt-0.5 font-sans text-[13px] text-secondary">
                {item.description}
              </Text>
            ) : null}
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}
