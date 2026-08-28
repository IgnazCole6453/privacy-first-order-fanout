import { describe, expect, it } from "vitest";
import { orderUpdateSchema, planNotifications } from "../src/order_fanout.js";

describe("checkout notification policy", () => {
  it("fans out once per subscriber and channel", () => {
    const update = orderUpdateSchema.parse({
      eventId: "c35a0542-637a-4f8e-8858-0bc9d822eda0",
      orderId: "order-4821",
      stage: "checkout",
      occurredAt: "2026-08-15T09:30:00.000Z",
      subscribers: [
        { subscriberId: "customer-81", channel: "email" },
        { subscriberId: "customer-81", channel: "email" },
        { subscriberId: "fulfillment-team", channel: "webhook" },
      ],
    });

    expect(planNotifications(update)).toEqual([
      expect.objectContaining({ subscriberId: "customer-81", channel: "email", stage: "checkout" }),
      expect.objectContaining({ subscriberId: "fulfillment-team", channel: "webhook", stage: "checkout" }),
    ]);
  });
});
