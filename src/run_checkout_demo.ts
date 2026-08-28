import { acceptOrderUpdate } from "./order_update_service.js";

const result = await acceptOrderUpdate({
  eventId: "c35a0542-637a-4f8e-8858-0bc9d822eda0",
  orderId: "order-4821",
  stage: "checkout",
  occurredAt: "2026-08-15T09:30:00.000Z",
  subscribers: [
    { subscriberId: "customer-81", channel: "email" },
    { subscriberId: "fulfillment-team", channel: "webhook" },
  ],
});

console.log(result);
