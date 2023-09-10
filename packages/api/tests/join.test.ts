import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { UnstableDevWorker, setup, teardown } from "./setup";

let worker: UnstableDevWorker;
beforeAll(async () => {
  worker = await setup();
});
afterAll(() => teardown(worker));

let secret: string;
beforeEach(async () => {
  const res = await worker.fetch("/new", { method: "PUT" });
  const body = (await res.json()) as Record<string, string>;
  secret = body.secret;
});

test("can join existing tunnels", async () => {
  const res = await worker.fetch(`/join?s=${secret}`, { method: "PUT" });
  expect(res.status).toBe(200);

  const body = (await res.json()) as Record<string, string>;

  expect(body.secret).toBeUndefined();

  expect(body.token).not.toBeUndefined();
  const [signature, actorId, ip] = body.token.split("|");
  expect(signature).not.toBeUndefined();
  expect(actorId).not.toBeUndefined();
  expect(ip).not.toBeUndefined();
});
