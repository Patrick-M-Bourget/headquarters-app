// Shared Paperclip API client for process-adapter runners (Mastra research, SEO/GEO).
// Minimal Paperclip API client for the `process` adapter: the adapter passes no issue id,
// so the runner looks up the issue linked to its heartbeat run and reports back itself.
const base = () => (process.env.PAPERCLIP_API_URL ?? "").replace(/\/$/, "").replace(/\/api$/, "") + "/api";

export const paperclipEnabled = () => Boolean(process.env.PAPERCLIP_API_URL && process.env.PAPERCLIP_API_KEY && process.env.PAPERCLIP_RUN_ID);

async function call(method: string, path: string, body?: unknown) {
  const host = new URL(base()).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error(`refusing non-loopback Paperclip URL ${host}`);
  const res = await fetch(base() + path, {
    method,
    headers: {
      authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}`,
      "x-paperclip-run-id": process.env.PAPERCLIP_RUN_ID ?? "",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Paperclip ${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  if (method !== "GET" && !text.trim()) throw new Error(`Paperclip ${method} ${path}: empty response (write failed)`);
  return text ? JSON.parse(text) : null;
}

export async function findIssue(): Promise<{ id: string; identifier?: string } | null> {
  const data = await call("GET", `/heartbeat-runs/${process.env.PAPERCLIP_RUN_ID}/issues`);
  const list: any[] = Array.isArray(data) ? data : data?.items ?? data?.issues ?? [];
  const open = list.find(i => !["done", "cancelled"].includes(i.status)) ?? list[0];
  const id = open?.issueId ?? open?.id; // this endpoint returns { issueId, identifier, ... }
  if (open && !id) throw new Error(`unexpected heartbeat-run issue shape: ${JSON.stringify(open).slice(0, 200)}`);
  return open ? { id, identifier: open.identifier } : null;
}

export async function reportToIssue(issueId: string, body: string, status: "done" | "blocked") {
  await call("PATCH", `/issues/${issueId}`, { status, comment: body });
}

/** Report this run's model cost so Paperclip budgets see priced usage (process runs are otherwise "unpriced"). */
export async function reportCost(issueId: string | null, model: string, usage: { input_tokens: number; output_tokens: number }, costUsd: number) {
  await call("POST", `/companies/${process.env.PAPERCLIP_COMPANY_ID}/cost-events`, {
    idempotencyKey: `mastra-${process.env.PAPERCLIP_RUN_ID}`,
    agentId: process.env.PAPERCLIP_AGENT_ID,
    issueId, heartbeatRunId: process.env.PAPERCLIP_RUN_ID,
    provider: "anthropic", billingType: "metered_api", model,
    inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    costCents: Number((costUsd * 100).toFixed(4)), occurredAt: new Date().toISOString(),
  });
}
