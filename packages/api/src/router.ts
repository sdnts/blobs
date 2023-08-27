import { customAlphabet } from "nanoid";
import { Ok, Result } from "ts-results";
import { Context } from "./context";
import { verify } from "./cookie";
import { BlobError, errors } from "./errors";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 6);

export const route = async (
  request: Request,
  ctx: Context
): Promise<Result<DurableObjectId, BlobError>> => {
  if (request.method !== "GET") return errors.badRequest("Bad Method");

  let ip = request.headers.get("cf-connecting-ip");
  if (ctx.env.environment === "development") ip = "127.0.0.1";
  if (!ip) return errors.unknown("Missing IP");

  const cookie = request.headers.get("cookie");
  console.log("Cookie", cookie);

  // First check to see if we can find an actorId in a cookie
  if (cookie) {
    const cookies: Record<string, string> = Object.fromEntries(
      cookie
        .split(";")
        .filter((c) => !!c)
        .map((c) => c.trim().split("="))
    );
    console.log("Cookies", cookies);

    if (cookies.auth) {
      const auth = await verify(cookies.auth, ctx);
      if (auth.err) return auth;

      const [actorId, lockedIp] = auth.val;
      if (!actorId || !lockedIp)
        return errors.internalError("Malformed auth cookie");

      if (ip !== lockedIp) return errors.unauthorized("Unauthorized IP");

      return Ok(ctx.env.sessions.idFromString(actorId));
    }
  }

  const { pathname, searchParams } = new URL(request.url);
  let [_, action] = pathname.split("/");

  switch (action) {
    case "new": {
      const upgrade = request.headers.get("Upgrade");
      if (!upgrade) return errors.badRequest("Missing Upgrade header");
      if (upgrade !== "websocket")
        return errors.badRequest("Invalid Upgrade header");

      return Ok(ctx.env.sessions.newUniqueId());
    }

    case "join": {
      // We can now assume that this is the first time a client is connecting to
      // this session
      const secret = searchParams.get("s");
      if (!secret) return errors.badRequest("Missing secret");

      const actorId = await ctx.env.metadata.get(secret);
      if (!actorId) return errors.unauthorized("Incorrect secret");

      return Ok(ctx.env.sessions.idFromString(actorId));
    }

    case "download": {
      // Client must have a cookie to do this
      return errors.badRequest("No auth cookie");
    }
  }

  return errors.badRequest("Bad pathname");
};
