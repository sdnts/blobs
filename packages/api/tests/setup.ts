import { type UnstableDevWorker, unstable_dev } from "wrangler";

export { UnstableDevWorker };

export function setup() {
  return unstable_dev("src/worker.ts", {
    experimental: { disableExperimentalWarning: true },
  });
}

export async function teardown(worker: UnstableDevWorker) {
  worker?.stop();
}
