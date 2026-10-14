import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Body } from "@/components/ui/primitives";

/** "+923001234567" → "0300 1234567", the way people read their own number. */
export function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("92") ? `0${digits.slice(2)}` : digits;

  return local.length === 11 ? `${local.slice(0, 4)} ${local.slice(4)}` : phone;
}

/** Seconds left of a wait that starts when the component mounts. */
function useCountdown(seconds: number): number {
  const [until] = React.useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  return Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * The second half of sign-up and SMS sign-in: the code we texted.
 *
 * Mirrors the web app's `otp-code-step.tsx`. The field asks the OS for the
 * one-time code, so Android's SMS autofill and iOS's keyboard suggestion can
 * fill it straight from the message.
 *
 * Give it a fresh `key` for every code sent: the resend wait starts when it
 * mounts, and the digits typed for the previous code are no use for the next.
 */
export function OtpCodeStep({
  phone,
  codeLength,
  resendAfterSeconds,
  submitting,
  resending,
  submitLabel,
  onSubmit,
  onResend,
  onChangeNumber,
}: {
  phone: string;
  codeLength: number;
  /** The wait before another code may be requested, from when this mounts. */
  resendAfterSeconds: number;
  submitting: boolean;
  resending: boolean;
  submitLabel: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onChangeNumber: () => void;
}) {
  const [code, setCode] = React.useState("");
  const wait = useCountdown(resendAfterSeconds);
  const complete = code.length === codeLength;

  return (
    <View className="gap-4">
      <Body muted className="text-[14px]">
        We texted a {codeLength}-digit code to{" "}
        <Text className="font-semibold text-primary">{displayPhone(phone)}</Text>. It expires in a
        few minutes.
      </Body>

      <Field label="Verification code" required>
        <Input
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, codeLength))}
          placeholder={"0".repeat(codeLength)}
          keyboardType="number-pad"
          maxLength={codeLength}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          autoFocus
          editable={!submitting}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (complete) onSubmit(code);
          }}
          accessibilityLabel="Verification code"
          className="text-[22px] tracking-[6px]"
          style={{ fontVariant: ["tabular-nums"] }}
        />
      </Field>

      <Button
        fullWidth
        size="lg"
        loading={submitting}
        disabled={!complete}
        onPress={() => onSubmit(code)}
      >
        {submitLabel}
      </Button>

      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onChangeNumber}>
          <Text className="font-sans text-[14px] font-semibold text-secondary">Change number</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          disabled={wait > 0 || resending}
          onPress={onResend}
        >
          <Text
            className={
              wait > 0 || resending
                ? "font-sans text-[14px] font-semibold text-muted"
                : "font-sans text-[14px] font-semibold text-brand"
            }
          >
            {resending ? "Sending…" : wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
