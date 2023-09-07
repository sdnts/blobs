import { Router, error } from "itty-router";
import { customAlphabet } from "nanoid";
import { sign } from "./auth";
import { Context } from "./context";
import {
  TunnelRequest,
  withAction,
  withAuth,
  withIp,
  withTags,
  withTunnel,
} from "./middleware";

export type Env = {
  environment: "production" | "development";
  secret: string;
  tunnels: KVNamespace;
  tunnel: DurableObjectNamespace;
  metricsClientId?: string;
  metricsClientSecret?: string;
};

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

export default {
  async fetch(
    request: Request,
    env: Env,
    { waitUntil }: ExecutionContext
  ): Promise<Response> {
    const ctx = new Context(env, waitUntil);

    return Router<TunnelRequest, [Context]>()
      .options("*", withAction("preflight"), () => new Response(null))
      .all("*", withIp(), withTags())
      .put("/new", withAction("new"), async (request, ctx) => {
        // TODO: For a sustained load of 10RPS for about an hour, there's a significant
        // possibility of secret collision. That's a lot of requests though, so we'll
        // deal with it if we ever get there.
        const secret =
          ctx.env.environment === "development" ? "000000" : nanoid();
        const tunnelId = ctx.env.tunnel.newUniqueId().toString();

        await ctx.env.tunnels.put(secret, tunnelId, { expirationTtl: 10 * 60 });

        return new Response(
          JSON.stringify({
            secret,
            auth: await sign(tunnelId, request.ip, ctx),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
      .put("/join", withAction("join"), async (request, ctx) => {
        const secret = request.query["s"];
        if (!secret) return error(400, "Missing secret");
        if (Array.isArray(secret)) return error(400, "Multiple secrets");

        const tunnelId = await ctx.env.tunnels.get(secret);
        if (!tunnelId) return error(403, "Incorrect secret");

        await ctx.env.tunnels.delete(secret);

        return new Response(
          JSON.stringify({ auth: await sign(tunnelId, request.ip, ctx) }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
      .get("/tunnel", withAuth(), withAction("tunnel"), withTunnel())
      .get("/download", withAuth(), withAction("download"), withTunnel())
      .all("*", () => error(400, "Bad pathname"))
      .handle(request, ctx)
      .then((r: Response) => {
        ctx.tag({ status: String(r.status) });

        const response = new Response(r.body, r);
        response.headers.set(
          "Access-Control-Allow-Origin",
          ctx.env.environment === "development" ? "*" : "https://blob.city"
        );
        response.headers.set("Access-Control-Allow-Methods", "GET,PUT");

        return response;
      })
      .catch((e) => {
        ctx.error(`Uncaught error: ${(e as Error).message}`);
        return error(500, `Uncaught error: ${(e as Error).message}`);
      })
      .finally(() => ctx.ship());
  },
};

export { Tunnel } from "./tunnel";
