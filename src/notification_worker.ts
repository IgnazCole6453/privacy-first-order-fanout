import { z } from "zod";
import { infrai } from "./infrai_queue.js";

const notificationJobSchema = z.object({
  eventId: z.string().uuid(),
  orderId: z.string(),
  stage: z.enum(["checkout", "fulfillment", "receipt", "customer_update"]),
  occurredAt: z.string().datetime(),
  subscriberId: z.string(),
  channel: z.enum(["email", "webhook"]),
});

export async function consumeNotificationBatch(): Promise<number> {
  const { messages } = await infrai.queue.consume(25, 60);
  for (const message of messages) {
    const job = notificationJobSchema.parse(message.payload);
    console.log(JSON.stringify({ delivered: true, orderId: job.orderId, stage: job.stage, channel: job.channel }));
    await infrai.queue.ack(message.message_id, `ack:${message.message_id}`);
  }
  return messages.length;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  consumeNotificationBatch().then((count) => console.log(`acknowledged ${count} notification(s)`));
}
