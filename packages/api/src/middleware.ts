import { IRequestStrict, error } from "itty-router";
import { Context } from "./context";
import { verify } from "./auth";
import { nanoid } from "nanoid";

type Middleware = (
  request: TunnelRequest,
  ctx: Context
) => void | Response | Promise<void | Response>;

export type TunnelRequest = IRequestStrict & {
  rayId: string;
  peerId: string;
  tunnelId: string;
  ip: string;
};

export const withIp =
  (): Middleware =>
  (request, ctx): void | Response => {
    let ip = request.headers.get("cf-connecting-ip");
    if (ctx.env.environment === "development") ip = "127.0.0.1";
    if (!ip) return error(400, "Missing IP");

    request.ip = ip;
  };

type Action = "preflight" | "new" | "join" | "tunnel" | "download" | "unknown";
export const withTags =
  (action: Action): Middleware =>
  (request, ctx) => {
    let ip = request.headers.get("cf-connecting-ip");
    if (ctx.env.environment === "development") ip = "127.0.0.1";
    if (!ip) return error(400, "Missing IP");

    request.ip = ip;

    const rayId = request.headers.get("cf-ray") ?? nanoid();
    request.rayId = rayId;

    ctx.tag({
      environment: ctx.env.environment,
      rayId, // Helps with correlation of Worker and DO requests
      method: request.method,
      path: new URL(request.url).pathname,
      action,
    });
  };

export const withAuth = (): Middleware => async (request, ctx) => {
  const token = request.query.t;
  if (!token) return error(403, "Missing auth");
  if (Array.isArray(token)) return error(400, "Multiple tokens");

  const auth = await verify(token, ctx.env);
  if (auth === false) return error(403, "Invalid auth token");

  const { peerId, tunnelId, ip: lockedIp } = auth;

  if (request.ip !== lockedIp) return error(403, "Unauthorized IP");

  request.peerId = peerId;
  request.tunnelId = tunnelId;
  ctx.tag({ peerId, tunnelId });
};

export const withTunnel = (): Middleware => (request, ctx) => {
  const tunnel = ctx.env.tunnel.get(
    ctx.env.tunnel.idFromString(request.tunnelId)
  );

  // In development, we generate a ray id
  // Manually set the rayId header since we may generate it in some situations
  // (in development). Request headers are immutable, hence the cloning.
  // This is mostly a fail-safe. It ensures that the cf-ray is the same for the
  // Worker and the DO. That helps with request correlation in logs.
  const headers = new Headers(request.headers);
  headers.set("cf-ray", request.rayId);

  return tunnel.fetch(request, { headers });
};
