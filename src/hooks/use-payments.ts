import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { paymentApi } from "@/lib/api/payments";
import { PaymentStatus } from "@/types/enums";
import type { MarkPaymentReceivedDto, StartCheckoutDto } from "@/types/payment";

import { orderKeys } from "./use-orders";
import { riderKeys } from "./use-riders";
import { vendorKeys } from "./use-vendor";

export const paymentKeys = {
  all: ["payments"] as const,
  methods: (restaurantId: string | null) =>
    [...paymentKeys.all, "methods", restaurantId ?? ""] as const,
  orderQr: (orderId: string) => [...paymentKeys.all, "order-qr", orderId] as const,
};

/**
 * Which gateways are live right now. The list is server-driven — an option the
 * API reports as unavailable must not be offered at checkout. Scan-to-pay
 * depends on the restaurant, so the list is asked for per restaurant.
 */
export function usePaymentMethods(restaurantId: string | null, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.methods(restaurantId),
    queryFn: () => paymentApi.getPaymentMethods(restaurantId ?? undefined),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: StartCheckoutDto }) =>
      paymentApi.startCheckout(orderId, data),
  });
}

/**
 * The codes that pay for one order, and whether they have been used.
 *
 * Polled while the payment is pending: nothing pushes the moment a restaurant
 * or rider confirms the transfer, and that moment is exactly what the customer
 * on this screen is waiting for.
 */
export function useOrderPaymentQr(orderId: string, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.orderQr(orderId),
    queryFn: () => paymentApi.getOrderPaymentQr(orderId),
    enabled,
    staleTime: 5 * 1000,
    refetchInterval: (query) =>
      query.state.data?.paymentStatus === PaymentStatus.PENDING ? 15 * 1000 : false,
  });
}

export function useMarkPaymentReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: MarkPaymentReceivedDto }) =>
      paymentApi.markPaymentReceived(orderId, data),
    onSuccess: (_payment, { orderId }) => {
      // The kitchen ticket and the rider's run both show the payment state.
      void queryClient.invalidateQueries({ queryKey: [...vendorKeys.all, "orders"] });
      void queryClient.invalidateQueries({ queryKey: riderKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
}
