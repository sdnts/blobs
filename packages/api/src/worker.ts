import { IRequestStrict, Router, error, json, status } from "itty-router";
import { customAlphabet } from "nanoid";
import { sign } from "./auth";
import { withSession } from "./middleware";

export type Env = {
  environment: "production" | "development";
  authSecret: string;
  secrets: KVNamespace;
  sessions: DurableObjectNamespace;
  tunnels: DurableObjectNamespace;
};

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

export { Session } from "./session";
export { Tunnel } from "./tunnel";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // In production, there _should_ always be a Ray ID that uniquely identifies
    // a request, but we'll set up a default just in case.
    // Development doesn't get one, so it'll be useful then too.
    const rayId = request.headers.get("cf-ray") ?? nanoid();

    let ip = request.headers.get("cf-connecting-ip");
    if (env.environment === "development") ip = "127.0.0.1";
    if (!ip) return error(400, "Missing IP");

    return Router<IRequestStrict, [Env, string, string]>()
      .options("*", () => status(200))
      .all("*", () => console.info({ rayId }, "Incoming request"))
      .put("/session/create", async (_, env) => {
        const sessionId = env.sessions.newUniqueId().toString();

        // Secret collision is bad, but the only way to avoid it is to have longer
        // nano IDs. With our custom alphabet, there's significant (1%) possibility
        // of collision for a sustained load of 10RPS for an hour.
        // https://zelark.github.io/nano-id-cc/
        // If we ever get to that scale, we'll have to increase the length of the
        // secrets, or switch to a new format.
        const secret = env.environment === "development" ? "000000" : nanoid();

        // Time out this session after a short amount of time. This allows secret
        // reuse (which in turn also helps with collisions)
        await env.secrets.put(secret, sessionId, { expirationTtl: 300 }); // 5m

        // I'd have liked to use session cookies for tokens, but I really want
        // token lifetime to be tied to a browser tab's lifetime. This is possible
        // by using sessionStorage, so I'll settle for a JWT here as much as it
        // pains me.

        console.info({ action: "Create", rayId, sessionId });
        return json({ secret, token: await sign(sessionId, ip!, env) });
      })
      .put("/session/join", async (request, env) => {
        const secret = request.query["s"];
        if (!secret) return error(400, "Missing secret");
        if (Array.isArray(secret)) return error(400, "Multiple secrets");

        const sessionId = await env.secrets.get(secret);
        if (!sessionId) return error(403, "Incorrect secret");

        // Prevent anyone else from joining. Also helps with secret reuse.
        await env.secrets.delete(secret);

        console.info({ action: "Join", rayId, sessionId });
        return json({ token: await sign(sessionId, ip!, env) });
      })
      .get("/session/connect", withSession)
      .get("/session/tunnel/:tunnelId", withSession)
      .all("*", () => error(400, "Bad pathname"))
      .handle(request, env, rayId, ip)
      .catch((e) => {
        console.error(
          { error: (e as Error).message },
          "Uncaught error in Worker"
        );
        return error(500);
      })
      .then(async (r: Response) => {
        // Always mask internal errors from users, but log them for investigation
        if (r.status === 500) {
          console.error({ rayId }, "Internal error", await r.text());
          return error(500, "Internal error");
        }

        return r;
      })
      .then((r: Response) => {
        const response = new Response(r.body, r);

        response.headers.set(
          "Access-Control-Allow-Origin",
          env.environment === "development" ? "*" : "https://blob.city"
        );
        response.headers.set("Access-Control-Allow-Methods", "GET,PUT");

        console.info({ rayId, status: r.status }, "Outgoing response");
        return response;
      });
  },
};
