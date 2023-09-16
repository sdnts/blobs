import { Env } from "./worker";

export async function sign(
  peerId: string,
  tunnelId: string,
  ip: string,
  env: Pick<Env, "authSecret">
): Promise<string> {
  const te = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(env.authSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = `${peerId}|${tunnelId}|${ip}`;
  const signature = await crypto.subtle.sign("HMAC", key, te.encode(token));

  return (
    token +
    "|" +
    btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("=", "")
  );
}

export async function verify(
  token: string,
  env: Pick<Env, "authSecret">
): Promise<false | { peerId: string; tunnelId: string; ip: string }> {
  const [peerId, tunnelId, ip] = token.split("|");
  if (peerId !== "1" && peerId !== "2") return false;
  if (!ip) return false;
  if (!tunnelId) return false;

  const signedToken = await sign(peerId, tunnelId, ip, env);
  if (signedToken === token) return { peerId, tunnelId, ip };
  return false;
}
