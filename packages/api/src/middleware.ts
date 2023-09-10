import { IRequestStrict, error } from "itty-router";
import { Context } from "./context";
import { verify } from "./auth";

type Middleware = (
  request: TunnelRequest,
  ctx: Context
) => void | Response | Promise<void | Response>;

export type TunnelRequest = IRequestStrict & {
  ip: string;
  tunnelId: string;
};

export const withIp =
  (): Middleware =>
  (request, ctx): void | Response => {
    let ip = request.headers.get("cf-connecting-ip");
    if (ctx.env.environment === "development") ip = "127.0.0.1";
    if (!ip) return error(400, "Missing IP");

    request.ip = ip;
  };

export const withTags = (): Middleware => (request, ctx) => {
  ctx.tag({
    rayId: request.headers.get("cf-ray") ?? undefined,
    method: request.method,
    path: new URL(request.url).pathname,
  });
};

export const withAuth = (): Middleware => async (request, ctx) => {
  const token = request.query.t;
  if (!token) return error(403, "Missing auth");
  if (Array.isArray(token)) return error(400, "Multiple tokens");

  const auth = await verify(token, ctx.env);
  if (auth === false) return error(403, "Invalid auth token");

  const { tunnelId, ip: lockedIp } = auth;
  if (!tunnelId || !lockedIp) return error(400, "Malformed auth token");

  request.tunnelId = tunnelId;
  ctx.tag({ tunnelId });

  if (request.ip !== lockedIp) return error(403, "Unauthorized IP");
};

type Action = "preflight" | "new" | "join" | "tunnel" | "download";
export const withAction =
  (action: Action): Middleware =>
  (_, ctx) => {
    ctx.tag({ action });
  };

export const withTunnel = (): Middleware => (request, ctx) => {
  const tunnel = ctx.env.tunnel.get(
    ctx.env.tunnel.idFromString(request.tunnelId)
  );
  return tunnel.fetch(request);
};
