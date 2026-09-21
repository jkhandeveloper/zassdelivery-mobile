import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '../api-client'
import type {
  NotificationDto,
  UnreadCountDto,
  ListNotificationsQueryDto,
  DeviceDto,
  RegisterDeviceDto,
  UnregisterDeviceDto,
  TestPushDto,
  BroadcastDto,
  CreateBroadcastDto,
  UpdateBroadcastDto,
  BroadcastPreviewDto,
  SendResultDto,
  SendNotificationDto,
  ListBroadcastsQueryDto,
} from '@/types/notification'

export const notificationApi = {
  // Customer notifications
  getNotifications: (query?: ListNotificationsQueryDto) =>
    apiGetPaginated<NotificationDto>('/notifications', { params: query }),

  getUnreadCount: () =>
    apiGet<UnreadCountDto>('/notifications/unread-count'),

  markAllAsRead: () =>
    apiPost<{ message: string; updated: number }>('/notifications/read-all', {}),

  markAsRead: (id: string) =>
    apiPost<NotificationDto>(`/notifications/${id}/read`, {}),

  deleteReadNotifications: () =>
    apiDelete<{ message: string; deleted: number }>('/notifications/read'),

  deleteNotification: (id: string) =>
    apiDelete(`/notifications/${id}`),

  getNotificationPreferences: () =>
    apiGet('/notifications/preferences'),

  registerDevice: (data: RegisterDeviceDto) =>
    apiPost<DeviceDto>('/notifications/devices', data),

  getDevices: () =>
    apiGet<DeviceDto[]>('/notifications/devices'),

  unregisterDevice: (data: UnregisterDeviceDto) =>
    apiPost<{ message: string }>('/notifications/devices/unregister', data),

  deleteAllDevices: () =>
    apiDelete<{ message: string; devices: number }>('/notifications/devices'),

  testPush: (data?: TestPushDto) =>
    apiPost('/notifications/devices/test', data || {}),

  // Admin broadcast management
  createBroadcast: (data: CreateBroadcastDto) =>
    apiPost<BroadcastDto>('/notification-management/broadcasts', data),

  listBroadcasts: (query?: ListBroadcastsQueryDto) =>
    apiGetPaginated<BroadcastDto>('/notification-management/broadcasts', { params: query }),

  getBroadcast: (id: string) =>
    apiGet<BroadcastDto>(`/notification-management/broadcasts/${id}`),

  updateBroadcast: (id: string, data: UpdateBroadcastDto) =>
    apiPatch<BroadcastDto>(`/notification-management/broadcasts/${id}`, data),

  previewBroadcast: (id: string) =>
    apiGet<BroadcastPreviewDto>(`/notification-management/broadcasts/${id}/preview`),

  sendBroadcast: (id: string) =>
    apiPost<SendResultDto>(`/notification-management/broadcasts/${id}/send`, {}),

  cancelBroadcast: (id: string) =>
    apiPost<BroadcastDto>(`/notification-management/broadcasts/${id}/cancel`, {}),

  dispatchDueBroadcasts: () =>
    apiPost<{ sent: number }>('/notification-management/broadcasts/dispatch-due', {}),

  sendNotification: (data: SendNotificationDto) =>
    apiPost<SendResultDto>('/notification-management/notify', data),
}
