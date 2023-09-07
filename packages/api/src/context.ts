import { Env } from "./worker";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type Tags = Record<string, string | undefined>;

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : never;

export class Context {
  public env: Env;
  public waitUntil: ExecutionContext["waitUntil"];
  private tags: Tags = {};

  constructor(env: Env, waitUntil: ExecutionContext["waitUntil"]) {
    this.env = env;
    this.waitUntil = async (promise) => {
      if (env.environment === "development") await promise;
      else waitUntil(promise);
    };
  }

  public tag(tags: Tags) {
    this.tags = {
      ...this.tags,
      ...tags,
    };
  }

  public log(level: LogLevel, message: string, tags: Tags = {}) {
    if (this.env.environment === "development") {
      console.log(`[${level}]`, message, tags);
      return;
    }

    // TODO: Collect logs
  }
  public trace(...args: DropFirst<Parameters<typeof this.log>>) {
    this.log("trace", ...args);
  }
  public debug(...args: DropFirst<Parameters<typeof this.log>>) {
    this.log("debug", ...args);
  }
  public info(...args: DropFirst<Parameters<typeof this.log>>) {
    this.log("info", ...args);
  }
  public warn(...args: DropFirst<Parameters<typeof this.log>>) {
    this.log("warn", ...args);
  }
  public error(...args: DropFirst<Parameters<typeof this.log>>) {
    this.log("error", ...args);
  }
  public fatal(...args: DropFirst<Parameters<typeof this.log>>) {
    this.log("fatal", ...args);
  }

  public async ship(): Promise<void> {
    if (this.env.environment === "development") {
      console.log("Shipping metrics", JSON.stringify(this.tags));
      return;
    }

    if (!this.env.metricsClientId || !this.env.metricsClientSecret) return;

    // Ship metrics to Sinope via the ingest-worker
    // https://github.com/sdnts/ingest-worker
    this.waitUntil(
      fetch("https://in.sdnts.dev/m", {
        method: "POST",
        headers: {
          Origin: "https://api.blob.city",
          "CF-Access-Client-Id": this.env.metricsClientId,
          "CF-Access-Client-Secret": this.env.metricsClientSecret,
        },
        body: JSON.stringify({
          name: "request",
          rayId: this.tags.rayId,
          method: this.tags.method,
          path: this.tags.path,
          status: this.tags.status,
        }),
      })
    );

    // TODO: Ship logs to Sinope
  }
}
