import { test as t } from "vitest";
import { unstable_dev, type UnstableDevWorker } from "wrangler";

type WorkerFixtures = {
  worker: UnstableDevWorker;
};

export const test = t.extend<WorkerFixtures>({
  worker: async ({ }, use) => {
    const worker = await unstable_dev("src/worker.ts", {
      experimental: { disableExperimentalWarning: true },
    });
    await use(worker);
    await worker.stop();
  },
});

export { UnstableDevWorker };
