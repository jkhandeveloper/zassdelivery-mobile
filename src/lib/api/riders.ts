import { apiGet, apiGetPaginated, apiPatch, apiPost, apiPut } from '../api-client'
import type {
  RiderDto,
  RegisterRiderDto,
  UpdateRiderDto,
  RiderDocumentDto,
  RiderWalletDto,
  UploadDocumentDto,
  SetAvailabilityDto,
  UpdateLocationDto,
  AssignmentDto,
  ListAssignmentsQueryDto,
  RejectOfferDto,
  DeliveryCodeIssuedDto,
  ConfirmDeliveryDto,
  DeliveryCompletedDto,
  EarningDto,
  ListEarningsQueryDto,
  EarningsSummaryDto,
  WalletTransactionDto,
  RequestPayoutDto,
  PayoutRequestDto,
  ListPayoutsQueryDto,
  ListRidersQueryDto,
  RejectRiderDto,
  SuspendRiderDto,
  AssignOrderDto,
  CancelAssignmentDto,
  RejectDocumentDto,
} from '@/types/rider'
import type { SetPaymentQrCodesDto } from '@/types/payment'

export const riderApi = {
  // Rider self-service
  registerRider: (data: RegisterRiderDto) =>
    apiPost<RiderDto>('/riders/register', data),

  getRiderProfile: () => apiGet<RiderDto>('/riders/me'),

  updateRiderProfile: (data: UpdateRiderDto) =>
    apiPatch<RiderDto>('/riders/me', data),

  /** Replaces the whole list; `[]` removes them. */
  setPaymentQrCodes: (data: SetPaymentQrCodesDto) =>
    apiPut<RiderDto>('/riders/me/payment-qr-codes', data),

  resubmitRiderApproval: () =>
    apiPost<RiderDto>('/riders/me/resubmit', {}),

  getRiderDocuments: () =>
    apiGet<RiderDocumentDto[]>('/riders/me/documents'),

  uploadDocument: (data: UploadDocumentDto) =>
    apiPut<RiderDocumentDto>('/riders/me/documents', data),

  setAvailability: (data: SetAvailabilityDto) =>
    apiPatch<RiderDto>('/riders/me/availability', data),

  updateLocation: (data: UpdateLocationDto) =>
    apiPut<void>('/riders/me/location', data),

  getOffers: (query?: ListAssignmentsQueryDto) =>
    apiGetPaginated<AssignmentDto>('/riders/me/offers', { params: query }),

  acceptOffer: (id: string) =>
    apiPost<AssignmentDto>(`/riders/me/offers/${id}/accept`, {}),

  rejectOffer: (id: string, data: RejectOfferDto) =>
    apiPost<AssignmentDto>(`/riders/me/offers/${id}/reject`, data),

  getDelivery: (orderId: string) =>
    apiGet<AssignmentDto>(`/riders/me/deliveries/${orderId}`),

  issueDeliveryCode: (orderId: string) =>
    apiPost<DeliveryCodeIssuedDto>(`/riders/me/deliveries/${orderId}/pickup`, {}),

  markOnTheWay: (orderId: string) =>
    apiPost<{ message: string }>(`/riders/me/deliveries/${orderId}/on-the-way`, {}),

  confirmDelivery: (orderId: string, data: ConfirmDeliveryDto) =>
    apiPost<DeliveryCompletedDto>(`/riders/me/deliveries/${orderId}/confirm`, data),

  getDeliveries: (query?: ListAssignmentsQueryDto) =>
    apiGetPaginated<AssignmentDto>('/riders/me/deliveries', { params: query }),

  getEarnings: (query?: ListEarningsQueryDto) =>
    apiGetPaginated<EarningDto>('/riders/me/earnings', { params: query }),

  getEarningsSummary: () =>
    apiGet<EarningsSummaryDto>('/riders/me/earnings/summary'),

  getWallet: () => apiGet<RiderWalletDto>('/riders/me/wallet'),

  getWalletTransactions: (query?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) =>
    apiGetPaginated<WalletTransactionDto>('/riders/me/wallet/transactions', { params: query }),

  requestWithdrawal: (data: RequestPayoutDto) =>
    apiPost<PayoutRequestDto>('/riders/me/withdrawals', data),

  getWithdrawals: (query?: ListPayoutsQueryDto) =>
    apiGetPaginated<PayoutRequestDto>('/riders/me/withdrawals', { params: query }),

  cancelWithdrawal: (id: string) =>
    apiPost<PayoutRequestDto>(`/riders/me/withdrawals/${id}/cancel`, {}),

  // Rider management
  listRiders: (query?: ListRidersQueryDto) =>
    apiGetPaginated<RiderDto>('/rider-management/riders', { params: query }),

  getRider: (id: string) => apiGet<RiderDto>(`/rider-management/riders/${id}`),

  approveRider: (id: string) =>
    apiPost<RiderDto>(`/rider-management/riders/${id}/approve`, {}),

  rejectRider: (id: string, data: RejectRiderDto) =>
    apiPost<RiderDto>(`/rider-management/riders/${id}/reject`, data),

  suspendRider: (id: string, data: SuspendRiderDto) =>
    apiPost<RiderDto>(`/rider-management/riders/${id}/suspend`, data),

  reinstateRider: (id: string) =>
    apiPost<RiderDto>(`/rider-management/riders/${id}/reinstate`, {}),

  getRiderDocumentsAdmin: (id: string) =>
    apiGet<RiderDocumentDto[]>(`/rider-management/riders/${id}/documents`),

  verifyDocument: (documentId: string) =>
    apiPost<RiderDocumentDto>(`/rider-management/documents/${documentId}/verify`, {}),

  rejectDocument: (documentId: string, data: RejectDocumentDto) =>
    apiPost<RiderDocumentDto>(`/rider-management/documents/${documentId}/reject`, data),

  assignOrder: (orderId: string, data: AssignOrderDto) =>
    apiPost<AssignmentDto>(`/rider-management/orders/${orderId}/assign`, data),

  listAssignments: (query?: ListAssignmentsQueryDto) =>
    apiGetPaginated<AssignmentDto>('/rider-management/assignments', { params: query }),

  getRiderAssignments: (id: string) =>
    apiGet<AssignmentDto[]>(`/rider-management/riders/${id}/assignments`),

  cancelAssignment: (id: string, data: CancelAssignmentDto) =>
    apiPost<AssignmentDto>(`/rider-management/assignments/${id}/cancel`, data),

  expireAssignments: () =>
    apiPost<{ expired: number }>('/rider-management/assignments/expire', {}),

  listWithdrawals: (query?: ListPayoutsQueryDto) =>
    apiGetPaginated<PayoutRequestDto>('/rider-management/withdrawals', { params: query }),

  approveWithdrawal: (id: string) =>
    apiPost<PayoutRequestDto>(`/rider-management/withdrawals/${id}/approve`, {}),

  markWithdrawalPaid: (id: string, data: { paymentReference?: string }) =>
    apiPost<PayoutRequestDto>(`/rider-management/withdrawals/${id}/paid`, data),

  rejectWithdrawal: (id: string, data: { reason: string }) =>
    apiPost<PayoutRequestDto>(`/rider-management/withdrawals/${id}/reject`, data),
}
