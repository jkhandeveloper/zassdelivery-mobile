"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { riderApi } from "@/lib/api/riders";
import type { SetPaymentQrCodesDto } from "@/types/payment";
import type {
  ConfirmDeliveryDto,
  ListAssignmentsQueryDto,
  ListEarningsQueryDto,
  ListSettlementQueryDto,
  RecordCashReceivedDto,
  RecordFeesReceivedDto,
  RegisterRiderDto,
  RejectOfferDto,
  SetAvailabilityDto,
  UpdateRiderDto,
  UploadDocumentDto,
} from "@/types/rider";

export const riderKeys = {
  all: ["riders"] as const,
  profile: () => [...riderKeys.all, "profile"] as const,
  documents: () => [...riderKeys.all, "documents"] as const,
  offers: (query: ListAssignmentsQueryDto) => [...riderKeys.all, "offers", query] as const,
  deliveries: (query: ListAssignmentsQueryDto) =>
    [...riderKeys.all, "deliveries", query] as const,
  delivery: (orderId: string) => [...riderKeys.all, "delivery", orderId] as const,
  earnings: (query: ListEarningsQueryDto) => [...riderKeys.all, "earnings", query] as const,
  earningsSummary: () => [...riderKeys.all, "earnings", "summary"] as const,
  settlements: () => [...riderKeys.all, "settlements"] as const,
  settlementEntries: (query: ListSettlementQueryDto) =>
    [...riderKeys.all, "settlements", "entries", query] as const,
  settlementPayments: (query: ListSettlementQueryDto) =>
    [...riderKeys.all, "settlements", "payments", query] as const,
  restaurantSettlements: (restaurantId: string) =>
    ["restaurant-rider-settlements", restaurantId] as const,
  restaurantSettlementEntries: (restaurantId: string, query: ListSettlementQueryDto) =>
    ["restaurant-rider-settlements", restaurantId, "entries", query] as const,
  restaurantSettlementPayments: (restaurantId: string, query: ListSettlementQueryDto) =>
    ["restaurant-rider-settlements", restaurantId, "payments", query] as const,
};

/**
 * The rider's own record.
 *
 * A 404 here means "signed in as a rider, but never completed the rider
 * application" — a real state with its own screen, not an error, so it is not
 * retried into a spinner.
 */
export function useRiderProfile(enabled = true) {
  return useQuery({
    queryKey: riderKeys.profile(),
    queryFn: () => riderApi.getRiderProfile(),
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  });
}

export function useRegisterRider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterRiderDto) => riderApi.registerRider(data),
    onSuccess: (rider) => {
      queryClient.setQueryData(riderKeys.profile(), rider);
    },
  });
}

export function useUpdateRiderProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRiderDto) => riderApi.updateRiderProfile(data),
    onSuccess: (rider) => queryClient.setQueryData(riderKeys.profile(), rider),
  });
}

export function useSetRiderQrCodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetPaymentQrCodesDto) => riderApi.setPaymentQrCodes(data),
    onSuccess: (rider) => queryClient.setQueryData(riderKeys.profile(), rider),
  });
}

export function useResubmitRiderApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => riderApi.resubmitRiderApproval(),
    onSuccess: (rider) => queryClient.setQueryData(riderKeys.profile(), rider),
  });
}

export function useRiderDocuments(enabled = true) {
  return useQuery({
    queryKey: riderKeys.documents(),
    queryFn: () => riderApi.getRiderDocuments(),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useUploadRiderDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UploadDocumentDto) => riderApi.uploadDocument(data),
    onSuccess: () => {
      // The upload changes `missingDocuments` on the profile as well as the
      // document list, and approval is gated on it — so both are refetched.
      void queryClient.invalidateQueries({ queryKey: riderKeys.documents() });
      void queryClient.invalidateQueries({ queryKey: riderKeys.profile() });
    },
  });
}

export function useSetAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetAvailabilityDto) => riderApi.setAvailability(data),
    onSuccess: (rider) => {
      queryClient.setQueryData(riderKeys.profile(), rider);
      // Going online is what makes offers start arriving.
      void queryClient.invalidateQueries({ queryKey: [...riderKeys.all, "offers"] });
    },
  });
}

export function useUpdateRiderLocation() {
  return useMutation({
    mutationFn: (data: { latitude: number; longitude: number }) => riderApi.updateLocation(data),
  });
}

/**
 * The offers inbox.
 *
 * Offers expire on a server-side timer, so this polls as a floor under the
 * socket rather than trusting `delivery:offered` alone — a dropped connection
 * would otherwise leave a rider staring at a run that lapsed minutes ago.
 */
export function useRiderOffers(query?: ListAssignmentsQueryDto, enabled = true) {
  return useQuery({
    queryKey: riderKeys.offers(query ?? {}),
    queryFn: () => riderApi.getOffers(query),
    enabled,
    staleTime: 5 * 1000,
    refetchInterval: enabled ? 20 * 1000 : false,
  });
}

export function useAcceptOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => riderApi.acceptOffer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
  });
}

export function useRejectOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectOfferDto }) =>
      riderApi.rejectOffer(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...riderKeys.all, "offers"] });
    },
  });
}

export function useRiderDeliveries(query?: ListAssignmentsQueryDto, enabled = true) {
  return useQuery({
    queryKey: riderKeys.deliveries(query ?? {}),
    queryFn: () => riderApi.getDeliveries(query),
    enabled,
    staleTime: 15 * 1000,
  });
}

export function useRiderDelivery(orderId: string | null) {
  return useQuery({
    queryKey: riderKeys.delivery(orderId ?? ""),
    queryFn: () => riderApi.getDelivery(orderId as string),
    enabled: orderId !== null,
    staleTime: 10 * 1000,
  });
}

/** Every step of a run invalidates the same set, so they share one helper. */
function useDeliveryStep<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
  });
}

export function useIssueDeliveryCode() {
  return useDeliveryStep((orderId: string) => riderApi.issueDeliveryCode(orderId));
}

export function useMarkOnTheWay() {
  return useDeliveryStep((orderId: string) => riderApi.markOnTheWay(orderId));
}

export function useConfirmDelivery() {
  return useDeliveryStep(({ orderId, data }: { orderId: string; data: ConfirmDeliveryDto }) =>
    riderApi.confirmDelivery(orderId, data),
  );
}

export function useRiderEarnings(query?: ListEarningsQueryDto, enabled = true) {
  return useQuery({
    queryKey: riderKeys.earnings(query ?? {}),
    queryFn: () => riderApi.getEarnings(query),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useEarningsSummary(enabled = true) {
  return useQuery({
    queryKey: riderKeys.earningsSummary(),
    queryFn: () => riderApi.getEarningsSummary(),
    enabled,
    staleTime: 60 * 1000,
  });
}

// ── Settlement with restaurants (rider side) ──────────────────

export function useRiderSettlements(enabled = true) {
  return useQuery({
    queryKey: riderKeys.settlements(),
    queryFn: () => riderApi.getSettlementBalances(),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useRiderSettlementEntries(query: ListSettlementQueryDto, enabled = true) {
  return useQuery({
    queryKey: riderKeys.settlementEntries(query),
    queryFn: () => riderApi.getSettlementEntries(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useRiderSettlementPayments(query: ListSettlementQueryDto, enabled = true) {
  return useQuery({
    queryKey: riderKeys.settlementPayments(query),
    queryFn: () => riderApi.getSettlementPayments(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useRecordFeesReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordFeesReceivedDto) => riderApi.recordFeesReceived(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riderKeys.settlements() });
    },
  });
}

// ── Settlement with riders (restaurant side) ──────────────────

export function useRestaurantRiderSettlements(restaurantId: string | undefined) {
  return useQuery({
    queryKey: riderKeys.restaurantSettlements(restaurantId ?? ""),
    queryFn: () => riderApi.getRestaurantRiderBalances(restaurantId ?? ""),
    enabled: restaurantId !== undefined,
    staleTime: 30 * 1000,
  });
}

export function useRestaurantRiderEntries(
  restaurantId: string | undefined,
  query: ListSettlementQueryDto,
) {
  return useQuery({
    queryKey: riderKeys.restaurantSettlementEntries(restaurantId ?? "", query),
    queryFn: () => riderApi.getRestaurantRiderEntries(restaurantId ?? "", query),
    enabled: restaurantId !== undefined,
    staleTime: 30 * 1000,
  });
}

export function useRestaurantRiderPayments(
  restaurantId: string | undefined,
  query: ListSettlementQueryDto,
) {
  return useQuery({
    queryKey: riderKeys.restaurantSettlementPayments(restaurantId ?? "", query),
    queryFn: () => riderApi.getRestaurantRiderPayments(restaurantId ?? "", query),
    enabled: restaurantId !== undefined,
    staleTime: 30 * 1000,
  });
}

export function useRecordCashReceived(restaurantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordCashReceivedDto) => riderApi.recordCashReceived(restaurantId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: riderKeys.restaurantSettlements(restaurantId),
      });
    },
  });
}
