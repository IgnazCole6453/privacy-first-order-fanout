import { createServer } from "node:http";
import { InfraiError, infrai } from "./infrai_queue.js";
import { orderUpdateSchema, planNotifications } from "./order_fanout.js";

export async function acceptOrderUpdate(input: unknown): Promise<{ accepted: number }> {
  const update = orderUpdateSchema.parse(input);
  const jobs = planNotifications(update);
  await Promise.all(jobs.map((job) =>
    infrai.queue.publish(job, `${job.eventId}:${job.subscriberId}:${job.channel}`),
  ));
  return { accepted: jobs.length };
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function statusFor(error: unknown): number {
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) return error.status;
  if (error instanceof SyntaxError || (typeof error === "object" && error !== null && "issues" in error)) return 400;
  return 500;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.method !== "POST" || request.url !== "/order-updates") {
      response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
      return;
    }
    try {
      const result = await acceptOrderUpdate(await readJson(request));
      response.writeHead(202).end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(statusFor(error)).end(JSON.stringify({
        error: error instanceof Error ? error.message : "request rejected",
      }));
    }
  });
  server.listen(Number(process.env.PORT ?? 3000), () => console.log("order update service: http://localhost:3000"));
}
