import { z } from "zod";

export const orderUpdateSchema = z.object({
  eventId: z.string().uuid(),
  orderId: z.string().min(1).max(80),
  stage: z.enum(["checkout", "fulfillment", "receipt", "customer_update"]),
  occurredAt: z.string().datetime(),
  subscribers: z.array(z.object({
    subscriberId: z.string().min(1).max(80),
    channel: z.enum(["email", "webhook"]),
  })).min(1).max(500),
});

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;
export type NotificationJob = {
  eventId: string;
  orderId: string;
  stage: OrderUpdate["stage"];
  occurredAt: string;
  subscriberId: string;
  channel: "email" | "webhook";
};

export function planNotifications(update: OrderUpdate): NotificationJob[] {
  const unique = new Map(update.subscribers.map((subscriber) => [
    `${subscriber.subscriberId}:${subscriber.channel}`,
    subscriber,
  ]));
  return [...unique.values()].map((subscriber) => ({
    eventId: update.eventId,
    orderId: update.orderId,
    stage: update.stage,
    occurredAt: update.occurredAt,
    // Subscribers come from the validated schema; keep the job contract required
    // when compiling without strict inference settings.
    subscriberId: subscriber.subscriberId!,
    channel: subscriber.channel!,
  }));
}
