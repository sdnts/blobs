import { Env } from "./worker";

type Tags = Record<string, string | undefined>;

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

  public setTags(tags: Tags) {
    this.tags = {
      ...this.tags,
      ...tags,
    };
  }

  public log(message: string, tags: Tags = {}) {
    if (this.env.environment === "development") {
      console.log(message, tags);
      return;
    }
  }

  public async ship(): Promise<void> {
    if (this.env.environment === "development") {
      console.log("Shipping metrics", JSON.stringify(this.tags));
      return;
    }

    this.waitUntil(
      fetch("https://in.sdnts.dev/m", {
        method: "POST",
        headers: {
          Origin: "https://blob.city",
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
  }
}
