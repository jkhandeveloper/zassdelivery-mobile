import { NotificationType, NotificationChannel, DevicePlatform } from './enums'

export interface NotificationDto {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  channels: NotificationChannel[]
  readAt?: string
  createdAt: string
}

export interface UnreadCountDto {
  total: number
  byType: Array<{ type: NotificationType; count: number }>
}

export interface ListNotificationsQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  type?: NotificationType
  unreadOnly?: boolean
  from?: string
  to?: string
}

export interface DeviceDto {
  id: string
  userId: string
  token: string
  platform: DevicePlatform
  deviceId?: string
  deviceName?: string
  appVersion?: string
  isActive: boolean
  lastSeenAt: string
  createdAt: string
}

export interface RegisterDeviceDto {
  token: string
  platform: DevicePlatform
  deviceId?: string
  deviceName?: string
  appVersion?: string
}

export interface UnregisterDeviceDto {
  token: string
}

export interface TestPushDto {
  message?: string
}

export interface BroadcastDto {
  id: string
  title: string
  body: string
  type?: NotificationType
  data?: Record<string, unknown>
  audience: string
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  scheduledFor?: string
  sentAt?: string
  createdAt: string
  createdById: string
}

export interface CreateBroadcastDto {
  title: string
  body: string
  type?: NotificationType
  data?: Record<string, unknown>
  audience: 'ALL' | 'ROLE' | 'ZONE' | 'ACTIVE_CUSTOMERS' | 'USER_IDS'
  roleFilter?: string
  zoneId?: string
  userIds?: string[]
  channels?: NotificationChannel[]
  scheduledFor?: string
}

export interface UpdateBroadcastDto {
  title?: string
  body?: string
  type?: NotificationType
  data?: Record<string, unknown>
  audience?: string
  roleFilter?: string
  zoneId?: string
  userIds?: string[]
  channels?: NotificationChannel[]
  scheduledFor?: string
}

export interface BroadcastPreviewDto {
  recipientCount: number
  audience: string
  description: string
}

export interface SendResultDto {
  message: string
  delivered: number
  failed: number
  skipped: number
}

export interface SendNotificationDto {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  channels?: NotificationChannel[]
}

export interface ListBroadcastsQueryDto {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
  from?: string
  to?: string
}
