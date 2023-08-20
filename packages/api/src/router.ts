import { Ok, Result } from "ts-results";
import { Context } from "./context";
import { BlobError, errors } from "./errors";
import { CONNECTION_TIMEOUT, SESSION_TIMEOUT } from "./session";

const allowedOrigins = ["http://localhost:8787", "https://blob.city"];

type Metadata = {
  actorId: string;
  ipLock?: string;
};

export const route = async (
  request: Request,
  ctx: Context
): Promise<Result<DurableObjectId, BlobError>> => {
  if (ctx.env.environment === "production") {
    const origin = request.headers.get("Origin");
    if (!allowedOrigins.includes(origin!))
      return errors.badRequest("Unrecognized origin");
  }

  const { pathname } = new URL(request.url);

  if (request.method === "GET" && pathname === "/new") {
    const upgrade = request.headers.get("Upgrade");
    if (!upgrade) return errors.badRequest("Missing Upgrade header");
    if (upgrade !== "websocket")
      return errors.badRequest("Invalid Upgrade header");

    const sessionId = "000000";
    ctx.setTags({ sessionId });

    const actorId = ctx.env.sessions.newUniqueId();

    const metadata: Metadata = { actorId: actorId.toString() };
    await ctx.env.metadata.put(sessionId, JSON.stringify(metadata), {
      // Supply a short expiration time for new sessions to control churn.
      // When a receiver connects, it will extend the expiration to something longer.
      expirationTtl: CONNECTION_TIMEOUT / 1000,
    });

    return Ok(actorId);
  }

  const [_, sessionId] = pathname.split("/");
  if (!sessionId) return errors.badRequest("Missing session id");

  ctx.setTags({ sessionId });

  const metadata = await ctx.env.metadata.get(sessionId);
  if (!metadata) return errors.notFound();

  const { actorId }: Metadata = JSON.parse(metadata);
  await ctx.env.metadata.put(sessionId, metadata, {
    // Extend TTL since a receiver connected
    expirationTtl: SESSION_TIMEOUT / 1000,
  });

  return Ok(ctx.env.sessions.idFromString(actorId));
};
