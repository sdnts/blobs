import { IRequestStrict, error } from "itty-router";
import { Context } from "./context";
import { verify } from "./auth";

type Middleware = (
  request: TunnelRequest,
  ctx: Context
) => void | Response | Promise<void | Response>;

export type TunnelRequest = IRequestStrict & {
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

      ctx.tag({
        rayId: request.headers.get("cf-ray") ?? undefined,
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
  return tunnel.fetch(request);
};
