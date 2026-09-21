import type { BannerPlacement, CouponType, SettingValueType } from './enums'

/**
 * Admin dashboard, reporting, coupons, banners and settings — transcribed from
 * the backend's `admin-response.dto.ts` and `admin.dto.ts`.
 *
 * Read from the source rather than from the endpoint list: the dashboard's
 * `actionsRequired` is a single number (the queues added up), not an object;
 * the report endpoints return bare arrays rather than paginated envelopes; and
 * a setting is keyed by `key` with no `id`, carrying both the raw `value` and
 * the `typedValue` the API has already coerced.
 */

// ── Dashboard ──────────────────────────────────────────────────

export interface DashboardDto {
  totals: DashboardTotalsDto
  /** The part that is actually a to-do list: every number has a screen behind it. */
  queues: DashboardQueuesDto
  operations: DashboardOperationsDto
  /** The last 14 days. */
  trend: TimeSeriesPointDto[]
  /** Everything in the queues, added up. */
  actionsRequired: number
  generatedAt: string
}

export interface DashboardTotalsDto {
  customers: number
  riders: number
  restaurants: number
  ordersToday: number
  /** Orders somewhere between placed and delivered. */
  ordersInFlight: number
  revenueToday: number
  revenueThisMonth: number
  averageOrderValue: number
}

export interface DashboardQueuesDto {
  restaurantsAwaitingApproval: number
  ridersAwaitingApproval: number
  /** Placed, not yet accepted by the kitchen. */
  ordersAwaitingRestaurant: number
  /** Cooking or cooked with nobody to carry them — the cold-delivery number. */
  ordersAwaitingRider: number
  openTickets: number
  pendingWithdrawals: number
  /** Gateway callbacks stored but not applied. */
  unresolvedWebhooks: number
}

export interface DashboardOperationsDto {
  ridersOnline: number
  ridersOnDelivery: number
  restaurantsAcceptingOrders: number
  /** Approved but paused or outside their hours. */
  restaurantsClosed: number
}

export interface TimeSeriesPointDto {
  /** "2026-08-10" — a calendar day, not an instant. */
  date: string
  orders: number
  revenue: number
}

// ── Reports ────────────────────────────────────────────────────

export interface BreakdownRowDto {
  label: string
  count: number
  /** Absent on breakdowns that only count, e.g. by status. */
  amount?: number
}

export interface SalesReportDto {
  from: string
  to: string
  orders: number
  /** Orders that were paid for, or will be — cancellations excluded. */
  revenue: number
  commission: number
  deliveryFees: number
  discounts: number
  averageOrderValue: number
  daily: TimeSeriesPointDto[]
  byPaymentMethod: BreakdownRowDto[]
  byStatus: BreakdownRowDto[]
}

/** One row of any leaderboard. On the rider board, `revenue` is what they earned. */
export interface LeaderboardRowDto {
  id: string
  name: string
  orders: number
  revenue: number
  rating: number | null
}

export interface ZoneReportRowDto {
  zoneId: string
  zoneName: string
  orders: number
  revenue: number
  averageOrderValue: number
}

export interface CouponReportRowDto {
  couponId: string
  code: string
  redemptions: number
  /** What the discount actually cost. */
  discount: number
}

/**
 * Cancellations split by who decided.
 *
 * A customer changing their mind and a kitchen rejecting orders it cannot cook
 * are the same bar on a chart and entirely different problems, so the API keeps
 * `cancelledBy` separate rather than collapsing both into one reason.
 */
export interface CancellationReportRowDto {
  status: string
  cancelledBy: string | null
  count: number
}

export interface ReportWindowDto {
  from?: string
  to?: string
}

export interface LeaderboardQueryDto extends ReportWindowDto {
  limit?: number
}

// ── Coupons ────────────────────────────────────────────────────

export interface CouponDto {
  id: string
  code: string
  type: CouponType
  value: number
  /** Caps a percentage discount. Null when the type does not cap. */
  maxDiscountAmount: number | null
  minOrderAmount: number
  description: string | null
  startsAt: string
  expiresAt: string
  usageLimit: number | null
  usageCount: number
  perUserLimit: number | null
  restaurantId: string | null
  zoneId: string | null
  firstOrderOnly: boolean
  isActive: boolean
  /** Active, inside its window *and* not exhausted — what decides usability now. */
  isLive: boolean
  /** Null when usageLimit is null, i.e. unlimited. */
  remainingUses: number | null
  createdAt: string
}

export interface CreateCouponDto {
  code: string
  type: CouponType
  value: number
  maxDiscountAmount?: number
  minOrderAmount?: number
  description?: string
  startsAt: string
  expiresAt: string
  usageLimit?: number
  perUserLimit?: number
  restaurantId?: string
  zoneId?: string
  firstOrderOnly?: boolean
  isActive?: boolean
}

export type UpdateCouponDto = Partial<CreateCouponDto>

export interface ListCouponsQueryDto {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'expiresAt' | 'usageCount' | 'value'
  sortOrder?: 'asc' | 'desc'
  search?: string
  type?: CouponType
  isActive?: boolean
  liveOnly?: boolean
  restaurantId?: string
}

// ── Banners ────────────────────────────────────────────────────

export interface BannerDto {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  placement: BannerPlacement
  restaurantId: string | null
  linkUrl: string | null
  cityId: string | null
  /** Lower sorts first. */
  sortOrder: number
  startsAt: string | null
  endsAt: string | null
  isActive: boolean
  /** Active *and* inside its display window. */
  isLive: boolean
  createdAt: string
}

export interface CreateBannerDto {
  title: string
  subtitle?: string
  imageUrl: string
  placement: BannerPlacement
  restaurantId?: string
  linkUrl?: string
  cityId?: string
  sortOrder?: number
  startsAt?: string
  endsAt?: string
  isActive?: boolean
}

export type UpdateBannerDto = Partial<CreateBannerDto>

export interface ListBannersQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  placement?: BannerPlacement
  cityId?: string
  isActive?: boolean
}

export interface ReorderBannersDto {
  banners: Array<{ id: string; sortOrder: number }>
}

// ── Settings ───────────────────────────────────────────────────

export interface SettingDto {
  /** "group.name", lower-case with underscores. The primary key. */
  key: string
  /** The value as stored — always a string, whatever the declared type. */
  value: string
  valueType: SettingValueType
  /** The value coerced to its declared type — what a client should read. */
  typedValue: unknown
  group: string
  description: string | null
  /** Public settings are readable by client apps; private ones never leave the API. */
  isPublic: boolean
  updatedAt: string
}

export interface SettingGroupDto {
  group: string
  settings: SettingDto[]
}

export interface UpsertSettingDto {
  key: string
  value: string
  valueType?: SettingValueType
  group?: string
  description?: string
  isPublic?: boolean
}

/** Applied together or not at all. */
export interface UpsertSettingsDto {
  settings: UpsertSettingDto[]
}
