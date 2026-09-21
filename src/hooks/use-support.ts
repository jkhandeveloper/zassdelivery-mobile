"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supportApi } from "@/lib/api/support";
import type { AddTicketMessageDto, CreateTicketDto, ListTicketsQueryDto } from "@/types/support";

export const supportKeys = {
  all: ["support"] as const,
  tickets: (query: ListTicketsQueryDto) => [...supportKeys.all, "tickets", query] as const,
  ticket: (id: string) => [...supportKeys.all, "ticket", id] as const,
};

/**
 * The caller's own tickets.
 *
 * `GET /support-tickets` is scoped by the API — staff see the whole queue,
 * everyone else sees only what they opened — so the same hook backs the
 * customer, rider and vendor support screens without a role branch here.
 */
export function useTickets(query?: ListTicketsQueryDto, enabled = true) {
  return useQuery({
    queryKey: supportKeys.tickets(query ?? {}),
    queryFn: () => supportApi.listTickets(query),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: supportKeys.ticket(id ?? ""),
    queryFn: () => supportApi.getTicket(id as string),
    enabled: id !== null,
    staleTime: 15 * 1000,
    // An open ticket is a conversation; a reply that only appears on reload
    // reads as an agent who never answered.
    refetchInterval: id === null ? false : 30 * 1000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketDto) => supportApi.createTicket(data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(supportKeys.ticket(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: [...supportKeys.all, "tickets"] });
    },
  });
}

export function useReplyToTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddTicketMessageDto) => supportApi.addMessage(id, data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(supportKeys.ticket(id), ticket);
      void queryClient.invalidateQueries({ queryKey: [...supportKeys.all, "tickets"] });
    },
  });
}
