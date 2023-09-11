import { afterAll, beforeAll, expect, test } from "vitest";
import { UnstableDevWorker, setup, teardown } from "./setup";

let worker: UnstableDevWorker;
beforeAll(async () => {
  worker = await setup();
});
afterAll(() => teardown(worker));

test("can create new tunnels", async () => {
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
