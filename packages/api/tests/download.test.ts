import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { UnstableDevWorker, setup, teardown } from "./setup";

let worker: UnstableDevWorker;
beforeAll(async () => {
  worker = await setup();
});
afterAll(() => teardown(worker));

let peer1Token: string;
let peer2Token: string;
beforeEach(async () => {
  const res = await worker.fetch("/new", { method: "PUT" });
  const body = (await res.json()) as Record<string, string>;
  peer1Token = body.token;

  await worker.fetch(`/join?s=${body.secret}`, { method: "PUT" });
  peer2Token = body.token;
});

test.todo("can download blobs", async () => {
  // TODO: See tunnel.test.ts
});
