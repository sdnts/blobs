import { expect } from "vitest";
import { test } from "./setup";

test("can create new tunnels", async ({ worker }) => {
  const res = await worker.fetch("/new", { method: "PUT" });
  expect(res.status).toBe(200);

  const body = (await res.json()) as Record<string, string>;

  expect(body.secret).not.toBeUndefined();
  expect(body.secret.length).toBe(6);

  expect(body.token).not.toBeUndefined();
  const [peerId, tunnelId, ip, signature] = body.token.split("|");
  expect(peerId).not.toBeUndefined();
  expect(tunnelId).not.toBeUndefined();
  expect(ip).not.toBeUndefined();
  expect(signature).not.toBeUndefined();
});
