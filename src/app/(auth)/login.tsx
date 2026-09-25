import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { InputAction } from "@/components/ui/input";
import { AuthShell } from "@/components/shared/auth-shell";
import { Body } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { postLoginRoute, safeNextPath } from "@/lib/routes";

/**
 * Ported from the web app's `login-form.tsx`. Same schema, same error copy.
 *
 * The API normalises 03XXXXXXXXX, 92XXXXXXXXXX and +923XXXXXXXXX into E.164
 * itself, so this only has to recognise the three shapes, not canonicalise them.
 */
const PK_MOBILE = /^(?:\+92|92|0)?3\d{9}$/;

const loginSchema = z.object({
  phone: z
    .string()
    .min(1, "Enter your phone number")
    .refine(
      (value) => PK_MOBILE.test(value.replace(/[\s-]/g, "")),
      "Enter a valid mobile number, like 0300 1234567",
    ),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; reason?: string }>();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const nextPath = safeNextPath(params.next);
  const sessionExpired = params.reason === "expired";

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
    // Validate once a field has been left, not on every keystroke: telling
    // someone their phone number is invalid while they are still typing it is
    // noise, and on a phone the error text also shifts the layout underneath
    // their thumb.
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (formValues) => {
    setFormError(null);

    try {
      const user = await login(formValues);
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}`);

      // `replace`, not `push`: the login screen must not sit in the back stack,
      // or the hardware back button returns a signed-in user to it.
      router.replace(postLoginRoute(user, nextPath));
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 429
            ? "Too many attempts. Wait a few minutes, then try again."
            : error.status === 401
              ? "That phone number and password do not match."
              : error.message
          : "Something went wrong. Please try again.";

      setFormError(message);
    }
  });

  return (
    <AuthShell
      eyebrow="Welcome back"
      title={"Good food is\na tap away."}
      subtitle="Sign in to track orders, save addresses and reorder in a tap."
    >
      {sessionExpired ? (
        <View
          accessibilityRole="alert"
          className="rounded-card border border-border-default bg-surface-muted px-4 py-3"
        >
          <Body muted className="text-[14px]">
            Your session expired. Sign in again to pick up where you left off.
          </Body>
        </View>
      ) : null}

      <View className="gap-4">
        {formError !== null ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="rounded-input border border-danger bg-danger-soft px-4 py-3"
          >
            <Text className="font-sans text-[14px] font-medium text-danger">{formError}</Text>
          </View>
        ) : null}

        <ControlledInput
          control={control}
          name="phone"
          label="Phone number"
          required
          placeholder="0300 1234567"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          editable={!isSubmitting}
        />

        <ControlledInput
          control={control}
          name="password"
          label="Password"
          required
          placeholder="Your password"
          secureTextEntry={!showPassword}
          autoComplete="password"
          textContentType="password"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
          editable={!isSubmitting}
          trailing={
            <InputAction
              label={showPassword ? "Hide password" : "Show password"}
              onPress={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? (
                <EyeOff size={20} color="#75909F" />
              ) : (
                <Eye size={20} color="#75909F" />
              )}
            </InputAction>
          }
        />

        <Button onPress={() => void onSubmit()} loading={isSubmitting} fullWidth size="lg">
          Sign in
        </Button>
      </View>

      <View className="flex-row items-center justify-center gap-1">
        <Body muted className="text-[14px]">
          New to ZassDelivery?
        </Body>
        <Link href="/register" asChild>
          <Pressable hitSlop={8} accessibilityRole="link">
            <Text className="font-sans text-[14px] font-semibold text-brand">
              Create an account
            </Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
