import { Router, error, status } from "itty-router";
import { TunnelRequest, withAuth, withIp, withTunnel } from "./middleware";

export type Env = {
  environment: "production" | "development";
  authSecret: string;
  secrets: KVNamespace;
  tunnels: DurableObjectNamespace;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // I want to do as little as possible in the Worker so I can avoid having
    // routing / app logic in two places.
    // Basically, all we want to do here is figure out the DO ID and move on.
    // We do not even ship any metrics from the Worker.

    return Router<TunnelRequest, [Env]>()
      .options("*", () => status(200))
      .put("/new", (request, env) => {
        request.tunnelId = env.tunnels.newUniqueId().toString();
      })
      .put("/join", async (request, env) => {
        const secret = request.query["s"];
        if (!secret) return error(400, "Missing secret");
        if (Array.isArray(secret)) return error(400, "Multiple secrets");

        const tunnelId = await env.secrets.get(secret);
        if (!tunnelId) return error(403, "Incorrect secret");

        request.tunnelId = tunnelId;
      })
      .get("/tunnel", withIp, withAuth)
      .get("/download", withIp, withAuth)
      .all("*", withTunnel)
      .handle(request, env)
      .then((r: Response) => {
        const response = new Response(r.body, r);
        response.headers.set(
          "Access-Control-Allow-Origin",
          // env.environment === "development" ? "*" : "https://blob.city"
          "*"
        );
        response.headers.set("Access-Control-Allow-Methods", "GET,PUT");
        return response;
      })
      .catch((e) => {
        console.error(
          { error: (e as Error).message },
          "Internal error in Worker"
        );
        return error(500, "Internal error");
      });
  },
};

export { Tunnel } from "./tunnel";
