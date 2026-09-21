import { apiGet, apiGetPaginated, apiPatch, apiPost } from '../api-client'
import type {
  TicketDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  AddTicketMessageDto,
  ChangeTicketStatusDto,
  AssignTicketDto,
  ChangeTicketPriorityDto,
  QueueSummaryDto,
  AuditLogDto,
  ListAuditLogsQueryDto,
  EntityTypesDto,
} from '@/types/support'

export const supportApi = {
  // Support tickets
  createTicket: (data: CreateTicketDto) =>
    apiPost<TicketDto>('/support-tickets', data),

  listTickets: (query?: ListTicketsQueryDto) =>
    apiGetPaginated<TicketDto>('/support-tickets', { params: query }),

  getQueueSummary: () =>
    apiGet<QueueSummaryDto>('/support-tickets/queue-summary'),

  getTicket: (id: string) =>
    apiGet<TicketDto>(`/support-tickets/${id}`),

  addMessage: (id: string, data: AddTicketMessageDto) =>
    apiPost<TicketDto>(`/support-tickets/${id}/messages`, data),

  changeTicketStatus: (id: string, data: ChangeTicketStatusDto) =>
    apiPatch<TicketDto>(`/support-tickets/${id}/status`, data),

  assignTicket: (id: string, data: AssignTicketDto) =>
    apiPatch<TicketDto>(`/support-tickets/${id}/assign`, data),

  changeTicketPriority: (id: string, data: ChangeTicketPriorityDto) =>
    apiPatch<TicketDto>(`/support-tickets/${id}/priority`, data),

  // Audit logs
  listAuditLogs: (query?: ListAuditLogsQueryDto) =>
    apiGetPaginated<AuditLogDto>('/audit-logs', { params: query }),

  getEntityTypes: () =>
    apiGet<EntityTypesDto>('/audit-logs/entity-types'),

  getEntityAuditLogs: (entityType: string, entityId: string) =>
    apiGet<AuditLogDto[]>(`/audit-logs/${entityType}/${entityId}`),
}
