"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";

export const otpKeys = {
  config: () => ["auth", "otp", "config"] as const,
};

/**
 * Whether this deployment texts verification codes.
 *
 * Read before sign-up rather than assumed: verification is on only once the
 * API has an SMS sender, and a form that always asked for a code would lock
 * everybody out of a deployment that cannot send one.
 */
export function useOtpConfig() {
  return useQuery({
    queryKey: otpKeys.config(),
    queryFn: () => authApi.otpConfig(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSendOtp() {
  return useMutation({ mutationFn: authApi.sendOtp });
}
