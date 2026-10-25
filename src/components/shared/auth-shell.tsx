import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroBackdrop, useLightStatusBar } from "@/components/ui/hero-backdrop";
import { Screen } from "@/components/ui/primitives";

/**
 * The frame shared by sign-in and sign-up: the brand hero on top, the form on a
 * raised sheet that overlaps it.
 *
 * These are the first screens a new user sees, so they carry the identity —
 * the navy ground and the logo — rather than being a plain white form.
 */

// Metro resolves images through `require`; there is no static import for them.
const LOGO = require("@/assets/images/logo.png") as number;
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLightStatusBar();

  return (
    <Screen scroll edges={{ top: false }} contentContainerClassName="px-0 pb-10">
      <View
        collapsable={false}
        className="overflow-hidden px-6 pb-16"
        style={{ paddingTop: insets.top + 16 }}
      >
        <HeroBackdrop />

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <BrandMark size={44} />
            <Text className="font-display text-[20px] font-extrabold text-white">ZassFood</Text>
          </View>

          {/* The storefront is public, so signing in is always optional to leave. */}
          {router.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <X size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>

        <View className="mt-10 gap-2">
          <Text
            className="font-sans text-[12px] font-bold uppercase"
            style={{ color: "#67E8F9", letterSpacing: 1.6 }}
          >
            {eyebrow}
          </Text>
          <Text
            className="font-display text-[32px] font-extrabold text-white"
            style={{ letterSpacing: -0.8, lineHeight: 38 }}
          >
            {title}
          </Text>
          <Text className="font-sans text-[15px] leading-6" style={{ color: "#B8CCDA" }}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View collapsable={false} className="-mt-8 gap-6 rounded-t-hero bg-canvas px-5 pt-7">
        {children}
      </View>
    </Screen>
  );
}
