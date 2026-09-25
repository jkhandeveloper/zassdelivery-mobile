import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Bike, Eye, EyeOff, ShoppingBag, Store } from "lucide-react-native";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field, InputAction } from "@/components/ui/input";
import { AuthShell } from "@/components/shared/auth-shell";
import { Body } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { postLoginRoute, safeNextPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { UserRole, type SelfServiceRole } from "@/types/auth";

/** Ported from the web app's `register-form.tsx` — identical schema and copy. */
const PK_MOBILE = /^(?:\+92|92|0)?3\d{9}$/;

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120, "That name is too long"),
  phone: z
    .string()
    .min(1, "Enter your phone number")
    .refine(
      (value) => PK_MOBILE.test(value.replace(/[\s-]/g, "")),
      "Enter a valid mobile number, like 0300 1234567",
    ),
  // Mirrors the backend rule: at least 8 characters, with one letter and one digit.
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .refine(
      (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
      "Include at least one letter and one number",
    ),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  role: z.enum([UserRole.CUSTOMER, UserRole.RIDER, UserRole.VENDOR_OWNER]),
});

type RegisterValues = z.infer<typeof registerSchema>;

const ROLE_OPTIONS: readonly {
  value: SelfServiceRole;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}[] = [
  {
    value: UserRole.CUSTOMER,
    label: "Order food",
    description: "Browse restaurants and get delivery",
    Icon: ShoppingBag,
  },
  {
    value: UserRole.RIDER,
    label: "Deliver",
    description: "Earn on your own schedule",
    Icon: Bike,
  },
  {
    value: UserRole.VENDOR_OWNER,
    label: "List a restaurant",
    description: "Take orders from your kitchen",
    Icon: Store,
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { register: registerAccount } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const nextPath = safeNextPath(params.next);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      password: "",
      email: "",
      role: UserRole.CUSTOMER,
    },
    mode: "onTouched",
  });

  // useWatch rather than watch(): the latter returns a fresh function each
  // render, which the React Compiler cannot memoize safely.
  const selectedRole = useWatch({ control, name: "role" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const user = await registerAccount({
        fullName: values.fullName,
        phone: values.phone,
        password: values.password,
        ...(values.email !== "" && { email: values.email }),
        role: values.role,
      });

      toast.success(`Welcome, ${user.fullName.split(" ")[0]}`);
      router.replace(postLoginRoute(user, nextPath));
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.status === 409
            ? "An account already exists with that phone number. Try signing in."
            : error.status === 429
              ? "Too many attempts. Wait a few minutes, then try again."
              : error.message
          : "Something went wrong. Please try again.";

      setFormError(message);
    }
  });

  return (
    <AuthShell
      eyebrow="Join ZassDeliver"
      title={"Order, ride\nor sell."}
      subtitle="One account, whichever side of the order you are on."
    >
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

        {/*
          Role is picked before anything is typed, because it changes what the
          account *is*. Rendered as cards rather than a picker: on the web this
          is a radio group, and a native picker would hide the descriptions
          behind a tap — which is where the actual decision is explained.
        */}
        <Field label="I want to">
          <View className="gap-2">
            {ROLE_OPTIONS.map(({ value, label, description, Icon }) => {
              const active = selectedRole === value;

              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label}. ${description}`}
                  onPress={() => setValue("role", value, { shouldValidate: true })}
                  disabled={isSubmitting}
                  className={cn(
                    "flex-row items-center gap-3 rounded-card border px-4 py-3",
                    active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                  )}
                >
                  <Icon size={22} color={active ? "#0E7490" : "#75909F"} />
                  <View className="flex-1">
                    <Text
                      className={cn(
                        "font-sans text-[15px] font-semibold",
                        active ? "text-brand" : "text-primary",
                      )}
                    >
                      {label}
                    </Text>
                    <Text className="font-sans text-[13px] text-secondary">{description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <ControlledInput
          control={control}
          name="fullName"
          label="Full name"
          required
          placeholder="Your name"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          editable={!isSubmitting}
        />

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
          editable={!isSubmitting}
        />

        <ControlledInput
          control={control}
          name="email"
          label="Email"
          hint="Optional — for receipts and account recovery."
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
        />

        <ControlledInput
          control={control}
          name="password"
          label="Password"
          required
          hint="At least 8 characters, with a letter and a number."
          placeholder="Create a password"
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          autoCapitalize="none"
          autoCorrect={false}
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
          Create account
        </Button>

        {/*
          Both onboarding flows live outside the guarded portals on purpose:
          someone signing up to *become* a vendor or rider does not hold that
          role yet, so a guarded screen would be unreachable by exactly the
          people who need it. Registering here creates the account; the
          application itself is filed from the portal's gate afterwards.
        */}
        <Body muted className="text-[13px]">
          Riders and restaurant owners file an application after signing up. An administrator
          reviews it before you can take orders.
        </Body>
      </View>

      <View className="flex-row items-center justify-center gap-1">
        <Body muted className="text-[14px]">
          Already have an account?
        </Body>
        <Link href="/login" asChild>
          <Pressable hitSlop={8} accessibilityRole="link">
            <Text className="font-sans text-[14px] font-semibold text-brand">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
