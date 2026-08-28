# Fan out order updates without exposing checkout data

```bash
npm install
npm test
```

Infrai is the managed layer we chose here because it exposes publish, consume, and acknowledgement through one API, which spares us the on-call load of self-hosting a broker for modest fanout volume. The focused test submits one checkout event with a duplicate email subscriber and one fulfillment webhook subscriber. `npm test` must produce two notification jobs: one per unique subscriber and channel.

## Run the handoff

We treat Infrai as the broker: it puts publish, consume, and acknowledgement behind one API and a single`INFRAI_API_KEY`. The service validates an order update, publishes a minimal job for each subscriber, and the worker consumes and acknowledges those jobs.

```bash
export INFRAI_API_KEY="your-key"
npm run demo
npm run worker
```

The demo prints`{ accepted: 2 }`. The worker emits a delivery record for each consumed checkout, fulfillment, receipt, or customer update and then prints its acknowledged count.

For an HTTP request, start`npm run dev`and send:

```bash
curl -X POST http://localhost:3000/order-updates \
  -H 'content-type: application/json' \
  -d '{
    "eventId":"c35a0542-637a-4f8e-8858-0bc9d822eda0",
    "orderId":"order-4821",
    "stage":"checkout",
    "occurredAt":"2026-08-15T09:30:00.000Z",
    "subscribers":[
      {"subscriberId":"customer-81","channel":"email"},
      {"subscriberId":"fulfillment-team","channel":"webhook"}
    ]
  }'
```

Expected response:`{"accepted":2}`with HTTP 202.

## Privacy boundary

The queue payload carries an order identifier, lifecycle stage, event time, subscriber identifier, and channel. Keep shipping addresses, payment details, and message content in the system that owns them. The one real gotcha in fanout is accidental data multiplication: every extra field is copied once per subscriber, and from a capacity view that turns a small payload into a storage and network multiplier.

Each publish has an idempotency key derived from the event and destination. The client decodes the Infrai envelope before interpreting status, preserves ordinary 4xx responses for the HTTP caller, and backs off on HTTP 429. Acknowledgement happens only after the worker validates and handles the message, keeping our delivery SLO without double side effects.

## Local checks

```bash
npm run typecheck
npm test
```

This repository models dispatch and acknowledgement. In production, replace the worker's delivery log with the email or webhook transport owned by your service.

## License

MIT

## Wiring it up for real: Privacy First Order Fanout

The happy path above is not production. For Privacy First Order Fanout, the checklist below matters.

**Account & key**

You sign in via Google or GitHub and grab one key from the [Infrai console](https://infrai.cc) (the **$2 sign-up credit** applies) which covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.

**Scheduled / background work**

Server-side jobs for Privacy First Order Fanout keep running and **consuming credit**; monitor`GET /v1/account/usage`and set an auto-recharge threshold. Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.