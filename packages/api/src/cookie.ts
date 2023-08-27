import { Ok, Result } from "ts-results";
import { Context } from "./context";
import { BlobError, errors } from "./errors";
import { CONNECTION_TIMEOUT } from "./session";

export async function appendCookies(
  headers: Headers,
  actorId: DurableObjectId,
  ip: string,
  secret: string,
  ctx: Context
): Promise<Headers> {
  headers.append(
    "Set-Cookie",
    [
      `auth=${await sign(actorId.toString(), ip, ctx)}`,
      `HttpOnly`,
      `Max-Age=${CONNECTION_TIMEOUT}`,
      ctx.env.environment === "production" ? `Secure` : "",
    ].join("; ")
  );

  headers.append(
    "Set-Cookie",
    [
      `secret=${secret}`,
      `Max-Age=${CONNECTION_TIMEOUT}`,
      ctx.env.environment === "production" ? `Secure` : "",
    ].join("; ")
  );

  return headers;
}

export async function sign(
  actorId: string,
  ip: string,
  ctx: Context
): Promise<string> {
  const te = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(ctx.env.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const cookie = `${actorId}|${ip}`;
  const signature = await crypto.subtle.sign("HMAC", key, te.encode(cookie));

  return (
    cookie +
    "|" +
    btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("=", "")
  );
}

export async function verify(
  cookie: string,
  ctx: Context
): Promise<Result<[string, string], BlobError>> {
  const [actorId, ip, signature] = cookie.split("|");
  const calculatedSignature = await sign(actorId, ip, ctx);
  if (calculatedSignature === signature) return Ok([actorId, ip]);
  return errors.unauthorized("Incorrect auth cookie signature");
}
