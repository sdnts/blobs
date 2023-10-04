import { IRequestStrict, error } from "itty-router";
import { verify } from "./auth";
import { Env } from "./worker";

type Middleware = (
  request: IRequestStrict,
  env: Env,
  rayId: string,
  ip: string
) => void | Response | Promise<void | Response>;

export const withSession: Middleware = async (request, env, rayId, ip) => {
  const token = request.query.t;
  if (!token) return error(403, { error: "Missing auth token" });
  if (Array.isArray(token))
    return error(400, { error: "Multiple auth tokens" });

  const auth = await verify(token, env);
  if (auth === false) return error(403, { error: "Invalid auth token" });

  const { sessionId, ip: lockedIp } = auth;

  if (!sessionId) return error(403, { error: "Malformed auth token" });
  if (ip !== lockedIp) return error(403, "Unauthorized IP");

  const headers = new Headers(request.headers);
  headers.set("x-ray-id", rayId);

  return env.sessions
    .get(env.sessions.idFromString(sessionId))
    .fetch(request, { headers });
};
