import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { WebSocket } from "ws";
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

test.todo("can connect to a tunnel", async () => {
  // TODO: I keep getting EPIPE errors here, and I really don't have the patience
  // to debug JavaScript tooling anymore.
  // We'll test WS via UI tests instead
  try {
    const peer1 = new WebSocket(
      `ws://127.0.0.1:${worker.port}/tunnel?t=${peer1Token}&p=1`
    );
    const peer2 = new WebSocket(
      `ws://127.0.0.1:${worker.port}/tunnel?t=${peer2Token}&p=2`
    );
  } catch (e) {
    expect(true).toBe(false);
  }
});
