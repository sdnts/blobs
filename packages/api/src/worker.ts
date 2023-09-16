import { Router, error } from "itty-router";
import { TunnelRequest, withAuth, withIp } from "./middleware";

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

    return Router<TunnelRequest>()
      .options("*", () => new Response(null))
      .put("/new", (request, ctx) =>
        ctx.env.tunnels.get(ctx.env.tunnels.newUniqueId()).fetch(request)
      )
      .put("/join", async (request, ctx) => {
        const secret = request.query["s"];
        if (!secret) return error(400, "Missing secret");
        if (Array.isArray(secret)) return error(400, "Multiple secrets");

        const tunnelId = await ctx.env.secrets.get(secret);
        if (!tunnelId) return error(403, "Incorrect secret");

        return ctx.env.tunnels
          .get(ctx.env.tunnels.idFromString(tunnelId))
          .fetch(request);
      })
      .get("/tunnel", withIp(), withAuth(), (request, ctx) =>
        ctx.env.tunnels
          .get(ctx.env.tunnels.idFromString(request.tunnelId))
          .fetch(request)
      )
      .get("/download", withIp(), withAuth(), (request, ctx) =>
        ctx.env.tunnels
          .get(ctx.env.tunnels.idFromString(request.tunnelId))
          .fetch(request)
      )
      .all("*", () => error(400, "Bad pathname"))
      .handle(request, ctx)
      .then((r: Response) => {
        const response = new Response(r.body, r);

        response.headers.set(
          "Access-Control-Allow-Origin",
          env.environment === "development" ? "*" : "https://blob.city"
        );
        response.headers.set("Access-Control-Allow-Methods", "GET,PUT");

        return response;
      })
      .catch((e) => error(500, `Uncaught error: ${(e as Error).message}`));
  },
};

export { Tunnel } from "./tunnel";
