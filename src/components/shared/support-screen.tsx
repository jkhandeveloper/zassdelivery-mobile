import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Plus, Send } from "lucide-react-native";
import * as React from "react";
import { useForm } from "react-hook-form";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ControlledInput } from "@/components/ui/controlled-input";
import { Field, Input } from "@/components/ui/input";
import { Badge, Body, Card, Heading } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { useCreateTicket, useReplyToTicket, useTicket, useTickets } from "@/hooks/use-support";
import { ApiError } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";
import { TicketCategory, TicketStatus } from "@/types/enums";
import type { TicketDto } from "@/types/support";

/**
 * Tickets and threads, shared by all three portals.
 *
 * One component rather than three because the API is one API — a rider's
 * ticket and a vendor's ticket are the same record with a different author, and
 * the web app's decision to render them at `/{portal}/support` was about
 * navigation chrome, not about the content differing. Here the portal supplies
 * its own tab bar, so the screen itself can be the same.
 *
 * Three states in one file: the list, the composer, and a thread. Kept together
 * because they share the mutation cache invalidation and splitting them would
 * mean threading the selected ticket id through a parent that has no other use
 * for it.
 */

const CATEGORY_LABELS: Record<string, string> = {
  [TicketCategory.ORDER_ISSUE]: "Problem with an order",
  [TicketCategory.PAYMENT_ISSUE]: "Payment or refund",
  [TicketCategory.DELIVERY_ISSUE]: "Delivery problem",
  [TicketCategory.ACCOUNT]: "My account",
  [TicketCategory.RESTAURANT_COMPLAINT]: "Complaint about a restaurant",
  [TicketCategory.OTHER]: "Something else",
};

function statusTone(status: string): "success" | "warning" | "brand" | "neutral" {
  switch (status) {
    case TicketStatus.RESOLVED:
      return "success";
    case TicketStatus.WAITING_ON_CUSTOMER:
      return "warning";
    case TicketStatus.OPEN:
    case TicketStatus.IN_PROGRESS:
      return "brand";
    default:
      return "neutral";
  }
}

const newTicketSchema = z.object({
  subject: z.string().trim().min(4, "Give it a short title").max(120, "That's too long"),
  message: z.string().trim().min(10, "Tell us a little more so we can help"),
  category: z.enum([
    TicketCategory.ORDER_ISSUE,
    TicketCategory.PAYMENT_ISSUE,
    TicketCategory.DELIVERY_ISSUE,
    TicketCategory.ACCOUNT,
    TicketCategory.RESTAURANT_COMPLAINT,
    TicketCategory.OTHER,
  ]),
});

type NewTicketValues = z.infer<typeof newTicketSchema>;

function NewTicket({ onDone }: { onDone: () => void }) {
  const createTicket = useCreateTicket();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<NewTicketValues>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: { subject: "", message: "", category: TicketCategory.OTHER },
    mode: "onTouched",
  });

  const category = watch("category");

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createTicket.mutateAsync(values);
      toast.success("Ticket opened", { description: "We'll reply here." });
      onDone();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Couldn't open that ticket. Try again.",
      );
    }
  });

  return (
    <View className="gap-4">
      <Field label="What's it about?" required>
        <View className="gap-2">
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => {
            const active = category === value;

            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() =>
                  setValue("category", value as NewTicketValues["category"], {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "rounded-input border px-3 py-2.5",
                  active ? "border-brand bg-brand-soft" : "border-border-default bg-surface",
                )}
              >
                <Text
                  className={cn(
                    "font-sans text-[14px]",
                    active ? "font-semibold text-brand" : "text-primary",
                  )}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <ControlledInput
        control={control}
        name="subject"
        label="Title"
        required
        placeholder="Order arrived cold"
        editable={!isSubmitting}
      />

      <ControlledInput
        control={control}
        name="message"
        label="What happened?"
        required
        placeholder="Tell us what went wrong, and what you'd like us to do."
        multiline
        numberOfLines={5}
        // `multiline` ignores the shared min-height, and a four-line box that
        // renders one line tall is the single most common RN text-area bug.
        className="min-h-[110px] py-2.5"
        textAlignVertical="top"
        editable={!isSubmitting}
      />

      <Button fullWidth onPress={() => void onSubmit()} loading={isSubmitting}>
        Open ticket
      </Button>
      <Button variant="ghost" fullWidth onPress={onDone} disabled={isSubmitting}>
        Cancel
      </Button>
    </View>
  );
}

function Thread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const ticket = useTicket(ticketId);
  const reply = useReplyToTicket(ticketId);
  const [message, setMessage] = React.useState("");

  const onSend = React.useCallback(() => {
    const text = message.trim();

    if (text === "") {
      return;
    }

    reply.mutate(
      { message: text },
      {
        // Cleared on success only. Wiping it optimistically loses what the user
        // typed if the request fails, which on a support ticket is the message
        // they were most annoyed about having to write.
        onSuccess: () => setMessage(""),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Couldn't send that."),
      },
    );
  }, [message, reply]);

  if (ticket.isPending) {
    return <LoadingState />;
  }

  if (ticket.isError) {
    return <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />;
  }

  const data = ticket.data;

  return (
    <View className="flex-1 gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        className="flex-row items-center gap-1"
      >
        <ChevronLeft size={18} color="#0E7490" />
        <Text className="font-sans text-[14px] font-semibold text-brand">All tickets</Text>
      </Pressable>

      <View className="gap-1">
        <Heading level={3}>{data.subject}</Heading>
        <View className="flex-row items-center gap-2">
          <Badge tone={statusTone(data.status)}>{data.status.replace(/_/g, " ")}</Badge>
          <Text
            className="font-sans text-[12px] text-muted"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {data.ticketNumber}
          </Text>
        </View>
      </View>

      <FlatList
        data={data.messages.filter((entry) => !entry.isInternal)}
        keyExtractor={(entry) => entry.id}
        contentContainerClassName="gap-2 pb-2"
        renderItem={({ item }) => (
          <View
            className={cn(
              "max-w-[85%] rounded-card px-3 py-2.5",
              item.fromCustomer
                ? "self-end rounded-br-md bg-brand-soft"
                : "self-start rounded-bl-md bg-surface-muted",
            )}
          >
            {!item.fromCustomer ? (
              <Text className="font-sans text-[12px] font-semibold text-secondary">
                {item.senderName}
              </Text>
            ) : null}
            <Text className="font-sans text-[14px] text-primary">{item.message}</Text>
            <Text className="mt-0.5 font-sans text-[11px] text-muted">
              {formatRelative(item.createdAt)}
            </Text>
          </View>
        )}
      />

      {data.isOpen ? (
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder="Write a reply"
              multiline
              className="max-h-[100px] py-2.5"
              textAlignVertical="top"
              accessibilityLabel="Your reply"
            />
          </View>
          <Button
            size="md"
            onPress={onSend}
            loading={reply.isPending}
            disabled={message.trim() === ""}
            accessibilityLabel="Send reply"
            icon={<Send size={16} color="#04202B" />}
          >
            Send
          </Button>
        </View>
      ) : (
        <Body muted className="text-[13px]">
          This ticket is closed. Open a new one if you still need help.
        </Body>
      )}
    </View>
  );
}

function TicketRow({ ticket, onPress }: { ticket: TicketDto; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card className="gap-1">
        <View className="flex-row items-start justify-between gap-2">
          <Text numberOfLines={1} className="flex-1 font-sans text-[15px] font-semibold text-primary">
            {ticket.subject}
          </Text>
          <Badge tone={statusTone(ticket.status)}>{ticket.status.replace(/_/g, " ")}</Badge>
        </View>
        <Text className="font-sans text-[13px] text-secondary">
          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
        </Text>
        <Text className="font-sans text-[12px] text-muted">
          {ticket.messageCount} message{ticket.messageCount === 1 ? "" : "s"} ·{" "}
          {formatRelative(ticket.updatedAt)}
        </Text>
      </Card>
    </Pressable>
  );
}

export function SupportScreen({ title = "Support" }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const tickets = useTickets({ limit: 30, sortBy: "updatedAt", sortOrder: "desc" });

  const [view, setView] = React.useState<{ mode: "list" | "new" } | { mode: "thread"; id: string }>(
    { mode: "list" },
  );

  return (
    <View className="flex-1 bg-canvas px-4" style={{ paddingTop: insets.top + 8 }}>
      {view.mode === "thread" ? (
        <Thread ticketId={view.id} onBack={() => setView({ mode: "list" })} />
      ) : view.mode === "new" ? (
        <FlatList
          data={[null]}
          keyExtractor={() => "composer"}
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Heading level={2} className="mb-4">
              New ticket
            </Heading>
          }
          renderItem={() => <NewTicket onDone={() => setView({ mode: "list" })} />}
        />
      ) : (
        <>
          <View className="mb-3 flex-row items-center justify-between">
            <Heading level={2}>{title}</Heading>
            <Button
              size="sm"
              onPress={() => setView({ mode: "new" })}
              icon={<Plus size={16} color="#04202B" />}
            >
              New
            </Button>
          </View>

          {tickets.isPending ? (
            <LoadingState />
          ) : tickets.isError ? (
            <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />
          ) : (
            <FlatList
              data={tickets.data.items}
              keyExtractor={(ticket) => ticket.id}
              contentContainerClassName="gap-3 pb-8"
              refreshing={tickets.isRefetching}
              onRefresh={() => void tickets.refetch()}
              renderItem={({ item }) => (
                <TicketRow
                  ticket={item}
                  onPress={() => setView({ mode: "thread", id: item.id })}
                />
              )}
              ListEmptyComponent={
                <EmptyState
                  title="No tickets"
                  description="If something goes wrong, open a ticket and we'll pick it up."
                  action={{ label: "Open a ticket", onPress: () => setView({ mode: "new" }) }}
                />
              }
            />
          )}
        </>
      )}
    </View>
  );
}
