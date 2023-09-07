import { Context } from "./context";

export async function sign(
  tunnelId: string,
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

  const token = `${tunnelId}|${ip}`;
  const signature = await crypto.subtle.sign("HMAC", key, te.encode(token));

  return (
    token +
    "|" +
    btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("=", "")
  );
}

export async function verify(
  token: string,
  ctx: Context
): Promise<false | [string, string]> {
  const [tunnelId, ip] = token.split("|");
  const signature = await sign(tunnelId, ip, ctx);
  if (signature === token) return [tunnelId, ip];
  return false;
}
