import { IRequestStrict, error } from "itty-router";
import { nanoid } from "nanoid";
import { verify } from "./auth";
import { Env } from "./worker";

type Middleware = (
  request: TunnelRequest,
  env: Env
) => void | Response | Promise<void | Response>;

export type TunnelRequest = IRequestStrict & {
  rayId: string;
  peerId: string;
  tunnelId: string;
  ip: string;
};

export const withIp =
  (): Middleware =>
  (request, env): void | Response => {
    let ip = request.headers.get("cf-connecting-ip");
    if (env.environment === "development") ip = "127.0.0.1";
    if (!ip) return error(400, "Missing IP");

    request.ip = ip;
  };

export const withRayId =
  (): Middleware =>
  (request): void | Response => {
    // In production, there _should_ always be a Ray ID that uniquely identifies
    // a request, but we'll set up a default just in case.
    // Development doesn't, so it'll be useful then too.
    const rayId = request.headers.get("cf-ray") ?? nanoid();
    request.rayId = rayId;
  };

export const withAuth = (): Middleware => async (request, env) => {
  const token = request.query.t;
  if (!token) return error(403, "Missing auth");
  if (Array.isArray(token)) return error(400, "Multiple tokens");

  const auth = await verify(token, env);
  if (auth === false) return error(403, "Invalid auth token");

  const { peerId, tunnelId, ip: lockedIp } = auth;

  if (request.ip !== lockedIp) return error(403, "Unauthorized IP");

  request.peerId = peerId;
  request.tunnelId = tunnelId;
};
