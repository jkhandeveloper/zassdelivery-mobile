"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminApi } from "@/lib/api/admin";
import { orderApi } from "@/lib/api/orders";
import { paymentApi } from "@/lib/api/payments";
import { realtimeApi } from "@/lib/api/realtime";
import { restaurantApi } from "@/lib/api/restaurants";
import { riderApi } from "@/lib/api/riders";
import { supportApi } from "@/lib/api/support";
import { userApi } from "@/lib/api/users";
import type {
  CreateBannerDto,
  CreateCouponDto,
  LeaderboardQueryDto,
  ListBannersQueryDto,
  ListCouponsQueryDto,
  ReorderBannersDto,
  ReportWindowDto,
  UpdateBannerDto,
  UpdateCouponDto,
  UpsertSettingsDto,
} from "@/types/admin";
import type { ListOrdersAdminQueryDto } from "@/types/order";
import type {
  FailPaymentDto,
  LedgerSummaryQueryDto,
  ListPaymentsQueryDto,
  ListTransactionsQueryDto,
  ListWebhookEventsQueryDto,
} from "@/types/payment";
import type {
  AssignOrderDto,
  CancelAssignmentDto,
  ListAssignmentsQueryDto,
  ListPayoutsQueryDto,
  ListRidersQueryDto,
  RejectDocumentDto,
  RejectRiderDto,
  SuspendRiderDto,
} from "@/types/rider";
import type {
  ChangeRestaurantStatusDto,
  RejectRestaurantDto,
  UpdateRestaurantDto,
} from "@/types/restaurant";
import type {
  AssignTicketDto,
  ChangeTicketPriorityDto,
  ChangeTicketStatusDto,
  ListAuditLogsQueryDto,
  ListTicketsQueryDto,
} from "@/types/support";
import type {
  AdminUpdateUserDto,
  ChangeUserStatusDto,
  CreateUserDto,
  ListUsersQueryDto,
} from "@/types/user";

/**
 * Every admin screen's data access, in one place.
 *
 * The keys are namespaced per screen rather than per endpoint, because an
 * approval changes two lists at once: approving a restaurant empties a row from
 * the queue *and* decrements the dashboard's `actionsRequired`. Each mutation
 * below therefore invalidates the dashboard as well as its own list — a
 * to-do count that stays stale after the work is done is worse than no count.
 */
export const adminKeys = {
  all: ["admin"] as const,

  dashboard: () => [...adminKeys.all, "dashboard"] as const,
  presence: () => [...adminKeys.all, "presence"] as const,

  sales: (query: ReportWindowDto) => [...adminKeys.all, "reports", "sales", query] as const,
  leaderboard: (board: string, query: LeaderboardQueryDto) =>
    [...adminKeys.all, "reports", "leaderboard", board, query] as const,
  zones: (query: ReportWindowDto) => [...adminKeys.all, "reports", "zones", query] as const,
  couponReport: (query: ReportWindowDto) =>
    [...adminKeys.all, "reports", "coupons", query] as const,
  cancellations: (query: ReportWindowDto) =>
    [...adminKeys.all, "reports", "cancellations", query] as const,

  restaurants: (query: object) => [...adminKeys.all, "restaurants", query] as const,
  restaurant: (id: string) => [...adminKeys.all, "restaurant", id] as const,

  riders: (query: ListRidersQueryDto) => [...adminKeys.all, "riders", query] as const,
  rider: (id: string) => [...adminKeys.all, "rider", id] as const,
  riderDocuments: (id: string) => [...adminKeys.all, "rider", id, "documents"] as const,

  users: (query: ListUsersQueryDto) => [...adminKeys.all, "users", query] as const,
  user: (id: string) => [...adminKeys.all, "user", id] as const,

  assignments: (query: ListAssignmentsQueryDto) =>
    [...adminKeys.all, "assignments", query] as const,
  orders: (query: ListOrdersAdminQueryDto) => [...adminKeys.all, "orders", query] as const,

  payments: (query: ListPaymentsQueryDto) => [...adminKeys.all, "payments", query] as const,
  outstandingCash: (query: ListPaymentsQueryDto) =>
    [...adminKeys.all, "payments", "outstanding-cash", query] as const,
  transactions: (query: ListTransactionsQueryDto) =>
    [...adminKeys.all, "transactions", query] as const,
  ledger: (query: LedgerSummaryQueryDto) => [...adminKeys.all, "ledger", query] as const,
  webhooks: (query: ListWebhookEventsQueryDto) => [...adminKeys.all, "webhooks", query] as const,

  payouts: (query: ListPayoutsQueryDto) => [...adminKeys.all, "payouts", query] as const,

  coupons: (query: ListCouponsQueryDto) => [...adminKeys.all, "coupons", query] as const,
  banners: (query: ListBannersQueryDto) => [...adminKeys.all, "banners", query] as const,
  settings: (group: string | undefined) => [...adminKeys.all, "settings", group ?? "all"] as const,

  tickets: (query: ListTicketsQueryDto) => [...adminKeys.all, "tickets", query] as const,
  queueSummary: () => [...adminKeys.all, "tickets", "queue-summary"] as const,

  auditLogs: (query: ListAuditLogsQueryDto) => [...adminKeys.all, "audit-logs", query] as const,
  auditEntityTypes: () => [...adminKeys.all, "audit-logs", "entity-types"] as const,
  auditForEntity: (entityType: string, entityId: string) =>
    [...adminKeys.all, "audit-logs", entityType, entityId] as const,
};

/**
 * Invalidates a screen's own list plus the dashboard behind it.
 *
 * Shared by every mutation here so no screen can forget the second half — the
 * dashboard is a queue count, and a queue count that lags the queue is how an
 * operator ends up chasing work that is already done.
 */
function useAdminMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  invalidate: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidate) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
}

// ── Dashboard & reports ────────────────────────────────────────

/**
 * The whole dashboard in one request.
 *
 * Polled every 60s: the queue numbers are what tell an operator there is work,
 * and a to-do list only correct at page load is one that gets refreshed by
 * hand all day.
 */
export function useAdminDashboard(enabled = true) {
  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => adminApi.getDashboard(),
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: enabled ? 60 * 1000 : false,
  });
}

export function useRealtimePresence(enabled = true) {
  return useQuery({
    queryKey: adminKeys.presence(),
    queryFn: () => realtimeApi.getPresence(),
    enabled,
    staleTime: 15 * 1000,
    refetchInterval: enabled ? 30 * 1000 : false,
  });
}

export function useSalesReport(query?: ReportWindowDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.sales(query ?? {}),
    queryFn: () => adminApi.getSalesReport(query),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export type LeaderboardBoard = "restaurants" | "riders" | "customers";

export function useLeaderboard(
  board: LeaderboardBoard,
  query?: LeaderboardQueryDto,
  enabled = true,
) {
  return useQuery({
    queryKey: adminKeys.leaderboard(board, query ?? {}),
    queryFn: () =>
      board === "restaurants"
        ? adminApi.getRestaurantLeaderboard(query)
        : board === "riders"
          ? adminApi.getRiderLeaderboard(query)
          : adminApi.getCustomerLeaderboard(query),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useZoneReport(query?: ReportWindowDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.zones(query ?? {}),
    queryFn: () => adminApi.getZoneReport(query),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCouponReport(query?: ReportWindowDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.couponReport(query ?? {}),
    queryFn: () => adminApi.getCouponReport(query),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCancellationReport(query?: ReportWindowDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.cancellations(query ?? {}),
    queryFn: () => adminApi.getCancellationReport(query),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Restaurants ────────────────────────────────────────────────

type RestaurantsAdminQuery = Parameters<typeof restaurantApi.listRestaurantsAdmin>[0];

export function useAdminRestaurants(query?: RestaurantsAdminQuery, enabled = true) {
  return useQuery({
    queryKey: adminKeys.restaurants(query ?? {}),
    queryFn: () => restaurantApi.listRestaurantsAdmin(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useApproveRestaurant() {
  return useAdminMutation((id: string) => restaurantApi.approveRestaurant(id), [
    [...adminKeys.all, "restaurants"],
  ]);
}

export function useRejectRestaurant() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: RejectRestaurantDto }) =>
      restaurantApi.rejectRestaurant(id, data),
    [[...adminKeys.all, "restaurants"]],
  );
}

export function useChangeRestaurantStatus() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: ChangeRestaurantStatusDto }) =>
      restaurantApi.changeRestaurantStatus(id, data),
    [[...adminKeys.all, "restaurants"]],
  );
}

export function useUpdateRestaurantAdmin() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: UpdateRestaurantDto }) =>
      restaurantApi.updateRestaurant(id, data),
    [[...adminKeys.all, "restaurants"]],
  );
}

// ── Riders ─────────────────────────────────────────────────────

export function useAdminRiders(query?: ListRidersQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.riders(query ?? {}),
    queryFn: () => riderApi.listRiders(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useAdminRiderDocuments(riderId: string | null) {
  return useQuery({
    queryKey: adminKeys.riderDocuments(riderId ?? ""),
    queryFn: () => riderApi.getRiderDocumentsAdmin(riderId as string),
    enabled: riderId !== null,
    staleTime: 60 * 1000,
  });
}

/** Rider mutations all touch the same two lists, so they share the key set. */
const RIDER_KEYS = [[...adminKeys.all, "riders"], [...adminKeys.all, "rider"]] as const;

export function useApproveRider() {
  return useAdminMutation((id: string) => riderApi.approveRider(id), RIDER_KEYS);
}

export function useRejectRider() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: RejectRiderDto }) => riderApi.rejectRider(id, data),
    RIDER_KEYS,
  );
}

export function useSuspendRider() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: SuspendRiderDto }) => riderApi.suspendRider(id, data),
    RIDER_KEYS,
  );
}

export function useReinstateRider() {
  return useAdminMutation((id: string) => riderApi.reinstateRider(id), RIDER_KEYS);
}

export function useVerifyRiderDocument() {
  return useAdminMutation((documentId: string) => riderApi.verifyDocument(documentId), RIDER_KEYS);
}

export function useRejectRiderDocument() {
  return useAdminMutation(
    ({ documentId, data }: { documentId: string; data: RejectDocumentDto }) =>
      riderApi.rejectDocument(documentId, data),
    RIDER_KEYS,
  );
}

// ── Users ──────────────────────────────────────────────────────

export function useAdminUsers(query?: ListUsersQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.users(query ?? {}),
    queryFn: () => userApi.listUsers(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

const USER_KEYS = [[...adminKeys.all, "users"], [...adminKeys.all, "user"]] as const;

export function useCreateUser() {
  return useAdminMutation((data: CreateUserDto) => userApi.createUser(data), USER_KEYS);
}

export function useUpdateUserAdmin() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: AdminUpdateUserDto }) => userApi.updateUser(id, data),
    USER_KEYS,
  );
}

export function useChangeUserStatus() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: ChangeUserStatusDto }) =>
      userApi.changeUserStatus(id, data),
    USER_KEYS,
  );
}

export function useDeleteUser() {
  return useAdminMutation((id: string) => userApi.deleteUser(id), USER_KEYS);
}

export function useRestoreUser() {
  return useAdminMutation((id: string) => userApi.restoreUser(id), USER_KEYS);
}

// ── Dispatch ───────────────────────────────────────────────────

/**
 * Live delivery assignments.
 *
 * Polled hard (15s) because offers lapse on a server-side timer: a dispatcher
 * looking at an expired offer will wait for an answer that can never come.
 */
export function useAdminAssignments(query?: ListAssignmentsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.assignments(query ?? {}),
    queryFn: () => riderApi.listAssignments(query),
    enabled,
    staleTime: 5 * 1000,
    refetchInterval: enabled ? 15 * 1000 : false,
  });
}

export function useAdminOrders(query?: ListOrdersAdminQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.orders(query ?? {}),
    queryFn: () => orderApi.listOrdersAdmin(query),
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: enabled ? 20 * 1000 : false,
  });
}

const DISPATCH_KEYS = [
  [...adminKeys.all, "assignments"],
  [...adminKeys.all, "orders"],
] as const;

export function useAssignOrder() {
  return useAdminMutation(
    ({ orderId, data }: { orderId: string; data: AssignOrderDto }) =>
      riderApi.assignOrder(orderId, data),
    DISPATCH_KEYS,
  );
}

export function useCancelAssignment() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: CancelAssignmentDto }) =>
      riderApi.cancelAssignment(id, data),
    DISPATCH_KEYS,
  );
}

export function useExpireAssignments() {
  return useAdminMutation(() => riderApi.expireAssignments(), DISPATCH_KEYS);
}

// ── Payments ───────────────────────────────────────────────────

export function useAdminPayments(query?: ListPaymentsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.payments(query ?? {}),
    queryFn: () => paymentApi.listPaymentsAdmin(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useOutstandingCash(query?: ListPaymentsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.outstandingCash(query ?? {}),
    queryFn: () => paymentApi.getOutstandingCash(query),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useAdminTransactions(query?: ListTransactionsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.transactions(query ?? {}),
    queryFn: () => paymentApi.listTransactionsAdmin(query),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useLedgerSummary(query?: LedgerSummaryQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.ledger(query ?? {}),
    queryFn: () => paymentApi.getLedgerSummary(query),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useWebhookEvents(query?: ListWebhookEventsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.webhooks(query ?? {}),
    queryFn: () => paymentApi.listWebhookEvents(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

const PAYMENT_KEYS = [
  [...adminKeys.all, "payments"],
  [...adminKeys.all, "transactions"],
  [...adminKeys.all, "ledger"],
  [...adminKeys.all, "webhooks"],
] as const;

export function useMarkCashCollected() {
  return useAdminMutation((id: string) => paymentApi.markCollected(id), PAYMENT_KEYS);
}

export function useFailPayment() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: FailPaymentDto }) => paymentApi.failPayment(id, data),
    PAYMENT_KEYS,
  );
}

export function useReplayWebhook() {
  return useAdminMutation((id: string) => paymentApi.replayWebhook(id), PAYMENT_KEYS);
}

// ── Rider payouts ──────────────────────────────────────────────

export function useAdminPayouts(query?: ListPayoutsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.payouts(query ?? {}),
    queryFn: () => riderApi.listWithdrawals(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

const PAYOUT_KEYS = [[...adminKeys.all, "payouts"]] as const;

export function useApprovePayout() {
  return useAdminMutation((id: string) => riderApi.approveWithdrawal(id), PAYOUT_KEYS);
}

export function useMarkPayoutPaid() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: { paymentReference?: string } }) =>
      riderApi.markWithdrawalPaid(id, data),
    PAYOUT_KEYS,
  );
}

export function useRejectPayout() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: { reason: string } }) =>
      riderApi.rejectWithdrawal(id, data),
    PAYOUT_KEYS,
  );
}

// ── Coupons ────────────────────────────────────────────────────

export function useAdminCoupons(query?: ListCouponsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.coupons(query ?? {}),
    queryFn: () => adminApi.listCoupons(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

const COUPON_KEYS = [[...adminKeys.all, "coupons"]] as const;

export function useCreateCoupon() {
  return useAdminMutation((data: CreateCouponDto) => adminApi.createCoupon(data), COUPON_KEYS);
}

export function useUpdateCoupon() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: UpdateCouponDto }) => adminApi.updateCoupon(id, data),
    COUPON_KEYS,
  );
}

/** One hook for both directions — the screen has a single toggle, not two buttons. */
export function useSetCouponActive() {
  return useAdminMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive ? adminApi.activateCoupon(id) : adminApi.deactivateCoupon(id),
    COUPON_KEYS,
  );
}

export function useDeleteCoupon() {
  return useAdminMutation((id: string) => adminApi.deleteCoupon(id), COUPON_KEYS);
}

// ── Banners ────────────────────────────────────────────────────

export function useAdminBanners(query?: ListBannersQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.banners(query ?? {}),
    queryFn: () => adminApi.listBanners(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

const BANNER_KEYS = [[...adminKeys.all, "banners"]] as const;

export function useCreateBanner() {
  return useAdminMutation((data: CreateBannerDto) => adminApi.createBanner(data), BANNER_KEYS);
}

export function useUpdateBanner() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: UpdateBannerDto }) => adminApi.updateBanner(id, data),
    BANNER_KEYS,
  );
}

export function useReorderBanners() {
  return useAdminMutation((data: ReorderBannersDto) => adminApi.reorderBanners(data), BANNER_KEYS);
}

export function useDeleteBanner() {
  return useAdminMutation((id: string) => adminApi.deleteBanner(id), BANNER_KEYS);
}

// ── Settings ───────────────────────────────────────────────────

export function useAdminSettings(group?: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.settings(group),
    queryFn: () => adminApi.getSettings(group === undefined ? undefined : { group }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertSettingsDto) => adminApi.upsertSettings(data),
    onSuccess: () => {
      // Every group, not just the one edited: the write is all-or-nothing and
      // may touch keys filed under several groups.
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "settings"] });
    },
  });
}

// ── Support queue ──────────────────────────────────────────────

/**
 * The whole ticket queue.
 *
 * `GET /support-tickets` is scoped by the API — staff see everything, everyone
 * else only their own — so this is the same endpoint the customer support page
 * uses, seen through an admin's token.
 */
export function useAdminTickets(query?: ListTicketsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.tickets(query ?? {}),
    queryFn: () => supportApi.listTickets(query),
    enabled,
    staleTime: 20 * 1000,
    refetchInterval: enabled ? 60 * 1000 : false,
  });
}

export function useTicketQueueSummary(enabled = true) {
  return useQuery({
    queryKey: adminKeys.queueSummary(),
    queryFn: () => supportApi.getQueueSummary(),
    enabled,
    staleTime: 20 * 1000,
    refetchInterval: enabled ? 60 * 1000 : false,
  });
}

const TICKET_KEYS = [
  [...adminKeys.all, "tickets"],
  [...adminKeys.all, "tickets", "queue-summary"],
] as const;

export function useChangeTicketStatus() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: ChangeTicketStatusDto }) =>
      supportApi.changeTicketStatus(id, data),
    TICKET_KEYS,
  );
}

export function useAssignTicket() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: AssignTicketDto }) => supportApi.assignTicket(id, data),
    TICKET_KEYS,
  );
}

export function useChangeTicketPriority() {
  return useAdminMutation(
    ({ id, data }: { id: string; data: ChangeTicketPriorityDto }) =>
      supportApi.changeTicketPriority(id, data),
    TICKET_KEYS,
  );
}

// ── Audit log ──────────────────────────────────────────────────

export function useAuditLogs(query?: ListAuditLogsQueryDto, enabled = true) {
  return useQuery({
    queryKey: adminKeys.auditLogs(query ?? {}),
    queryFn: () => supportApi.listAuditLogs(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

/** The filter's options, built from what the log actually contains. */
export function useAuditEntityTypes(enabled = true) {
  return useQuery({
    queryKey: adminKeys.auditEntityTypes(),
    queryFn: () => supportApi.getEntityTypes(),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useEntityAuditTrail(entityType: string | null, entityId: string | null) {
  return useQuery({
    queryKey: adminKeys.auditForEntity(entityType ?? "", entityId ?? ""),
    queryFn: () => supportApi.getEntityAuditLogs(entityType as string, entityId as string),
    enabled: entityType !== null && entityId !== null,
    staleTime: 60 * 1000,
  });
}
